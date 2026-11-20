// Armado del pedido del lado del servidor. Todo lo que define cuánto se
// cobra (precios, envío, recargo, total) se calcula acá a partir de la base
// de datos: del navegador solo se aceptan ids de producto/variante,
// cantidades, datos de entrega y del cliente. Así nadie puede pagar menos
// editando el pedido en el navegador.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/server/env';
import { calculateShipping, ShippingError, type ShippingItem, type ShippingQuote, type ShippingService } from '@/lib/shipping';
import { ONLINE_SURCHARGE_KEYS } from '@/lib/surcharges';

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// 'mercadopago_dinero' ya no se ofrece: con saldo de Mercado Pago se paga
// por transferencia al alias (sin la comisión de ~8% del checkout).
export const PAYMENT_METHODS = ['mercadopago_tarjeta', 'gocuotas', 'transferencia', 'efectivo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Delivery = 'retiro' | ShippingService;

export type CartLineInput = { product_id: string; variant_id?: string | null; quantity: number };

export type PricedLine = {
  product_id: string;
  variant_id?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getAdminSupabase(): Promise<SupabaseClient> {
  const url = await getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = await getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new CheckoutError('La tienda no está bien configurada para recibir pedidos.', 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublicSupabase(): Promise<SupabaseClient> {
  const url = await getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = await getServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new CheckoutError('La tienda no está bien configurada.', 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseLines(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new CheckoutError('El carrito está vacío.');
  if (raw.length > 100) throw new CheckoutError('Demasiados productos en un solo pedido.');
  return raw.map((r: any) => {
    const quantity = Number(r?.quantity);
    if (typeof r?.product_id !== 'string' || !UUID_RE.test(r.product_id)) throw new CheckoutError('Producto inválido en el carrito.');
    if (r.variant_id != null && (typeof r.variant_id !== 'string' || !UUID_RE.test(r.variant_id))) {
      throw new CheckoutError('Variante inválida en el carrito.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new CheckoutError('Cantidad inválida en el carrito.');
    return { product_id: r.product_id, variant_id: r.variant_id ?? null, quantity };
  });
}

// Trae de la base nombre, precio, foto y peso/medidas de cada línea.
export async function loadCart(db: SupabaseClient, rawLines: unknown) {
  const lines = parseLines(rawLines);
  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const variantIds = Array.from(new Set(lines.map((l) => l.variant_id).filter((v): v is string => !!v)));

  const { data: products, error } = await db
    .from('products')
    .select('id, name, price, images, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds);
  if (error) throw new CheckoutError('No pudimos leer los productos. Probá de nuevo.', 500);

  let variants: any[] = [];
  if (variantIds.length > 0) {
    const { data, error: vError } = await db
      .from('product_variants')
      .select('id, product_id, group_name, label, image_url')
      .in('id', variantIds);
    if (vError) throw new CheckoutError('No pudimos leer las variantes. Probá de nuevo.', 500);
    variants = data ?? [];
  }

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
  const variantById = new Map(variants.map((v: any) => [v.id, v]));

  const priced: PricedLine[] = [];
  const shippingItems: ShippingItem[] = [];
  for (const line of lines) {
    const p = byId.get(line.product_id);
    if (!p) throw new CheckoutError('Un producto del carrito ya no está disponible. Sacalo y probá de nuevo.', 409);
    const v = line.variant_id ? variantById.get(line.variant_id) : null;
    if (line.variant_id && (!v || v.product_id !== p.id)) {
      throw new CheckoutError(`La variante elegida de "${p.name}" ya no está disponible.`, 409);
    }
    const price = Number(p.price);
    if (!Number.isFinite(price) || price < 0) throw new CheckoutError(`"${p.name}" no tiene un precio válido.`, 409);
    priced.push({
      product_id: p.id,
      ...(v ? { variant_id: v.id, variant: `${v.group_name}: ${v.label}` } : {}),
      name: p.name,
      price,
      quantity: line.quantity,
      image: v?.image_url || p.images?.[0] || '',
    });
    shippingItems.push({
      quantity: line.quantity,
      weightKg: p.weight_kg,
      lengthCm: p.length_cm,
      widthCm: p.width_cm,
      heightCm: p.height_cm,
    });
  }

  const subtotal = round2(priced.reduce((s, l) => s + l.price * l.quantity, 0));
  return { lines: priced, shippingItems, subtotal };
}

export function quoteShippingFor(shippingItems: ShippingItem[], postalCode: unknown, province: unknown): ShippingQuote {
  try {
    return calculateShipping({ postalCode, province, items: shippingItems });
  } catch (e) {
    if (e instanceof ShippingError) throw new CheckoutError(e.message);
    throw e;
  }
}

export type CheckoutQuote = {
  lines: PricedLine[];
  subtotal: number;
  shippingCost: number;
  shipping: ShippingQuote | null;
  surchargePercent: number;
  surchargeAmount: number;
  total: number;
};

export async function quoteCheckout(
  db: SupabaseClient,
  input: { items: unknown; delivery: Delivery; postalCode?: unknown; province?: unknown; paymentMethod: PaymentMethod }
): Promise<CheckoutQuote> {
  const cart = await loadCart(db, input.items);

  let shipping: ShippingQuote | null = null;
  let shippingCost = 0;
  if (input.delivery !== 'retiro') {
    shipping = quoteShippingFor(cart.shippingItems, input.postalCode, input.province);
    shippingCost = shipping[input.delivery];
  }

  let surchargePercent = 0;
  if ((ONLINE_SURCHARGE_KEYS as string[]).includes(input.paymentMethod)) {
    const { data, error } = await db.rpc('get_surcharge_percent', { p_payment_method: input.paymentMethod });
    if (error) throw new CheckoutError('No pudimos calcular el recargo. Probá de nuevo.', 500);
    surchargePercent = Number(data) || 0;
  }

  const base = round2(cart.subtotal + shippingCost);
  const surchargeAmount = round2(base * (surchargePercent / 100));
  return {
    lines: cart.lines,
    subtotal: cart.subtotal,
    shippingCost,
    shipping,
    surchargePercent,
    surchargeAmount,
    total: round2(base + surchargeAmount),
  };
}

// ---------------------------------------------------------------- Mercado Pago

// Mercado Pago NO permite excluir "account_money": la preferencia de
// "tarjetas" solo saca los otros medios. Ver comentarios del checkout.
const ONLY_CARDS_EXCLUDES = [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }];
const ONLY_ACCOUNT_MONEY_EXCLUDES = [
  { id: 'credit_card' },
  { id: 'debit_card' },
  { id: 'prepaid_card' },
  { id: 'ticket' },
  { id: 'bank_transfer' },
  { id: 'atm' },
];
// Versión mínima, de respaldo si Mercado Pago rechaza la lista completa.
const CARDS_CORE_EXCLUDES = [{ id: 'ticket' }];
const ACCOUNT_MONEY_CORE_EXCLUDES = [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'prepaid_card' }];

function splitName(fullName?: string) {
  if (!fullName || !fullName.trim()) return { first_name: undefined, last_name: undefined };
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts.shift();
  const last_name = parts.length > 0 ? parts.join(' ') : undefined;
  return { first_name, last_name };
}

export async function createMercadoPagoPreference(args: {
  accessToken: string;
  orderId: string;
  quote: CheckoutQuote;
  variant: 'tarjeta' | 'dinero';
  siteUrl: string;
  payer: { name?: string; email?: string; phone?: string };
}): Promise<{ preferenceId: string; initPoint: string }> {
  const { accessToken, orderId, quote, variant, siteUrl, payer } = args;

  const items: Record<string, unknown>[] = quote.lines.map((l) => ({
    id: l.product_id,
    title: (l.variant ? `${l.name} (${l.variant})` : l.name).slice(0, 250),
    quantity: l.quantity,
    unit_price: l.price,
    currency_id: 'ARS',
    picture_url: l.image || undefined,
  }));
  if (quote.shippingCost > 0) {
    items.push({ id: 'envio', title: 'Costo de envío', quantity: 1, unit_price: quote.shippingCost, currency_id: 'ARS' });
  }
  if (quote.surchargeAmount > 0) {
    items.push({
      id: 'recargo',
      title: `Recargo ${variant === 'dinero' ? 'Mercado Pago' : 'tarjetas'} (${quote.surchargePercent}%)`,
      quantity: 1,
      unit_price: quote.surchargeAmount,
      currency_id: 'ARS',
    });
  }

  const { first_name, last_name } = splitName(payer.name);
  const payload = {
    items,
    payer: {
      name: first_name,
      surname: last_name,
      email: payer.email || undefined,
      phone: payer.phone ? { number: payer.phone } : undefined,
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

  const send = async (excluded: { id: string }[]) => {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...payload, payment_methods: { excluded_payment_types: excluded } }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await send(variant === 'dinero' ? ONLY_ACCOUNT_MONEY_EXCLUDES : ONLY_CARDS_EXCLUDES);
  if (!res.ok) {
    console.error('Mercado Pago preference error (intento 1):', JSON.stringify(data));
    ({ res, data } = await send(variant === 'dinero' ? ACCOUNT_MONEY_CORE_EXCLUDES : CARDS_CORE_EXCLUDES));
  }
  if (!res.ok) {
    console.error('Mercado Pago preference error (intento 2):', JSON.stringify(data));
    const causes = Array.isArray(data?.cause)
      ? data.cause.map((c: { description?: string; code?: string | number }) => c.description || c.code).filter(Boolean)
      : [];
    const detail = [data?.message, ...causes].filter(Boolean).join(' · ') || `HTTP ${res.status}`;
    throw new CheckoutError(`No pudimos iniciar el pago con Mercado Pago. Probá nuevamente. (Detalle: ${detail})`, 502);
  }
  return { preferenceId: data.id, initPoint: data.init_point };
}

// -------------------------------------------------------------------- GoCuotas

// "API Redirect V1" - https://www.gocuotas.com/api_redirect_docs
const GOCUOTAS_BASE_URL = 'https://www.gocuotas.com/api_redirect/v1';

// La doc no muestra el nombre exacto del campo del token ni de la URL de
// redirección: se prueban los nombres más comunes.
const extractToken = (d: any): string | undefined => d?.token || d?.access_token || d?.auth_token || d?.jwt;
const extractInitUrl = (d: any): string | undefined => d?.url_init || d?.init_url || d?.url;

export async function createGoCuotasCheckout(args: {
  email: string;
  password: string;
  orderId: string;
  total: number;
  siteUrl: string;
  payer: { email?: string; phone?: string };
}): Promise<{ initUrl: string }> {
  const { email, password, orderId, total, siteUrl, payer } = args;

  const authUrl = new URL(`${GOCUOTAS_BASE_URL}/authentication`);
  authUrl.searchParams.set('email', email);
  authUrl.searchParams.set('password', password);
  const authRes = await fetch(authUrl.toString(), { method: 'POST' });
  const authRaw = await authRes.text();
  let authData: any = {};
  try {
    authData = JSON.parse(authRaw);
  } catch {
    // respuesta no JSON: se registra abajo
  }
  if (!authRes.ok) {
    console.error('GoCuotas authentication error:', authRes.status, authRaw.slice(0, 500));
    throw new CheckoutError('No pudimos autenticarnos con GoCuotas.', 502);
  }
  const token = extractToken(authData);
  if (!token) {
    console.error('Respuesta de autenticación inesperada de GoCuotas:', authData);
    throw new CheckoutError('Respuesta inesperada de GoCuotas al autenticar.', 502);
  }

  const checkoutRes = await fetch(`${GOCUOTAS_BASE_URL}/checkouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      amount_in_cents: Math.round(total * 100),
      url_success: `${siteUrl}/checkout/retorno?order=${orderId}`,
      url_failure: `${siteUrl}/checkout/retorno?order=${orderId}`,
      order_reference_id: orderId,
      webhook_url: `${siteUrl}/api/gocuotas/webhook`,
      email: payer.email || '',
      phone_number: payer.phone || '',
    }),
  });
  const checkoutData = await checkoutRes.json().catch(() => ({}));
  if (!checkoutRes.ok) {
    console.error('GoCuotas checkout creation error:', checkoutData);
    throw new CheckoutError('No pudimos iniciar el pago en cuotas con GoCuotas. Probá nuevamente.', 502);
  }
  const initUrl = extractInitUrl(checkoutData);
  if (!initUrl) {
    console.error('Respuesta de checkout inesperada de GoCuotas:', checkoutData);
    throw new CheckoutError('Respuesta inesperada de GoCuotas al crear el checkout.', 502);
  }
  return { initUrl };
}
