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
// IMPORTANTE: Mercado Pago NO permite excluir "account_money" (dinero en
// cuenta): devuelve el error "account_money cannot be excluded". Por eso la
// preferencia de "tarjetas" solo puede sacar los otros medios (efectivo en
// puntos de pago, transferencia, cajero); si la persona está logueada en
// Mercado Pago, igual va a ver su saldo. En el checkout se le avisa que, para
// pagar con saldo, tiene que elegir la otra opción (sin recargo).
const ONLY_CARDS_EXCLUDES = [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }];

const ONLY_ACCOUNT_MONEY_EXCLUDES = [
  { id: 'credit_card' },
  { id: 'debit_card' },
  { id: 'prepaid_card' },
  { id: 'ticket' },
  { id: 'bank_transfer' },
  { id: 'atm' },
];

// Versión mínima de las listas de arriba, usada de respaldo si Mercado Pago
// rechaza la lista completa.
const CARDS_CORE_EXCLUDES = [{ id: 'ticket' }];
const ACCOUNT_MONEY_CORE_EXCLUDES = [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'prepaid_card' }];

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
        title: `Recargo ${paymentVariant === 'dinero' ? 'Mercado Pago' : 'tarjetas'} (${surchargePercent}%)`,
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
    };

    const fullExcludes = paymentVariant === 'dinero' ? ONLY_ACCOUNT_MONEY_EXCLUDES : ONLY_CARDS_EXCLUDES;
    const coreExcludes = paymentVariant === 'dinero' ? ACCOUNT_MONEY_CORE_EXCLUDES : CARDS_CORE_EXCLUDES;

    const sendPreference = async (excluded: { id: string }[]) => {
      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...preferencePayload,
          payment_methods: { excluded_payment_types: excluded },
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    let { res: mpRes, data: mpData } = await sendPreference(fullExcludes);

    // Si Mercado Pago rechaza la lista completa de medios excluidos, se
    // reintenta una vez con la lista mínima en vez de dejar al cliente sin pagar.
    if (!mpRes.ok) {
      console.error('Mercado Pago preference error (intento 1):', JSON.stringify(mpData));
      ({ res: mpRes, data: mpData } = await sendPreference(coreExcludes));
    }

    if (!mpRes.ok) {
      console.error('Mercado Pago preference error (intento 2):', JSON.stringify(mpData));
      // Motivo real que informa Mercado Pago, para poder diagnosticar el problema.
      const causes = Array.isArray(mpData?.cause)
        ? mpData.cause.map((c: { description?: string; code?: string | number }) => c.description || c.code).filter(Boolean)
        : [];
      const detail = [mpData?.message, ...causes].filter(Boolean).join(' · ') || `HTTP ${mpRes.status}`;
      return NextResponse.json(
        {
          success: false,
          error: 'No pudimos iniciar el pago con Mercado Pago. Probá nuevamente.',
          detail,
        },
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
