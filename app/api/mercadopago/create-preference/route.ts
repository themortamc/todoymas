import { NextResponse } from 'next/server';
import { getValidMercadoPagoAccessToken } from '@/lib/server/mercadopago-connection';
import { getServerEnv } from '@/lib/server/env';
import { supabase } from '@/lib/supabase';

interface OrderItemInput {
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CreatePreferenceBody {
  orderId: string;
  items: OrderItemInput[];
  shippingCost?: number;
  // 'tarjeta': solo tarjetas de crédito/débito, lleva recargo.
  // 'dinero': solo dinero en cuenta de Mercado Pago, sin recargo.
  paymentVariant?: 'tarjeta' | 'dinero';
  payer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

// Tipos de medio de pago que reconoce la preferencia de Mercado Pago
// (payment_methods.excluded_payment_types). Los usamos para que la
// preferencia de "tarjeta" solo deje pagar con tarjeta, y la de "dinero"
// solo deje pagar con el saldo de la cuenta de Mercado Pago - así el
// recargo nunca termina aplicado al método equivocado.
const ONLY_CARDS_EXCLUDES = [
  { id: 'account_money' },
  { id: 'ticket' },
  { id: 'bank_transfer' },
  { id: 'atm' },
  { id: 'digital_currency' },
  { id: 'digital_wallet' },
];

const ONLY_ACCOUNT_MONEY_EXCLUDES = [
  { id: 'credit_card' },
  { id: 'debit_card' },
  { id: 'prepaid_card' },
  { id: 'ticket' },
  { id: 'bank_transfer' },
  { id: 'atm' },
  { id: 'digital_currency' },
];

// Splits "Juan Pérez" into { first_name: "Juan", last_name: "Pérez" } as
// Mercado Pago expects separate name fields for the payer.
function splitName(fullName?: string) {
  if (!fullName || !fullName.trim()) return { first_name: undefined, last_name: undefined };
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts.shift();
  const last_name = parts.length > 0 ? parts.join(' ') : undefined;
  return { first_name, last_name };
}

export async function POST(request: Request) {
  try {
    const accessToken = await getValidMercadoPagoAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'El pago con Mercado Pago no está configurado todavía. Elegí transferencia o efectivo.',
        },
        { status: 501 }
      );
    }

    const body = (await request.json()) as CreatePreferenceBody;
    const { orderId, items, shippingCost = 0, payer, paymentVariant = 'tarjeta' } = body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pedido inválido' },
        { status: 400 }
      );
    }

    const rawSiteUrl = await getServerEnv('NEXT_PUBLIC_SITE_URL');
    const siteUrl = rawSiteUrl?.replace(/\/$/, '') ?? new URL(request.url).origin;

    const preferenceItems = items.map((item) => ({
      id: item.product_id,
      title: item.name.slice(0, 250),
      quantity: item.quantity,
      unit_price: Number(item.price),
      currency_id: 'ARS',
      picture_url: item.image || undefined,
    }));

    if (shippingCost > 0) {
      preferenceItems.push({
        id: 'envio',
        title: 'Costo de envío',
        quantity: 1,
        unit_price: Number(shippingCost),
        currency_id: 'ARS',
        picture_url: undefined,
      });
    }

    // El recargo se recalcula acá, del lado del servidor, a partir del %
    // configurado en el panel (/admin/pagos) - nunca se confía en un monto
    // armado en el navegador. Solo existe recargo para la variante
    // "tarjeta"; pagando con dinero en cuenta nunca hay recargo.
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) + Number(shippingCost);
    const surchargeKey = paymentVariant === 'dinero' ? 'mercadopago_dinero' : 'mercadopago_tarjeta';
    const { data: surchargePercent } = await supabase.rpc('get_surcharge_percent', {
      p_payment_method: surchargeKey,
    });
    const surchargeAmount = Math.round(subtotal * ((Number(surchargePercent) || 0) / 100) * 100) / 100;

    if (surchargeAmount > 0) {
      preferenceItems.push({
        id: 'recargo',
        title: `Recargo tarjeta (${surchargePercent}%)`,
        quantity: 1,
        unit_price: surchargeAmount,
        currency_id: 'ARS',
        picture_url: undefined,
      });
    }

    const total = subtotal + surchargeAmount;

    const { first_name, last_name } = splitName(payer?.name);

    const preferencePayload = {
      items: preferenceItems,
      payer: {
        name: first_name,
        surname: last_name,
        email: payer?.email || undefined,
        phone: payer?.phone ? { number: payer.phone } : undefined,
      },
      external_reference: orderId,
      back_urls: {
        success: `${siteUrl}/checkout/retorno?order=${orderId}`,
        pending: `${siteUrl}/checkout/retorno?order=${orderId}`,
        failure: `${siteUrl}/checkout/retorno?order=${orderId}`,
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/api/mercadopago/webhook`,
      statement_descriptor: 'TODOYMAS',
      payment_methods: {
        excluded_payment_types: paymentVariant === 'dinero' ? ONLY_ACCOUNT_MONEY_EXCLUDES : ONLY_CARDS_EXCLUDES,
      },
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Mercado Pago preference error:', mpData);
      return NextResponse.json(
        { success: false, error: 'No pudimos iniciar el pago con Mercado Pago. Probá nuevamente.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      surchargeAmount,
      total,
    });
  } catch (error) {
    console.error('Error creating Mercado Pago preference:', error);
    return NextResponse.json(
      { success: false, error: 'Error al iniciar el pago' },
      { status: 500 }
    );
  }
}
