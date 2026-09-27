'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import { LeafSprig, OrganicBlob, Bloom } from '@/components/decorative-plants';
import { useWishlist } from '@/lib/wishlist-context';
import { supabase, type Category } from '@/lib/supabase';

export default function FavoritesPage() {
  const { items } = useWishlist();
  const [categoryMap, setCategoryMap] = useState<Record<string, Category>>({});

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Category> = {};
        (data as Category[]).forEach((c) => { map[c.id] = c; });
        setCategoryMap(map);
      });
  }, []);

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-brand-sand/45">
        <LeafSprig className="pointer-events-none absolute -top-4 -left-2 h-24 w-14 text-accent opacity-[0.09] sm:-top-8 sm:-left-4 sm:h-44 sm:w-28" />
        <Bloom className="pointer-events-none absolute -bottom-6 right-2 h-20 w-20 text-primary opacity-[0.07] sm:right-8 sm:h-28 sm:w-28" />
        <div className="container mx-auto px-4 py-8 relative">
          <h1 className="text-2xl font-bold mb-6">Mis favoritos</h1>

          {items.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center py-20 text-center overflow-hidden">
              <OrganicBlob className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 text-accent opacity-[0.06]" />
              <Bloom className="pointer-events-none absolute left-10 top-6 h-14 w-14 text-primary opacity-20 sm:left-16 sm:h-20 sm:w-20" />
              <Bloom className="pointer-events-none absolute right-10 bottom-10 h-12 w-12 text-accent opacity-15 hidden sm:block" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-4">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">Todavía no guardaste favoritos</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Tocá el corazón en cualquier producto para guardarlo acá
              </p>
              <Link href="/catalogo">
                <Button size="lg">
                  Ir al catálogo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} categoryMap={categoryMap} />
              ))}
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  );
}
