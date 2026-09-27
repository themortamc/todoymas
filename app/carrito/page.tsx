'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LeafSprig, OrganicBlob, Bloom } from '@/components/decorative-plants';
import { useCart, cartLineKey } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-brand-sand/45">
        <LeafSprig className="pointer-events-none absolute -top-4 -left-2 h-24 w-14 text-accent opacity-[0.09] sm:-top-8 sm:-left-4 sm:h-44 sm:w-28" />
        <Bloom className="pointer-events-none absolute -bottom-6 right-2 h-20 w-20 text-primary opacity-[0.07] sm:right-8 sm:h-28 sm:w-28" />
      <div className="container mx-auto px-4 py-8 relative">
        <h1 className="text-2xl font-bold mb-6">Carrito de compras</h1>

        {items.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center py-20 text-center overflow-hidden">
            <OrganicBlob className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 text-primary opacity-[0.06]" />
            <Bloom className="pointer-events-none absolute left-10 top-6 h-14 w-14 text-accent opacity-20 sm:left-16 sm:h-20 sm:w-20" />
            <Bloom className="pointer-events-none absolute right-10 bottom-10 h-12 w-12 text-primary opacity-15 hidden sm:block" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Tu carrito está vacío</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Explorá nuestro catálogo y agregá productos
            </p>
            <Link href="/catalogo">
              <Button size="lg">
                Ir al catálogo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div
                  key={cartLineKey(item.product.id, item.variant?.id)}
                  className="flex gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft"
                >
                  <Link href={`/producto/${item.product.id}`} className="shrink-0">
                    <div className="h-24 w-24 overflow-hidden rounded-lg border bg-muted">
                      {(item.variant?.image_url || item.product.images[0]) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.variant?.image_url || item.product.images[0]}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/producto/${item.product.id}`}>
                      <h3 className="font-medium hover:text-primary transition-colors line-clamp-2">
                        {item.product.name}
                      </h3>
                    </Link>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        {item.variant.color_hex && (
                          <span
                            className="inline-block h-3 w-3 rounded-full border shrink-0"
                            style={{ backgroundColor: item.variant.color_hex }}
                          />
                        )}
                        {item.variant.group_name}: {item.variant.label}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Precio unitario: {formatPrice(item.product.price)}
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant?.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant?.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-bold text-primary">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.product.id, item.variant?.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-between">
                <Button variant="outline" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vaciar carrito
                </Button>
                <Link href="/catalogo">
                  <Button variant="outline">
                    Seguir comprando
                  </Button>
                </Link>
              </div>
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="relative overflow-hidden sticky top-36 rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
                <LeafSprig className="pointer-events-none absolute -top-3 -right-3 h-20 w-12 text-primary opacity-10 rotate-[35deg] sm:h-28 sm:w-16" />
                <h2 className="font-bold text-lg relative">Resumen</h2>
                <Separator className="relative" />
                <div className="space-y-2 relative">
                  {items.map((item) => (
                    <div key={cartLineKey(item.product.id, item.variant?.id)} className="flex justify-between text-sm">
                      <span className="text-muted-foreground line-clamp-1 pr-2">
                        {item.quantity}x {item.product.name}
                        {item.variant && ` (${item.variant.label})`}
                      </span>
                      <span className="font-medium shrink-0">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span className="text-muted-foreground">A calcular en checkout</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-xl text-primary">{formatPrice(total)}</span>
                </div>
                <Link href="/checkout">
                  <Button size="lg" className="w-full">
                    Finalizar compra
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </StoreLayout>
  );
}
