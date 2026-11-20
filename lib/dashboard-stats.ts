import type { Order, OrderItem } from './supabase';

// Columnas de `orders` que necesita el dashboard (se piden solo estas para
// no traer de más).
export const DASHBOARD_ORDER_COLUMNS =
  'id, customer_name, total, status, created_at, channel, payment_method, payment_status, shipping_method, shipping_cost, surcharge_amount, items';

export type DashboardOrder = Pick<
  Order,
  | 'id'
  | 'customer_name'
  | 'total'
  | 'status'
  | 'created_at'
  | 'channel'
  | 'payment_method'
  | 'payment_status'
  | 'shipping_method'
  | 'surcharge_amount'
  | 'items'
> & { shipping_cost?: number | null };

export type Sale = DashboardOrder & { ts: number; amount: number };

export type Period = { total: number; count: number };

export type Comparison = {
  current: Period;
  previous: Period;
  // Variación % contra el mismo tramo del período anterior. null si el
  // período anterior no tuvo ventas (no se puede calcular un porcentaje).
  deltaPct: number | null;
};

export type DailyPoint = { key: string; label: string; total: number; count: number };
export type WeekdayPoint = { day: number; label: string; avg: number; total: number; count: number };
export type TopProduct = { key: string; name: string; units: number; revenue: number };
export type BreakdownRow = { key: string; total: number; count: number };

export type DashboardStats = {
  today: Comparison;
  week: Comparison;
  month: Comparison;
  ticket: { current: number; previous: number; deltaPct: number | null };
  daily: DailyPoint[];
  weekdays: WeekdayPoint[];
  bestWeekday: WeekdayPoint | null;
  topProducts: TopProduct[];
  payments: BreakdownRow[];
  surchargeMonth: number;
  channels: { online: Period; mostrador: Period };
  delivery: { retiro: Period; envio: Period };
  bestDay: { date: Date; total: number; count: number } | null;
  biggestOrder: Sale | null;
};

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes a domingo

export const dayName = (d: number) => DAY_LONG[d];

// ---- fechas (hora local del navegador) ----

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Lunes 00:00 de la semana de `d`.
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Desde cuándo hay que traer pedidos para poder calcular todo lo del
// dashboard (mes anterior completo, semana anterior y últimos 30 días).
export function statsWindowStart(now: Date): Date {
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevWeek = addDays(startOfWeek(now), -7);
  const last30 = addDays(startOfDay(now), -30);
  return new Date(Math.min(prevMonth.getTime(), prevWeek.getTime(), last30.getTime()));
}

// ---- ventas ----

// Una "venta" es un pedido no cancelado y cuyo pago no fue rechazado. El
// costo de envío no cuenta como venta: es plata que se le paga a Correo.
export function toSales(orders: DashboardOrder[]): Sale[] {
  return orders
    .filter((o) => o.status !== 'cancelado' && o.payment_status !== 'rechazado')
    .map((o) => ({
      ...o,
      ts: new Date(o.created_at).getTime(),
      amount: Number(o.total ?? 0) - Number(o.shipping_cost ?? 0),
    }));
}

function sumRange(sales: Sale[], fromMs: number, toMs: number): Period {
  let total = 0;
  let count = 0;
  for (const s of sales) {
    if (s.ts >= fromMs && s.ts < toMs) {
      total += s.amount;
      count += 1;
    }
  }
  return { total, count };
}

