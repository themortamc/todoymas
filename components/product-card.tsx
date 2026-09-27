'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { formatPrice } from '@/lib/format';
import type { Product, Category } from '@/lib/supabase';
import { tintForCategory } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

export function ProductCard({
  product,
  categoryMap,
}: {
  product: Product;
  /** Mapa id -> categoría, para pintar el chip de rubro con su color. Opcional. */
  categoryMap?: Record<string, Category>;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();
  const outOfStock = product.stock <= 0;
  const [imgError, setImgError] = useState(false);

  const category = product.category_id ? categoryMap?.[product.category_id] : undefined;
  const tint = tintForCategory(category?.icon ?? product.category_id);
  const favorite = isFavorite(product.id);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:shadow-soft-md hover:-translate-y-1">
      <Link href={`/producto/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.images[0] && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-xs">
              Sin imagen
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {category && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm"
                style={{ backgroundColor: tint.bg, color: tint.fg }}
              >
                {category.name}
              </span>
            )}
            {product.featured && (
              <Badge className="bg-accent text-accent-foreground">Destacado</Badge>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(product);
            }}
            title={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm transition-colors hover:bg-background"
          >
            <Heart
              className={cn('h-4 w-4 transition-colors', favorite ? 'fill-accent text-accent' : 'text-foreground')}
            />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
              <Badge variant="destructive">Sin stock</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/producto/${product.id}`}>
          <h3 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 flex-1">
          {product.description}
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-lg font-display font-semibold">{formatPrice(product.price)}</p>
            <p className={cn('text-xs', outOfStock ? 'text-destructive' : 'text-success')}>
              {outOfStock ? 'Sin stock' : product.has_variants ? 'Varias opciones disponibles' : `${product.stock} disponibles`}
            </p>
          </div>
          <Button
            className="w-full"
            disabled={outOfStock}
            onClick={(e) => {
              e.preventDefault();
              if (product.has_variants) {
                // Tiene variantes (color, aroma, talle...): hay que elegir
                // una opción antes de agregar, así que llevamos a la ficha.
                router.push(`/producto/${product.id}`);
                return;
              }
              addItem(product, 1);
            }}
          >
            {product.has_variants ? (
              <>Ver opciones <ArrowRight className="h-4 w-4 ml-2" /></>
            ) : (
              <><ShoppingCart className="h-4 w-4 mr-2" /> Agregar al carrito</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
