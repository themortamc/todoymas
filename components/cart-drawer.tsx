'use client';

import Link from 'next/link';
import { X, Plus, Minus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCart, cartLineKey } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CdnImg } from '@/components/cdn-img';

export function CartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Tu carrito está vacío</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agrega productos para empezar tu compra
              </p>
            </div>
            <Link href="/catalogo" onClick={() => onOpenChange(false)}>
              <Button>Ver productos</Button>
            </Link>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {items.map((item) => (
                  <div key={cartLineKey(item.product.id, item.variant?.id)} className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {(item.variant?.image_url || item.product.images[0]) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <CdnImg
                          src={item.variant?.image_url || item.product.images[0]}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        {item.product.name}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {item.variant.color_hex && (
                            <span
                              className="inline-block h-3 w-3 rounded-full border shrink-0"
                              style={{ backgroundColor: item.variant.color_hex }}
                            />
                          )}
                          {item.variant.group_name}: {item.variant.label}
                        </p>
                      )}
                      <p className="text-sm text-primary font-semibold mt-1">
                        {formatPrice(item.product.price)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant?.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant?.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.product.id, item.variant?.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t p-4 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm font-medium">{formatPrice(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-primary">{formatPrice(total)}</span>
              </div>
              <Separator />
              <Link href="/carrito" onClick={() => onOpenChange(false)}>
                <Button className="w-full" variant="outline">
                  Ver carrito completo
                </Button>
              </Link>
              <Link href="/checkout" onClick={() => onOpenChange(false)}>
                <Button className="w-full" size="lg">
                  Finalizar compra
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
