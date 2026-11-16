'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Crown,
  FolderTree,
  Globe,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  PackageX,
  Receipt,
  RefreshCw,
  Sparkles,
  Store,
  Tag,
  Trophy,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { supabase, type Product, type Order } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { fetchAllRows } from '@/lib/fetch-all';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_ORDER_COLUMNS,
  buildDashboardStats,
  dayName,
  statsWindowStart,
  type DailyPoint,
  type DashboardOrder,
  type DashboardStats,
} from '@/lib/dashboard-stats';
import { PushNotificationsCard } from '@/components/admin/push-notifications-card';

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pendiente: 'outline',
  confirmado: 'secondary',
  enviado: 'default',
  entregado: 'default',
  cancelado: 'destructive',
};

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjetas',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  mercadopago_tarjeta: 'Tarjetas (Mercado Pago)',
  mercadopago_dinero: 'Mercado Pago (dinero en cuenta)',
  gocuotas: 'GoCuotas',
  otro: 'Otro',
  sin_dato: 'Sin dato',
};

const chartConfig: ChartConfig = {
  total: { label: 'Ventas', color: 'hsl(var(--chart-1))' },
};

type Pending = { pendientes: number; comprobantes: number; envios: number; comentarios: number; agotados: number };
type Catalog = { productos: number; categorias: number; enOferta: number; destacados: number };

const EMPTY_PENDING: Pending = { pendientes: 0, comprobantes: 0, envios: 0, comentarios: 0, agotados: 0 };
const EMPTY_CATALOG: Catalog = { productos: 0, categorias: 0, enOferta: 0, destacados: 0 };

// ---------- piezas chicas de UI ----------

