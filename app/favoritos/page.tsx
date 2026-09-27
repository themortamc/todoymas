'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product-card';
import { LeafSprig, LeafBranch, OrganicBlob, Bloom, MandalaLine, Vine } from '@/components/decorative-plants';
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
      <div className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/60">
        <MandalaLine className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 text-primary/20 sm:h-96 sm:w-96" />
        <MandalaLine className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 text-brand-clay/25 hidden md:block" />
        <LeafBranch className="pointer-events-none absolute right-0 top-32 h-56 w-auto text-primary/30 hidden xl:block -scale-x-100" />
        <LeafSprig className="pointer-events-none absolute -top-4 -left-2 h-24 w-14 text-accent/30 sm:-top-8 sm:-left-4 sm:h-44 sm:w-28" />
        <Bloom className="pointer-events-none absolute -bottom-6 right-2 h-20 w-20 text-primary/25 sm:right-8 sm:h-28 sm:w-28" />
        <Bloom className="pointer-events-none absolute left-1/3 top-3 h-12 w-12 text-brand-clay/40 hidden md:block" />
        <Vine className="pointer-events-none absolute bottom-1 left-1/3 w-64 text-primary/25 hidden lg:block" />
        <div className="container mx-auto px-4 py-8 relative">
          <h1 className="text-2xl font-bold mb-6">Mis favoritos</h1>

          {items.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center py-20 text-center overflow-hidden">
              <OrganicBlob className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 text-accent/15" />
              <MandalaLine className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 text-primary/15" />
              <Bloom className="pointer-events-none absolute left-10 top-6 h-14 w-14 text-primary/30 sm:left-16 sm:h-20 sm:w-20" />
              <Bloom className="pointer-events-none absolute right-10 bottom-10 h-12 w-12 text-accent/25 hidden sm:block" />
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
