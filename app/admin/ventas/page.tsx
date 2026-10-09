'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  X,
  ShoppingBag,
  Package,
  Banknote,
  CreditCard,
  Landmark,
  Wallet,
  Printer,
  Receipt,
  CircleCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase, type Product, type Category, type Order } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { fetchSurcharges, type SurchargeMap } from '@/lib/surcharges';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type CartLine = { product: Product; quantity: number };

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia', icon: Landmark },
  { value: 'otro', label: 'Otro', icon: Wallet },
];

const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((p) => [p.value, p.label])
);

const VISIBLE_LIMIT = 60;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printReceipt(sale: Order) {
  const win = window.open('', '_blank', 'width=380,height=640');
  if (!win) return;

  const rows = sale.items
    .map(
      (i) => `
      <tr>
        <td>${i.quantity}x ${escapeHtml(i.name)}</td>
        <td style="text-align:right; white-space:nowrap;">${formatPrice(i.price * i.quantity)}</td>
      </tr>`
    )
    .join('');

  win.document.write(`
    <html>
      <head>
        <title>Comprobante</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 20px; width: 300px; color: #111; }
          h2 { text-align: center; margin: 0 0 2px; letter-spacing: 0.5px; }
          p.sub { text-align: center; margin: 0 0 14px; color: #555; font-size: 12px; }
          .meta { font-size: 12px; color: #333; margin-bottom: 12px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { padding: 3px 0; vertical-align: top; }
          .total-row td { border-top: 1px dashed #111; font-weight: bold; padding-top: 8px; font-size: 15px; }
          .footer { text-align: center; margin-top: 18px; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        <h2>Todo y Más</h2>
        <p class="sub">Comprobante de venta</p>
        <div class="meta">
          Fecha: ${formatDate(sale.created_at)}<br/>
          ${sale.customer_name ? `Cliente: ${escapeHtml(sale.customer_name)}<br/>` : ''}
          Pago: ${PAYMENT_LABEL[sale.payment_method ?? ''] ?? sale.payment_method ?? '-'}
        </div>
        <table>
          ${rows}
          ${
            Number(sale.surcharge_amount) > 0
              ? `<tr><td>Recargo</td><td style="text-align:right;">${formatPrice(sale.surcharge_amount)}</td></tr>`
              : ''
          }
          <tr class="total-row"><td>Total</td><td style="text-align:right;">${formatPrice(sale.total)}</td></tr>
        </table>
        <p class="footer">¡Gracias por su compra!</p>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export default function VentasPage() {
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [lastSale, setLastSale] = useState<Order | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  const [surcharges, setSurcharges] = useState<SurchargeMap>({});

  async function loadData() {
    setLoading(true);
    const [{ data: prods }, { data: cats }, rates] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      fetchSurcharges(),
    ]);
    setProducts((prods as Product[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setSurcharges(rates);
    setLoading(false);
  }

  async function loadTodayStats() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('orders')
      .select('total')
      .eq('channel', 'mostrador')
      .gte('created_at', start.toISOString());
    const list = data ?? [];
    setTodayCount(list.length);
    setTodayTotal(list.reduce((sum, o) => sum + Number(o.total ?? 0), 0));
  }

  useEffect(() => {
    loadData();
    loadTodayStats();
  }, []);

  const parentCategories = categories.filter((c) => !c.parent_id);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !term || p.name.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === 'todos' || p.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const visibleProducts = filteredProducts.slice(0, VISIBLE_LIMIT);

  const cartQtyFor = (productId: string) =>
    cart.find((l) => l.product.id === productId)?.quantity ?? 0;

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      toast({
        title: 'Sin stock',
        description: `"${product.name}" no tiene unidades disponibles.`,
        variant: 'destructive',
      });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({
            title: 'Stock máximo alcanzado',
            description: `Solo quedan ${product.stock} unidades de "${product.name}".`,
            variant: 'destructive',
          });
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== productId) return [l];
        const next = l.quantity + delta;
        if (next <= 0) return [];
        if (next > l.product.stock) {
          toast({
            title: 'Stock máximo alcanzado',
            description: `Solo quedan ${l.product.stock} unidades disponibles.`,
            variant: 'destructive',
          });
          return [l];
        }
        return [{ ...l, quantity: next }];
      })
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        addToCart(filteredProducts[0]);
        setSearch('');
      }
    } else if (e.key === 'Escape') {
      setSearch('');
    }
  }

  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const discountNum = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  // El servidor recalcula este recargo al registrar la venta; acá es solo
  // para mostrarle al vendedor cuánto va a cobrar.
  const surchargePercent = surcharges[`mostrador_${paymentMethod}`] ?? 0;
  const surchargeAmount = Math.round((subtotal - discountNum) * (surchargePercent / 100) * 100) / 100;
  const total = subtotal - discountNum + surchargeAmount;
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  async function handleConfirm() {
    if (cart.length === 0) return;
    setSubmitting(true);

    const payloadItems = cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity }));

    const { data, error } = await supabase.rpc('register_counter_sale', {
      p_items: payloadItems,
      p_payment_method: paymentMethod,
      p_customer_name: customerName.trim() || null,
      p_notes: notes.trim() || null,
      p_discount: discountNum,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: 'No se pudo registrar la venta', description: error.message, variant: 'destructive' });
      return;
    }

    const sale = data as Order;

    setProducts((prev) =>
      prev.map((p) => {
        const line = cart.find((l) => l.product.id === p.id);
        return line ? { ...p, stock: Math.max(p.stock - line.quantity, 0) } : p;
      })
    );

    setTodayCount((c) => c + 1);
    setTodayTotal((t) => t + Number(sale.total));

    setCart([]);
    setCustomerName('');
    setNotes('');
    setDiscount('');
    setMobileCartOpen(false);
    setLastSale(sale);
  }

  function stockBadgeVariant(stock: number) {
    if (stock === 0) return 'destructive' as const;
    if (stock <= 5) return 'outline' as const;
    return 'secondary' as const;
  }

  function renderCartContents() {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
              <ShoppingBag className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Todavía no agregaste productos.</p>
              <p className="text-xs">Tocá un producto de la lista para sumarlo.</p>
            </div>
          )}
          {cart.map((line) => (
            <div key={line.product.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{line.product.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(line.product.price)} c/u</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changeQty(line.product.id, -1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changeQty(line.product.id, 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-right shrink-0 w-20">
                <p className="text-sm font-semibold">{formatPrice(line.product.price * line.quantity)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(line.product.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-3 border-t mt-3 shrink-0">
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pago</Label>
            <ToggleGroup
              type="single"
              value={paymentMethod}
              onValueChange={(v) => v && setPaymentMethod(v)}
              className="grid grid-cols-4 gap-1.5 w-full"
            >
              {PAYMENT_METHODS.map((m) => (
                <ToggleGroupItem
                  key={m.value}
                  value={m.value}
                  className="flex-col h-auto py-2 gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg border"
                >
                  <m.icon className="h-4 w-4" />
                  <span className="text-[10px] leading-none">{m.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente (opcional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Consumidor final"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descuento ($)</Label>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: pagó con billete de $50.000"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discountNum > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Descuento</span>
                <span>-{formatPrice(discountNum)}</span>
              </div>
            )}
            {surchargePercent > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Recargo {PAYMENT_LABEL[paymentMethod]?.toLowerCase()} ({surchargePercent}%)</span>
                <span>+{formatPrice(surchargeAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold pt-1">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={cart.length === 0 || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Registrando...' : `Registrar venta · ${formatPrice(total)}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:pb-0 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Venta en mostrador</h1>
          <p className="text-muted-foreground">Registrá ventas hechas en el local</p>
        </div>
        <div className="flex gap-3">
          <Card className="border-dashed">
            <CardContent className="py-2.5 px-4 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <div className="text-sm">
                <span className="font-semibold">{todayCount}</span>{' '}
                <span className="text-muted-foreground">
                  venta{todayCount === 1 ? '' : 's'} hoy
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-2.5 px-4 text-sm">
              <span className="text-muted-foreground">Total hoy: </span>
              <span className="font-semibold">{formatPrice(todayTotal)}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        <div className="space-y-4 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar producto por nombre... (Enter agrega el primero)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 h-11 text-base"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('todos')}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                categoryFilter === 'todos'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              Todos
            </button>
            {parentCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  categoryFilter === c.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {loading && <p className="text-center text-muted-foreground py-10">Cargando productos...</p>}

          {!loading && visibleProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-10">No se encontraron productos.</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleProducts.map((p) => {
              const qty = cartQtyFor(p.id);
              const outOfStock = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={outOfStock}
                  className={cn(
                    'relative text-left rounded-xl border bg-card p-2.5 transition-all hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-50 disabled:pointer-events-none'
                  )}
                >
                  {qty > 0 && (
                    <span className="absolute -top-2 -right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-soft">
                      {qty}
                    </span>
                  )}
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 flex items-center justify-center">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">{p.name}</p>
                  <div className="flex items-center justify-between mt-1.5 gap-1">
                    <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                    <Badge variant={stockBadgeVariant(p.stock)} className="text-[10px] px-1.5 py-0">
                      {outOfStock ? 'Sin stock' : p.stock}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length > visibleProducts.length && (
            <p className="text-center text-xs text-muted-foreground">
              Mostrando {visibleProducts.length} de {filteredProducts.length}. Refiná la búsqueda para ver más.
            </p>
          )}
        </div>

        <aside className="hidden lg:block sticky top-6">
          <Card className="h-[calc(100vh-140px)] flex flex-col">
            <CardContent className="pt-5 flex-1 flex flex-col min-h-0">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Venta actual
                {itemCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {itemCount} ítem{itemCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </h2>
              {renderCartContents()}
            </CardContent>
          </Card>
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-card p-3 flex items-center justify-between gap-3 shadow-soft-lg">
          <div>
            <p className="text-xs text-muted-foreground">
              {itemCount} producto{itemCount === 1 ? '' : 's'}
            </p>
            <p className="font-bold text-lg leading-tight">{formatPrice(total)}</p>
          </div>
          <Button onClick={() => setMobileCartOpen(true)}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Ver carrito
          </Button>
        </div>
      )}

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[88vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Venta actual</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 mt-2">{renderCartContents()}</div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!lastSale} onOpenChange={(open) => !open && setLastSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-success" />
              Venta registrada
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Total cobrado</p>
                <p className="text-3xl font-bold">{formatPrice(lastSale.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {PAYMENT_LABEL[lastSale.payment_method ?? ''] ?? lastSale.payment_method}
                  {Number(lastSale.surcharge_amount) > 0 && ` · incluye recargo de ${formatPrice(lastSale.surcharge_amount)}`}
                </p>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                {lastSale.items.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between text-muted-foreground">
                    <span>
                      {i.quantity}x {i.name}
                    </span>
                    <span>{formatPrice(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button variant="outline" className="w-full" onClick={() => lastSale && printReceipt(lastSale)}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir comprobante
            </Button>
            <Button className="w-full" onClick={() => setLastSale(null)}>
              Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