function Delta({ pct, hasCurrent }: { pct: number | null; hasCurrent: boolean }) {
  if (pct === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {hasCurrent ? 'Sin datos para comparar' : 'Sin ventas todavía'}
      </span>
    );
  }
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> igual
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {Math.round(pct)}%
    </span>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  pct: number | null;
  hasCurrent: boolean;
  vs: string;
  hint: string;
  loading: boolean;
}) {
  const Icon = props.icon;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{props.label}</p>
            <p className="text-2xl font-bold truncate">{props.loading ? '-' : props.value}</p>
            <p className="text-xs text-muted-foreground">{props.loading ? '-' : props.sub}</p>
          </div>
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {!props.loading && (
          <div className="mt-3 flex items-center gap-1.5" title={props.hint}>
            <Delta pct={props.pct} hasCurrent={props.hasCurrent} />
            <span className="text-xs text-muted-foreground">{props.vs}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, sub, ratio }: { label: string; value: string; sub?: string; ratio: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-medium">
          {value}
          {sub && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{sub}</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function DailyTooltip({ active, payload }: { active?: boolean; payload?: { payload: DailyPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="text-muted-foreground">
        {formatPrice(p.total)} · {p.count} {p.count === 1 ? 'pedido' : 'pedidos'}
      </p>
    </div>
  );
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------- página ----------

export default function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [now, setNow] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<Pending>(EMPTY_PENDING);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const current = new Date();
      const windowStart = statsWindowStart(current);

      const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
      const head = { count: 'exact' as const, head: true };

      const [
        orders,
        pendientes,
        comprobantes,
        envios,
        comentarios,
        agotados,
        productos,
        categorias,
        enOferta,
        destacados,
        { data: low },
        { data: recent },
      ] = await Promise.all([
        fetchAllRows<DashboardOrder>(() =>
          supabase
            .from('orders')
            .select(DASHBOARD_ORDER_COLUMNS)
            .gte('created_at', windowStart.toISOString())
            .order('created_at')
            .order('id'),
        ),
        count(supabase.from('orders').select('id', head).eq('status', 'pendiente')),
        count(
          supabase
            .from('orders')
            .select('id', head)
            .eq('status', 'pendiente')
            .eq('payment_method', 'transferencia')
            .not('receipt_path', 'is', null),
        ),
        count(supabase.from('orders').select('id', head).eq('status', 'confirmado').eq('shipping_method', 'envio')),
        // Los comentarios los modera solo el dueño.
        isAdmin
          ? count(supabase.from('product_comments').select('id', head).eq('approved', false))
          : Promise.resolve(0),
        count(supabase.from('products').select('id', head).eq('stock', 0)),
        count(supabase.from('products').select('id', head)),
        count(supabase.from('categories').select('id', head)),
        count(supabase.from('products').select('id', head).eq('on_sale', true)),
        count(supabase.from('products').select('id', head).eq('featured', true)),
        supabase.from('products').select('*').lte('stock', 5).order('stock', { ascending: true }).limit(6),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
      ]);

      setNow(current);
      setStats(buildDashboardStats(orders, current));
      setPending({ pendientes, comprobantes, envios, comentarios, agotados });
      setCatalog({ productos, categorias, enOferta, destacados });
      setLowStock((low as Product[]) ?? []);
      setRecentOrders((recent as Order[]) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const dateText = now
    ? new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
    : '';

  const s = stats;
  const monthName = now ? new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(now) : '';

  const pendingRows = [
    { show: pending.pendientes > 0, n: pending.pendientes, icon: ClipboardList, text: 'pedidos esperando confirmación', href: '/admin/pedidos' },
    { show: pending.comprobantes > 0, n: pending.comprobantes, icon: Receipt, text: 'comprobantes de transferencia por revisar', href: '/admin/pedidos' },
    { show: pending.envios > 0, n: pending.envios, icon: Truck, text: 'envíos confirmados para despachar', href: '/admin/pedidos' },
    { show: isAdmin && pending.comentarios > 0, n: pending.comentarios, icon: MessageCircle, text: 'comentarios por aprobar', href: '/admin/comentarios' },
    { show: pending.agotados > 0, n: pending.agotados, icon: PackageX, text: 'productos agotados', href: '/admin/productos' },
  ].filter((r) => r.show);

  const maxWeekday = s ? Math.max(...s.weekdays.map((w) => w.avg), 0) : 0;
  const maxProductUnits = s?.topProducts[0]?.units ?? 0;
  const maxPayment = s?.payments[0]?.total ?? 0;
  const monthTotal = s?.month.current.total ?? 0;
  const onlineCount = s?.channels.online.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{now ? greeting : 'Dashboard'}</h1>
          <p className="text-muted-foreground">
            {now ? <span className="capitalize">{dateText}</span> : 'Resumen general de la tienda'}
            {now && ' · Así viene la tienda'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          No se pudieron cargar los datos. Probá de nuevo con el botón Actualizar.
        </div>
      )}

      <PushNotificationsCard />

      {/* Ventas: hoy, semana, mes y ticket promedio */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          value={formatPrice(s?.today.current.total ?? 0)}
          sub={plural(s?.today.current.count ?? 0, 'pedido', 'pedidos')}
          icon={Banknote}
          pct={s?.today.deltaPct ?? null}
          hasCurrent={(s?.today.current.count ?? 0) > 0}
          vs="vs. ayer"
          hint="Compara lo vendido hoy hasta ahora contra ayer a la misma hora"
          loading={!s}
        />
        <KpiCard
          label="Ventas de la semana"
          value={formatPrice(s?.week.current.total ?? 0)}
          sub={plural(s?.week.current.count ?? 0, 'pedido', 'pedidos')}
          icon={CalendarDays}
          pct={s?.week.deltaPct ?? null}
          hasCurrent={(s?.week.current.count ?? 0) > 0}
          vs="vs. semana pasada"
          hint="Desde el lunes hasta ahora, contra el mismo tramo de la semana pasada"
          loading={!s}
        />
        <KpiCard
          label="Ventas del mes"
          value={formatPrice(s?.month.current.total ?? 0)}
          sub={plural(s?.month.current.count ?? 0, 'pedido', 'pedidos')}
          icon={CalendarRange}
          pct={s?.month.deltaPct ?? null}
          hasCurrent={(s?.month.current.count ?? 0) > 0}
          vs="vs. mes pasado"
          hint="Desde el día 1 hasta hoy, contra el mismo tramo del mes pasado"
          loading={!s}
        />
        <KpiCard
          label="Ticket promedio del mes"
          value={formatPrice(s?.ticket.current ?? 0)}
          sub="por pedido"
          icon={Receipt}
          pct={s?.ticket.deltaPct ?? null}
          hasCurrent={(s?.month.current.count ?? 0) > 0}
          vs="vs. mes pasado"
          hint="Lo que gasta en promedio cada cliente por pedido, contra el mismo tramo del mes pasado"
          loading={!s}
        />
      </div>

      {/* Gráfico + pendientes */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ventas de los últimos 30 días</CardTitle>
            <CardDescription>Pasá el dedo o el mouse por una barra para ver el detalle del día.</CardDescription>
          </CardHeader>
          <CardContent>
            {s ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={s.daily} margin={{ left: 0, right: 0, top: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={32}
                    tickFormatter={(v: string) => v.slice(4)}
                  />
                  <YAxis hide />
                  <ChartTooltip cursor={false} content={<DailyTooltip />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Para hacer ahora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!loading && pendingRows.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Todo al día, no hay nada pendiente.
              </div>
            )}
            {pendingRows.map((r) => (
              <Link
                key={r.text}
                href={r.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors"
              >
                <r.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="font-semibold">{r.n}</span> {r.text}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Qué se vende y cómo te pagan */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Lo más vendido
            </CardTitle>
            <CardDescription className="capitalize">{monthName ? `${monthName}, por unidades` : ' '}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {s && s.topProducts.length === 0 && <Empty>Todavía no hay ventas este mes.</Empty>}
            {s?.topProducts.map((p, i) => (
              <BarRow
                key={p.key}
                label={`${i + 1}. ${p.name}`}
                value={plural(p.units, 'u.', 'u.')}
                sub={formatPrice(p.revenue)}
                ratio={share(p.units, maxProductUnits)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Cómo te pagan
            </CardTitle>
            <CardDescription className="capitalize">{monthName ? `${monthName}, por monto` : ' '}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {s && s.payments.length === 0 && <Empty>Todavía no hay ventas este mes.</Empty>}
            {s?.payments.map((p) => (
              <BarRow
                key={p.key}
                label={PAYMENT_LABEL[p.key] ?? p.key}
                value={formatPrice(p.total)}
                sub={plural(p.count, 'pedido', 'pedidos')}
                ratio={share(p.total, maxPayment)}
              />
            ))}
            {s && s.surchargeMonth > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Las ventas incluyen {formatPrice(s.surchargeMonth)} de recargos por medio de pago.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Dónde y cómo te compran
            </CardTitle>
            <CardDescription className="capitalize">{monthName ? `${monthName}` : ' '}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {s && monthTotal === 0 && <Empty>Todavía no hay ventas este mes.</Empty>}
            {s && monthTotal > 0 && (
              <>
                <BarRow
                  label="Online"
                  value={formatPrice(s.channels.online.total)}
                  sub={plural(s.channels.online.count, 'pedido', 'pedidos')}
                  ratio={share(s.channels.online.total, monthTotal)}
                />
                <BarRow
                  label="Mostrador"
                  value={formatPrice(s.channels.mostrador.total)}
                  sub={plural(s.channels.mostrador.count, 'venta', 'ventas')}
                  ratio={share(s.channels.mostrador.total, monthTotal)}
                />
                {onlineCount > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Entrega de los pedidos online
                    </p>
                    <BarRow
                      label="Retiro en el local"
                      value={plural(s.delivery.retiro.count, 'pedido', 'pedidos')}
                      ratio={share(s.delivery.retiro.count, onlineCount)}
                    />
                    <BarRow
                      label="Envío a domicilio"
                      value={plural(s.delivery.envio.count, 'pedido', 'pedidos')}
                      ratio={share(s.delivery.envio.count, onlineCount)}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Días fuertes, curiosidades y stock */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Qué días vendés más
            </CardTitle>
            <CardDescription>Promedio por día, últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {s && !s.bestWeekday && <Empty>Todavía no hay suficientes ventas para comparar.</Empty>}
            {s?.bestWeekday &&
              s.weekdays.map((w) => (
                <BarRow key={w.day} label={w.label} value={formatPrice(w.avg)} ratio={share(w.avg, maxWeekday)} />
              ))}
            {s?.bestWeekday && (
              <p className="pt-1 text-xs text-muted-foreground">
                Tu día más fuerte es el <span className="font-medium text-foreground">{dayName(s.bestWeekday.day).toLowerCase()}</span>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Curiosidades del mes
            </CardTitle>
            <CardDescription className="capitalize">{monthName || ' '}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {s && !s.bestDay && <Empty>Cuando haya ventas este mes, acá vas a ver tus récords.</Empty>}
            {s?.bestDay && (
              <div className="flex items-start gap-3">
                <CalendarRange className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Mejor día</p>
                  <p className="font-medium">
                    {dayName(s.bestDay.date.getDay())} {s.bestDay.date.getDate()}: {formatPrice(s.bestDay.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">{plural(s.bestDay.count, 'pedido', 'pedidos')}</p>
                </div>
              </div>
            )}
            {s?.biggestOrder && (
              <div className="flex items-start gap-3">
                <Crown className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Pedido más grande</p>
                  <p className="font-medium">{formatPrice(s.biggestOrder.amount)}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.biggestOrder.customer_name}</p>
                </div>
              </div>
            )}
            {s?.topProducts[0] && (
              <div className="flex items-start gap-3">
                <Trophy className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Producto estrella</p>
                  <p className="font-medium truncate">{s.topProducts[0].name}</p>
                  <p className="text-xs text-muted-foreground">{plural(s.topProducts[0].units, 'unidad vendida', 'unidades vendidas')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Stock bajo
            </CardTitle>
            <CardDescription>
              {pending.agotados > 0 ? `${plural(pending.agotados, 'producto agotado', 'productos agotados')}` : 'Productos con 5 unidades o menos'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && lowStock.length === 0 && <Empty>No hay productos con stock bajo.</Empty>}
            {lowStock.map((p) => (
              <Link
                key={p.id}
                href="/admin/productos"
                className="flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors"
              >
                <span className="truncate">{p.name}</span>
                <Badge variant={p.stock === 0 ? 'destructive' : 'outline'} className="shrink-0">
                  {p.stock === 0 ? 'Agotado' : `${p.stock} en stock`}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Últimos pedidos + catálogo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimos pedidos</CardTitle>
            <Link href="/admin/pedidos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && recentOrders.length === 0 && <Empty>Todavía no hay pedidos.</Empty>}
            {recentOrders.map((o) => (
              <Link
                key={o.id}
                href="/admin/pedidos"
                className="flex items-center justify-between gap-2 text-sm rounded-lg hover:bg-muted/60 transition-colors -mx-2 px-2 py-1"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.created_at)} · {o.channel === 'mostrador' ? 'Mostrador' : 'Online'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{formatPrice(o.total)}</span>
                  <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu catálogo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: 'Productos', value: catalog.productos, icon: Package, href: '/admin/productos' },
              { label: 'Categorías', value: catalog.categorias, icon: FolderTree, href: '/admin/categorias' },
              { label: 'En oferta', value: catalog.enOferta, icon: Tag, href: '/admin/productos' },
              { label: 'Destacados', value: catalog.destacados, icon: Sparkles, href: '/admin/productos' },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="rounded-lg border p-3 hover:border-primary/50 transition-colors"
              >
                <t.icon className="h-4 w-4 text-primary mb-2" />
                <p className="text-xl font-bold">{!s ? '-' : t.value}</p>
                <p className="text-xs text-muted-foreground">{t.label}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
