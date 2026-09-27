'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, Truck, Store, CreditCard, Lock, Landmark, Banknote, Loader2 } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { OrganicBlob, LeafScatter, LeafSprig, Bloom } from '@/components/decorative-plants';
import { useCart, cartLineKey } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { WHATSAPP_NUMBER } from '@/lib/contact';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_method: 'retiro',
    address: '',
    city: '',
    province: 'Mendoza',
    postal_code: '',
    notes: '',
    payment_method: 'mercadopago',
  });

  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [shippingService, setShippingService] = useState('Correo Argentino');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const ARGENTINE_PROVINCES = [
    'Buenos Aires',
    'Ciudad Autónoma de Buenos Aires',
    'Catamarca',
    'Chaco',
    'Chubut',
    'Córdoba',
    'Corrientes',
    'Entre Ríos',
    'Formosa',
    'Jujuy',
    'La Pampa',
    'La Rioja',
    'Mendoza',
    'Misiones',
    'Neuquén',
    'Río Negro',
    'Salta',
    'San Juan',
    'San Luis',
    'Santa Cruz',
    'Santa Fe',
    'Santiago del Estero',
    'Tierra del Fuego',
    'Tucumán',
  ];

  const fetchShippingCost = async (cp: string, currentItems: typeof items) => {
    if (!cp || cp.trim().length < 4) return;
    setCalculatingShipping(true);
    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode: cp, items: currentItems }),
      });
      const data = await res.json();
      if (data.success) {
        setShippingCost(data.cost);
        if (data.service) setShippingService(data.service);
      }
    } catch (err) {
      console.error('Error fetching shipping:', err);
    } finally {
      setCalculatingShipping(false);
    }
  };

  const actualShippingCost = form.shipping_method === 'envio' ? (shippingCost ?? 0) : 0;
  const grandTotal = total + actualShippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setProcessing(true);
    setError(null);
    setPaymentError(null);

    try {
      const orderItems = items.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        image: i.variant?.image_url || i.product.images[0] || '',
        variant: i.variant ? `${i.variant.group_name}: ${i.variant.label}` : undefined,
      }));

      const newOrderId = crypto.randomUUID();
      const baseOrder = {
        id: newOrderId,
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        status: 'pendiente',
        payment_method: form.payment_method,
        payment_status: 'pendiente',
        shipping_method: form.shipping_method,
        address: form.shipping_method === 'envio' ? `${form.address}, ${form.city}, ${form.province} (CP: ${form.postal_code})` : null,
        city: form.shipping_method === 'envio' ? `${form.city} (${form.province})` : null,
        notes: form.notes || null,
        total: grandTotal,
        items: orderItems,
      };

      if (form.payment_method === 'mercadopago') {
        // 1. Create the Mercado Pago preference BEFORE inserting the order,
        // so we can store its id and only redirect if it actually succeeded.
        const prefRes = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: newOrderId,
            items: orderItems,
            shippingCost: actualShippingCost,
            payer: {
              name: form.customer_name,
              email: form.customer_email || undefined,
              phone: form.customer_phone || undefined,
            },
          }),
        });
        const prefData = await prefRes.json();

        if (!prefRes.ok || !prefData.success) {
          setPaymentError(
            prefData.error || 'No pudimos iniciar el pago con Mercado Pago. Probá con transferencia o efectivo.'
          );
          setProcessing(false);
          return;
        }

        const { error: insertError } = await supabase.from('orders').insert({
          ...baseOrder,
          mp_preference_id: prefData.preferenceId,
        });
        if (insertError) throw insertError;

        clearCart();
        window.location.href = prefData.initPoint;
        return;
      }

      if (form.payment_method === 'gocuotas') {
        // Same pattern as Mercado Pago: create the checkout BEFORE inserting
        // the order, and only redirect if GoCuotas actually gave us a url.
        const checkoutRes = await fetch('/api/gocuotas/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: newOrderId,
            amount: grandTotal,
            payer: {
              email: form.customer_email || undefined,
              phone: form.customer_phone || undefined,
            },
          }),
        });
        const checkoutData = await checkoutRes.json();

        if (!checkoutRes.ok || !checkoutData.success) {
          setPaymentError(
            checkoutData.error || 'No pudimos iniciar el pago en cuotas con GoCuotas. Probá con otro método.'
          );
          setProcessing(false);
          return;
        }

        const { error: insertError } = await supabase.from('orders').insert(baseOrder);
        if (insertError) throw insertError;

        clearCart();
        window.location.href = checkoutData.initUrl;
        return;
      }

      const { error: insertError } = await supabase.from('orders').insert(baseOrder);
      if (insertError) throw insertError;

      // Aviso al celular de la dueña (no bloquea ni rompe la compra si falla)
      fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: newOrderId }),
        keepalive: true,
      }).catch(() => {});

      setOrderId(newOrderId);
      setSuccess(true);
      clearCart();
    } catch (err) {
      setError('Ocurrió un error al procesar el pedido. Intentá nuevamente.');
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <StoreLayout>
        <div className="relative overflow-hidden bg-grain bg-brand-sand/45">
          <OrganicBlob className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 text-primary opacity-15 animate-drift sm:-right-32 sm:-top-32 sm:h-96 sm:w-96" />
          <LeafScatter className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 text-accent opacity-20 sm:-left-24 sm:h-72 sm:w-72" />
          <Bloom className="pointer-events-none absolute right-8 bottom-10 h-16 w-16 text-accent opacity-25 sm:right-16 sm:h-24 sm:w-24" />
          <Bloom className="pointer-events-none absolute left-1/2 -top-4 h-12 w-12 text-primary opacity-15 hidden sm:block" />
          <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-md mx-auto text-center">
            <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-success/10 mb-6">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">¡Pedido realizado!</h1>
            <p className="text-muted-foreground mb-1">
              Tu pedido se registró correctamente.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Número de pedido: <span className="font-mono font-medium text-foreground">{orderId?.slice(0, 8)}</span>
            </p>
            <div className="rounded-3xl border border-border bg-card p-4 text-left mb-6 shadow-soft space-y-2">
              <p className="text-sm text-muted-foreground">Nos contactaremos a la brevedad para coordinar {form.shipping_method === 'retiro' ? 'el retiro en nuestro local' : 'la entrega'}.</p>
              {form.payment_method === 'transferencia' && (
                <p className="text-sm text-muted-foreground">
                  Te vamos a enviar los datos bancarios por WhatsApp para que puedas transferir.
                </p>
              )}
              {form.payment_method === 'efectivo' && (
                <p className="text-sm text-muted-foreground">
                  Recordá que el pago es en efectivo al momento de retirar tu pedido.
                </p>
              )}
            </div>
            {form.payment_method === 'transferencia' && (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Hola! Hice el pedido ${orderId?.slice(0, 8)} y quiero coordinar la transferencia.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mb-3"
              >
                <Button size="lg" variant="outline" className="w-full">
                  Coordinar transferencia por WhatsApp
                </Button>
              </a>
            )}
            <Link href="/catalogo">
              <Button size="lg" className="w-full">
                Seguir comprando
              </Button>
            </Link>
          </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-medium mb-2">No hay productos en el carrito</p>
          <Link href="/catalogo">
            <Button className="mt-4">Ir al catálogo</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-brand-sand/45">
        <LeafSprig className="pointer-events-none absolute -top-3 right-2 h-20 w-12 text-primary opacity-[0.08] rotate-12 sm:-top-6 sm:right-8 sm:h-32 sm:w-20" />
        <LeafSprig className="pointer-events-none absolute -bottom-6 -left-3 h-24 w-14 text-accent opacity-[0.06] -rotate-[15deg] hidden md:block md:h-36 md:w-20" />
        <div className="container mx-auto px-4 py-8 relative">
        <Link href="/carrito" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver al carrito
        </Link>

        <h1 className="text-2xl font-bold mb-6">Finalizar compra</h1>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact info */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Datos de contacto</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre y apellido *</Label>
                  <Input
                    id="name"
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    required
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="11-5555-1234"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  placeholder="juan@email.com"
                />
              </div>
            </div>

            {/* Shipping method */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Método de envío</h2>
              <RadioGroup
                value={form.shipping_method}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    shipping_method: v,
                    payment_method: v === 'envio' && prev.payment_method === 'efectivo' ? 'mercadopago' : prev.payment_method,
                  }))
                }
              >
                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.shipping_method === 'retiro' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="retiro" id="retiro" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-primary" />
                      <Label htmlFor="retiro" className="font-medium cursor-pointer">Retiro en local</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Sin costo adicional - Disponible de Lun a Sáb</p>
                  </div>
                  <span className="font-semibold text-success">Gratis</span>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.shipping_method === 'envio' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="envio" id="envio" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <Label htmlFor="envio" className="font-medium cursor-pointer">Envío a domicilio (Correo Argentino)</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Cotización automática por Código Postal</p>
                  </div>
                  <span className="font-semibold">
                    {form.shipping_method === 'envio' && shippingCost === null
                      ? '-'
                      : calculatingShipping
                      ? 'Calculando...'
                      : formatPrice(shippingCost ?? 0)}
                  </span>
                </div>
              </RadioGroup>

              {form.shipping_method === 'envio' && (
                <div className="space-y-4 pt-2">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código Postal *</Label>
                      <Input
                        id="postal_code"
                        required={form.shipping_method === 'envio'}
                        value={form.postal_code}
                        onChange={(e) => {
                          const cp = e.target.value;
                          setForm({ ...form, postal_code: cp });
                          if (cp.trim().length >= 4) {
                            fetchShippingCost(cp, items);
                          }
                        }}
                        placeholder="5577"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Provincia *</Label>
                      <Select
                        value={form.province}
                        onValueChange={(val) => setForm({ ...form, province: val })}
                      >
                        <SelectTrigger id="province">
                          <SelectValue placeholder="Seleccioná provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {ARGENTINE_PROVINCES.map((prov) => (
                            <SelectItem key={prov} value={prov}>
                              {prov}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad / Localidad *</Label>
                      <Input
                        id="city"
                        required={form.shipping_method === 'envio'}
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Palmira"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección de envío (Calle y número) *</Label>
                      <Input
                        id="address"
                        required={form.shipping_method === 'envio'}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Av. San Martín 123"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Notas del pedido (opcional)</h2>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Indicaciones especiales para la entrega..."
                rows={3}
              />
            </div>

            {/* Payment */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Método de pago</h2>
              </div>

              <RadioGroup
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.payment_method === 'mercadopago' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="mercadopago" id="pago-mp" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-mp" className="font-medium cursor-pointer">Mercado Pago</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tarjetas de crédito/débito, cuotas y dinero en cuenta. Te lleva a un checkout seguro de Mercado Pago.
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.payment_method === 'gocuotas' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="gocuotas" id="pago-gocuotas" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-gocuotas" className="font-medium cursor-pointer">Cuotas sin tarjeta (GoCuotas)</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pagá en 2, 3 o 4 cuotas con tu tarjeta de débito. Te lleva a un checkout seguro de GoCuotas.
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.payment_method === 'transferencia' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="transferencia" id="pago-transferencia" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-transferencia" className="font-medium cursor-pointer">Transferencia bancaria</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Registramos tu pedido y te enviamos los datos para transferir por WhatsApp.
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 transition-colors',
                  form.shipping_method === 'envio' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  form.payment_method === 'efectivo' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem
                    value="efectivo"
                    id="pago-efectivo"
                    className="mt-1"
                    disabled={form.shipping_method === 'envio'}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-efectivo" className="font-medium cursor-pointer">Efectivo al retirar</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {form.shipping_method === 'envio'
                        ? 'Solo disponible con retiro en local'
                        : 'Pagás al retirar tu pedido en el local'}
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {form.payment_method === 'mercadopago' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Vas a ser redirigido al checkout de Mercado Pago para completar el pago de forma segura.
                </p>
              )}

              {form.payment_method === 'gocuotas' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Vas a ser redirigido al checkout de GoCuotas para completar el pago de forma segura.
                </p>
              )}

              {paymentError && (
                <p className="text-sm text-destructive">{paymentError}</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-36 rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-bold text-lg">Tu pedido</h2>
              <Separator />
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={cartLineKey(item.product.id, item.variant?.id)} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {(item.variant?.image_url || item.product.images[0]) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.variant?.image_url || item.product.images[0]} alt={item.product.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2">{item.product.name}</p>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground">
                          {item.variant.group_name}: {item.variant.label}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.quantity}x {formatPrice(item.product.price)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span>
                    {form.shipping_method === 'retiro'
                      ? 'Gratis'
                      : shippingCost === null
                      ? '-'
                      : calculatingShipping
                      ? 'Calculando...'
                      : formatPrice(shippingCost)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-xl text-primary">{formatPrice(grandTotal)}</span>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={processing}>
                {processing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {form.payment_method === 'mercadopago'
                      ? 'Redirigiendo a Mercado Pago...'
                      : form.payment_method === 'gocuotas'
                      ? 'Redirigiendo a GoCuotas...'
                      : 'Procesando...'}
                  </span>
                ) : form.payment_method === 'mercadopago' ? (
                  'Pagar con Mercado Pago'
                ) : form.payment_method === 'gocuotas' ? (
                  'Pagar en cuotas con GoCuotas'
                ) : (
                  'Confirmar pedido'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Compra segura y protegida
              </p>
            </div>
          </div>
        </form>
      </div>
      </div>
    </StoreLayout>
  );
}
