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
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:shadow-soft-md hover:-translate-y-1">
      <Link href={`/producto/${product.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(product);
            }}
            title={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className="absolute top-2.5 right-2.5 p-1 transition-transform hover:scale-110"
          >
            <Heart
              className={cn(
                'h-5 w-5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-colors',
                favorite ? 'fill-accent text-accent' : 'text-brand-cream'
              )}
            />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
              <Badge variant="destructive">Sin stock</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="relative flex flex-1 flex-col p-4 pt-5">
        {category && (
          <span
            className="absolute -top-3.5 left-4 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm whitespace-nowrap"
            style={{ backgroundColor: tint.bg, color: tint.fg }}
          >
            {category.name}
          </span>
        )}
        <Link href={`/producto/${product.id}`}>
          <h3 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-lg font-display font-bold mt-1">{formatPrice(product.price)}</p>
        <Button
          size="sm"
          className="w-full rounded-full mt-3 text-xs gap-1.5"
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
          {outOfStock ? (
            'Sin stock'
          ) : product.has_variants ? (
            <>Ver opciones <ArrowRight className="h-3.5 w-3.5" /></>
          ) : (
            <><ShoppingCart className="h-3.5 w-3.5" /> Agregar al carrito</>
          )}
        </Button>
      </div>
    </div>
  );
}
