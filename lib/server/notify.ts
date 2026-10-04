import { getServerEnv } from './env';
import { sendPush } from './push';

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  mercadopago_tarjeta: 'Mercado Pago (tarjeta)',
  mercadopago_dinero: 'Mercado Pago (dinero en cuenta)',
  gocuotas: 'GoCuotas',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};

function formatMoney(value: unknown): string {
  const n = Number(value) || 0;
  try {
    return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  } catch {
    return '$' + Math.round(n);
  }
}

// Manda una notificación push (a los dispositivos donde la dueña activó los
// avisos desde el panel) por cada compra.
// - Solo avisa UNA vez por pedido (reclama orders.notified_at de forma atómica).
// - Nunca lanza errores: si algo falla, la compra sigue normal.
export async function notifyOrderOnce(supabaseAdmin: any, orderId: string) {
  let claimed = false;
  try {
    if (!(await getServerEnv('VAPID_PRIVATE_KEY'))) return;

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');
    if (subsError) {
      console.error('No se pudieron leer las suscripciones push:', subsError.message);
      return;
    }
    if (!subs || subs.length === 0) return; // nadie para avisar: no reservamos el pedido

    const { data: order, error: claimError } = await supabaseAdmin
      .from('orders')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('channel', 'online')
      .is('notified_at', null)
      .select('id, customer_name, total, payment_method, shipping_method, city, items')
      .maybeSingle();

    if (claimError) {
      console.error('No se pudo reservar el aviso del pedido:', claimError.message);
      return;
    }
    if (!order) return; // ya avisado, o no es un pedido online
    claimed = true;

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsText = items
      .slice(0, 6)
      .map((i: any) => `${i.quantity ?? 1}x ${i.name ?? 'Producto'}`)
      .join(', ');
    const extra = items.length > 6 ? ` y ${items.length - 6} más` : '';
    const entrega =
      order.shipping_method === 'envio'
        ? `Envío${order.city ? ' a ' + order.city : ''}`
        : 'Retiro en local';
    const pago = PAYMENT_LABELS[order.payment_method] ?? order.payment_method ?? '';

    const payload = {
      title: `Nueva compra: ${formatMoney(order.total)}`,
      body: `${order.customer_name}\n${itemsText}${extra}\n${pago} · ${entrega}`,
      url: '/admin/pedidos',
      tag: `order-${order.id}`,
    };

    const results = await Promise.all(subs.map((s: any) => sendPush(s, payload)));

    // Limpiar dispositivos que ya no existen.
    const gone = subs.filter((_: any, i: number) => results[i] === 'gone').map((s: any) => s.endpoint);
    if (gone.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', gone);
    }

    if (!results.includes('ok')) {
      throw new Error('Ningún dispositivo recibió el aviso');
    }
  } catch (err) {
    console.error('Error enviando el aviso de compra:', err);
    if (claimed) {
      // Liberar la reserva para que un reintento (ej. reenvío del webhook) pueda avisar.
      await supabaseAdmin.from('orders').update({ notified_at: null }).eq('id', orderId);
    }
  }
}
