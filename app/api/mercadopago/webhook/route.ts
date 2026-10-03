import { NextResponse } from 'next/server';
import { notifyOrderOnce } from '@/lib/server/notify';
import { createClient } from '@supabase/supabase-js';
import { getValidMercadoPagoAccessToken } from '@/lib/server/mercadopago-connection';
import { getServerEnv } from '@/lib/server/env';

// Maps Mercado Pago payment statuses to our own payment_status vocabulary.
function mapPaymentStatus(mpStatus: string): string {
  switch (mpStatus) {
    case 'approved':
      return 'aprobado';
    case 'rejected':
      return 'rechazado';
    case 'in_process':
    case 'pending':
      return 'en_proceso';
    default:
      return 'pendiente';
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get('type') || url.searchParams.get('topic');
    const body = await request.json().catch(() => ({}));

    // Mercado Pago sends the payment id either as a query param or in the body,
    // depending on whether it's the classic IPN format or the newer webhook format.
    const paymentId =
      url.searchParams.get('id') ||
      url.searchParams.get('data.id') ||
      body?.data?.id ||
      body?.id;

    if ((topic !== 'payment' && body?.type !== 'payment') || !paymentId) {
      // Not a payment notification we care about (e.g. merchant_order pings) - ack it anyway.
      return NextResponse.json({ received: true });
    }

    const accessToken = await getValidMercadoPagoAccessToken();
    if (!accessToken) {
      console.error('No hay una cuenta de Mercado Pago conectada, no se puede verificar el pago del webhook');
      return NextResponse.json({ received: true });
    }

    // Always re-fetch the payment from Mercado Pago's API rather than trusting
    // the webhook payload directly - this is the recommended, tamper-proof way
    // to confirm a payment's real status.
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!paymentRes.ok) {
      console.error('Failed to fetch payment from Mercado Pago', await paymentRes.text());
      return NextResponse.json({ received: true });
    }

    const payment = await paymentRes.json();
    const orderId = payment.external_reference;
    if (!orderId) {
      return NextResponse.json({ received: true });
    }

    const supabaseUrl = await getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = await getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase service role key not configured, cannot update order from webhook');
      return NextResponse.json({ received: true });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const paymentStatus = mapPaymentStatus(payment.status);

    const updatePayload: Record<string, unknown> = {
      payment_status: paymentStatus,
      mp_payment_id: String(payment.id),
    };

    // Only bump the fulfillment status forward on an approved payment, and
    // only if the order is still in its initial state - never override a
    // status the store owner already advanced manually (e.g. 'enviado').
    if (paymentStatus === 'aprobado') {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.status === 'pendiente') {
        updatePayload.status = 'confirmado';
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order from Mercado Pago webhook:', updateError);
    }

    if (!updateError && paymentStatus === 'aprobado') {
      // Recién acá se descuenta stock de verdad - commit_order_stock es
      // idempotente (seguro llamarlo de nuevo si Mercado Pago reintenta el
      // webhook), así que no hace falta ningún chequeo extra.
      const { error: stockError } = await supabaseAdmin.rpc('commit_order_stock', { p_order_id: orderId });
      if (stockError) {
        console.error('Error descontando stock desde el webhook de Mercado Pago:', stockError);
      }
      await notifyOrderOnce(supabaseAdmin, orderId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling Mercado Pago webhook:', error);
    // Still return 200 so Mercado Pago doesn't hammer us with retries for a bug on our side.
    return NextResponse.json({ received: true });
  }
}
