import { NextResponse } from 'next/server';
import { notifyOrderOnce } from '@/lib/server/notify';
import { createClient } from '@supabase/supabase-js';
import { verifyGocuotasWebhookToken } from '@/lib/server/webhook-token';

// GoCuotas calls this URL (set as webhook_url when creating the checkout)
// with a body like:
// {
//   "order_reference_id": "ref_123",  <- this is OUR order id (orders.id)
//   "status": "approved",
//   "order_id": "123",                <- GoCuotas' own order id
//   "number_of_installments": 3,
//   "amount_in_cents": 300000
// }
//
// The docs only show "approved" as an example status. We map it and fall
// back to "en_proceso" for anything else we don't recognize yet - if
// GoCuotas sends other statuses (e.g. "rejected", "cancelled"), add them
// below once confirmed (check the logs for the raw status received).
function mapPaymentStatus(gcStatus: string): string {
  switch (gcStatus) {
    case 'approved':
      return 'aprobado';
    case 'rejected':
    case 'cancelled':
    case 'canceled':
      return 'rechazado';
    case 'pending':
    case 'in_process':
      return 'en_proceso';
    default:
      return 'pendiente';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { order_reference_id: orderId, status, order_id: gocuotasOrderId } = body || {};

    if (!orderId || !status) {
      // Not a payload we recognize - ack it anyway so GoCuotas doesn't retry forever.
      return NextResponse.json({ received: true });
    }

    // Seguridad: la URL del webhook lleva una firma por pedido que solo
    // conoce el servidor (ver lib/server/webhook-token.ts). Sin firma válida
    // no se toca el pedido: si no, cualquiera podía marcarlo como pagado.
    const token = new URL(request.url).searchParams.get('token');
    if (!(await verifyGocuotasWebhookToken(String(orderId), token))) {
      console.error(`Webhook de GoCuotas rechazado: firma inválida para el pedido ${orderId}`);
      return NextResponse.json({ received: false }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase service role key not configured, cannot update order from GoCuotas webhook');
      return NextResponse.json({ received: true });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const paymentStatus = mapPaymentStatus(status);

    const updatePayload: Record<string, unknown> = {
      payment_status: paymentStatus,
      gocuotas_order_id: gocuotasOrderId ? String(gocuotasOrderId) : null,
    };

    // Same rule as the Mercado Pago webhook: only bump fulfillment status
    // forward on approval, and only if it's still in its initial state.
    // Si el monto informado es menor que el total del pedido, no se confirma
    // ni se descuenta stock: queda para revisar a mano.
    let confirmable = false;
    if (paymentStatus === 'aprobado') {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('status, total')
        .eq('id', orderId)
        .single();

      const paidCents = Number(body?.amount_in_cents);
      const expectedCents = Math.round(Number(existingOrder?.total) * 100);
      const underpaid = Number.isFinite(paidCents) && Number.isFinite(expectedCents) && paidCents + 100 < expectedCents;
      if (underpaid) {
        console.error(`GoCuotas informó $${paidCents / 100} para el pedido ${orderId} (total $${expectedCents / 100}). No se confirma.`);
      } else {
        confirmable = true;
        if (existingOrder?.status === 'pendiente') {
          updatePayload.status = 'confirmado';
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order from GoCuotas webhook:', updateError);
    }

    if (!updateError && confirmable) {
      // Recién acá se descuenta stock de verdad - commit_order_stock es
      // idempotente (seguro llamarlo de nuevo si GoCuotas reintenta el
      // webhook), así que no hace falta ningún chequeo extra.
      const { error: stockError } = await supabaseAdmin.rpc('commit_order_stock', { p_order_id: orderId });
      if (stockError) {
        console.error('Error descontando stock desde el webhook de GoCuotas:', stockError);
      }
      await notifyOrderOnce(supabaseAdmin, orderId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling GoCuotas webhook:', error);
    return NextResponse.json({ received: true });
  }
}