export function pct(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

// Compara "lo que va" del período actual contra el mismo tramo del anterior
// (ej.: lunes a miércoles de esta semana vs lunes a miércoles de la pasada),
// para no comparar una semana a medias contra una semana completa.
function compare(sales: Sale[], start: Date, now: Date, prevStart: Date, prevCap: Date): Comparison {
  const elapsed = now.getTime() - start.getTime();
  const prevEnd = Math.min(prevStart.getTime() + elapsed, prevCap.getTime());
  const current = sumRange(sales, start.getTime(), now.getTime() + 1);
  const previous = sumRange(sales, prevStart.getTime(), prevEnd);
  return { current, previous, deltaPct: pct(current.total, previous.total) };
}

function itemsOf(s: Sale): OrderItem[] {
  return Array.isArray(s.items) ? s.items : [];
}

export function buildDashboardStats(orders: DashboardOrder[], now: Date = new Date()): DashboardStats {
  const sales = toSales(orders);

  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const today = compare(sales, todayStart, now, addDays(todayStart, -1), todayStart);
  const week = compare(sales, weekStart, now, addDays(weekStart, -7), weekStart);
  const month = compare(sales, monthStart, now, prevMonthStart, monthStart);

  const avg = (p: Period) => (p.count > 0 ? p.total / p.count : 0);
  const ticket = {
    current: avg(month.current),
    previous: avg(month.previous),
    deltaPct: month.previous.count > 0 && month.current.count > 0 ? pct(avg(month.current), avg(month.previous)) : null,
  };

  // Últimos 30 días (incluye hoy), un punto por día aunque no haya ventas.
  const dailyMap = new Map<string, DailyPoint>();
  const dailyDates: Date[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(todayStart, -i);
    dailyDates.push(d);
    dailyMap.set(dayKey(d), {
      key: dayKey(d),
      label: `${DAY_SHORT[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      total: 0,
      count: 0,
    });
  }
  const firstDayMs = dailyDates[0].getTime();
  for (const s of sales) {
    if (s.ts < firstDayMs) continue;
    const point = dailyMap.get(dayKey(new Date(s.ts)));
    if (point) {
      point.total += s.amount;
      point.count += 1;
    }
  }
  const daily = Array.from(dailyMap.values());

  // Promedio de ventas por día de la semana, sin contar hoy (que está a medias).
  const wd = new Map<number, { total: number; count: number; days: number }>();
  WEEK_ORDER.forEach((d) => wd.set(d, { total: 0, count: 0, days: 0 }));
  dailyDates.slice(0, -1).forEach((d, i) => {
    const acc = wd.get(d.getDay())!;
    acc.days += 1;
    acc.total += daily[i].total;
    acc.count += daily[i].count;
  });
  const weekdays: WeekdayPoint[] = WEEK_ORDER.map((d) => {
    const acc = wd.get(d)!;
    return { day: d, label: DAY_SHORT[d], total: acc.total, count: acc.count, avg: acc.days > 0 ? acc.total / acc.days : 0 };
  });
  const bestWeekday = weekdays.reduce<WeekdayPoint | null>(
    (best, w) => (w.avg > 0 && (!best || w.avg > best.avg) ? w : best),
    null,
  );

  // Todo lo que sigue es del mes en curso.
  const monthSales = sales.filter((s) => s.ts >= monthStart.getTime() && s.ts <= now.getTime());

  const products = new Map<string, TopProduct>();
  for (const s of monthSales) {
    for (const it of itemsOf(s)) {
      const key = it.product_id ?? `name:${it.name}`;
      const qty = Number(it.quantity ?? 0);
      const row = products.get(key) ?? { key, name: it.name, units: 0, revenue: 0 };
      row.units += qty;
      row.revenue += qty * Number(it.price ?? 0);
      products.set(key, row);
    }
  }
  const topProducts = Array.from(products.values())
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 5);

  const pay = new Map<string, BreakdownRow>();
  let surchargeMonth = 0;
  const channels = { online: { total: 0, count: 0 }, mostrador: { total: 0, count: 0 } };
  const delivery = { retiro: { total: 0, count: 0 }, envio: { total: 0, count: 0 } };
  const byDay = new Map<string, { date: Date; total: number; count: number }>();
  let biggestOrder: Sale | null = null;

  for (const s of monthSales) {
    const method = s.payment_method ?? 'sin_dato';
    const row = pay.get(method) ?? { key: method, total: 0, count: 0 };
    row.total += s.amount;
    row.count += 1;
    pay.set(method, row);

    surchargeMonth += Number(s.surcharge_amount ?? 0);

    const ch = s.channel === 'mostrador' ? channels.mostrador : channels.online;
    ch.total += s.amount;
    ch.count += 1;

    if (s.channel !== 'mostrador') {
      const dl = s.shipping_method === 'envio' ? delivery.envio : delivery.retiro;
      dl.total += s.amount;
      dl.count += 1;
    }

    const date = startOfDay(new Date(s.ts));
    const k = dayKey(date);
    const d = byDay.get(k) ?? { date, total: 0, count: 0 };
    d.total += s.amount;
    d.count += 1;
    byDay.set(k, d);

    if (!biggestOrder || s.amount > biggestOrder.amount) biggestOrder = s;
  }

  const payments = Array.from(pay.values()).sort((a, b) => b.total - a.total);
  const bestDay = Array.from(byDay.values()).reduce<{ date: Date; total: number; count: number } | null>(
    (best, d) => (!best || d.total > best.total ? d : best),
    null,
  );

  return {
    today,
    week,
    month,
    ticket,
    daily,
    weekdays,
    bestWeekday,
    topProducts,
    payments,
    surchargeMonth,
    channels,
    delivery,
    bestDay,
    biggestOrder,
  };
}
