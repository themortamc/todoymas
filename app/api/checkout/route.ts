import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/server/env';
import { getValidMercadoPagoAccessToken } from '@/lib/server/mercadopago-connection';
import { notifyOrderOnce } from '@/lib/server/notify';
import {
  CheckoutError,
  PAYMENT_METHODS,
  createGoCuotasCheckout,
  createMercadoPagoPreference,
  getAdminSupabase,
  quoteCheckout,
  type Delivery,
  type PaymentMethod,
} from '@/lib/server/checkout';

// Crea el pedido online. Precios, envío, recargo y total se calculan acá
// desde la base (ver lib/server/checkout.ts); del navegador solo se toman
// ids, cantidades y datos del cliente/entrega. El pedido lo inserta el
// servidor con la service role (la tabla orders ya no acepta inserts
// anónimos).

const DELIVERIES: Delivery[] = ['retiro', 'domicilio', 'sucursal'];

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new CheckoutError('Pedido inválido.');

    const delivery = body.delivery as Delivery;
    const paymentMethod = body.paymentMethod as PaymentMethod;
    if (!DELIVERIES.includes(delivery)) throw new CheckoutError('Elegí cómo querés recibir el pedido.');
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new CheckoutError('Elegí un método de pago.');
    if (delivery !== 'retiro' && paymentMethod === 'efectivo') {
      throw new CheckoutError('El pago en efectivo es solo para retiro en el local.');
    }

    const customerName = text(body.customer?.name, 120);
    const customerEmail = text(body.customer?.email, 200);
    const customerPhone = text(body.customer?.phone, 40);
    const notes = text(body.notes, 1000);
    const city = text(body.city, 120);
    const address = text(body.address, 200);
    const province = text(body.province, 60);
    const postalCode = text(body.postalCode, 12).toUpperCase();
    if (!customerName) throw new CheckoutError('Completá tu nombre.');
    if (delivery !== 'retiro' && !city) throw new CheckoutError('Completá la ciudad o localidad.');
    if (delivery === 'domicilio' && !address) throw new CheckoutError('Completá la dirección de envío.');

    const db = await getAdminSupabase();
    const quote = await quoteCheckout(db, { items: body.items, delivery, postalCode, province, paymentMethod });
    if (quote.total <= 0) throw new CheckoutError('Pedido inválido.');

    const orderId = crypto.randomUUID();
    const rawSiteUrl = await getServerEnv('NEXT_PUBLIC_SITE_URL');
    const siteUrl = rawSiteUrl?.replace(/\/$/, '') ?? new URL(request.url).origin;

    const order: Record<string, unknown> = {
      id: orderId,
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      status: 'pendiente',
      channel: 'online',
      payment_method: paymentMethod,
      payment_status: 'pendiente',
      shipping_method: delivery === 'retiro' ? 'retiro' : 'envio',
      shipping_service: delivery === 'retiro' ? null : delivery,
      shipping_cost: quote.shippingCost,
      address:
        delivery === 'domicilio'
          ? `${address}, ${city}, ${province} (CP: ${postalCode})`
          : delivery === 'sucursal'
          ? `Retira en sucursal de Correo Argentino: ${city}, ${province} (CP: ${postalCode})`
          : null,
      city: delivery === 'retiro' ? null : `${city} (${province})`,
      notes: notes || null,
      total: quote.total,
      surcharge_amount: quote.surchargeAmount,
      items: quote.lines,
    };

    const payer = { name: customerName, email: customerEmail || undefined, phone: customerPhone || undefined };

    if (paymentMethod === 'mercadopago_tarjeta') {
      const accessToken = await getValidMercadoPagoAccessToken();
      if (!accessToken) {
        throw new CheckoutError('El pago con Mercado Pago no está configurado todavía. Elegí transferencia o efectivo.', 501);
      }
      const { preferenceId, initPoint } = await createMercadoPagoPreference({
        accessToken,
        orderId,
        quote,
        variant: 'tarjeta',
        siteUrl,
        payer,
      });
      const { error } = await db.from('orders').insert({ ...order, mp_preference_id: preferenceId });
      if (error) {
        console.error('No se pudo guardar el pedido (Mercado Pago):', error);
        throw new CheckoutError('Ocurrió un error al guardar el pedido. Intentá nuevamente.', 500);
      }
      // El stock se descuenta recién cuando el webhook confirma el pago.
      return NextResponse.json({ success: true, orderId, total: quote.total, redirectUrl: initPoint });
    }

    if (paymentMethod === 'gocuotas') {
      const email = await getServerEnv('GOCUOTAS_EMAIL');
      const password = await getServerEnv('GOCUOTAS_PASSWORD');
      if (!email || !password) {
        throw new CheckoutError('El pago en cuotas con GoCuotas no está configurado todavía. Elegí otro método de pago.', 501);
      }
      const { initUrl } = await createGoCuotasCheckout({ email, password, orderId, total: quote.total, siteUrl, payer });
      const { error } = await db.from('orders').insert(order);
      if (error) {
        console.error('No se pudo guardar el pedido (GoCuotas):', error);
        throw new CheckoutError('Ocurrió un error al guardar el pedido. Intentá nuevamente.', 500);
      }
      return NextResponse.json({ success: true, orderId, total: quote.total, redirectUrl: initUrl });
    }

    // Efectivo / transferencia: pedido firme, el stock se descuenta ya.
    const { error } = await db.from('orders').insert(order);
    if (error) {
      console.error('No se pudo guardar el pedido:', error);
      throw new CheckoutError('Ocurrió un error al guardar el pedido. Intentá nuevamente.', 500);
    }
    const { error: stockError } = await db.rpc('commit_order_stock', { p_order_id: orderId });
    if (stockError) console.error('No se pudo descontar el stock del pedido:', stockError.message);
    await notifyOrderOnce(db, orderId);

    return NextResponse.json({ success: true, orderId, total: quote.total });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error en /api/checkout:', error);
    return NextResponse.json({ success: false, error: 'Ocurrió un error al procesar el pedido. Intentá nuevamente.' }, { status: 500 });
  }
}
