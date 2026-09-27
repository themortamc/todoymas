'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Truck, ShieldCheck, Store, Headphones } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { ProductCard } from '@/components/product-card';
import { OrganicBlob, LeafScatter, LeafSprig, Vine, Bloom, LogoMark } from '@/components/decorative-plants';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { Home } from 'lucide-react';
import { CATEGORY_ICON_MAP as iconMap, tintForCategory, blobVariantForCategory } from '@/lib/category-icons';
import { PaintedBlob } from '@/components/decorative-plants';

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  useEffect(() => {
    async function load() {
      const [featRes, catRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('featured', true)
          .limit(8),
        supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('name'),
      ]);
      setFeatured(featRes.data as Product[] ?? []);
      setCategories(catRes.data as Category[] ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <StoreLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-grain">
        <div className="container mx-auto px-4 py-16 md:py-24 text-center relative">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 text-primary">
            <LogoMark className="h-11 w-11" />
          </div>
          <p className="font-script text-xl md:text-2xl text-accent-ink">Todo lo que necesitás...</p>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-primary drop-shadow-sm mt-1">
            Todo y Más
          </h1>
          <p className="text-2xl md:text-3xl font-display text-foreground/80 mt-1">en un solo lugar ♡</p>
          <p className="text-sm md:text-base font-medium text-muted-foreground mt-5 tracking-wide">
            Belleza · Bazar &amp; Hogar · Pesca · Electro · Herramientas · Más
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <Link href="/catalogo">
              <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-8 py-3 font-semibold shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all">
                Ver productos
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/catalogo?destacados=true">
              <button className="inline-flex items-center gap-2 bg-background border border-foreground/70 rounded-full px-8 py-3 font-semibold hover:bg-secondary hover:-translate-y-0.5 transition-all">
                Ver más
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features bar */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/60 bg-leaf-tile">
        <LeafSprig className="absolute -bottom-4 left-2 h-20 w-12 text-primary sm:-bottom-6 sm:left-6 sm:h-32 sm:w-20" />
        <LeafSprig className="absolute -top-6 right-3 h-16 w-10 text-accent rotate-[160deg] sm:-top-10 sm:right-10 sm:h-28 sm:w-16" />
        <Vine className="pointer-events-none absolute -bottom-2 left-0 h-8 w-full text-primary opacity-[0.12] sm:h-10" />
        <div className="container mx-auto px-4 py-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: 'Envíos a todo el país', desc: 'Entregas rápidas' },
              { icon: Store, title: 'Retiro en local', desc: 'Sin costo adicional' },
              { icon: ShieldCheck, title: 'Compra segura', desc: 'Pago protegido' },
              { icon: Headphones, title: 'Atención personalizada', desc: 'Lun a Sáb' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="relative overflow-hidden bg-mandala-tile bg-secondary/20">
       <div className="container mx-auto px-4 py-14 relative">
        <div className="flex items-center justify-between mb-6 relative">
          <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Explorá por categorías</h2>
          <Link href="/catalogo" className="text-sm font-medium text-primary hover:underline">
            Ver todo
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-8 relative">
          {categories.map((cat) => {
            const Icon = cat.icon ? iconMap[cat.icon] : Home;
            const palette = tintForCategory(cat.icon ?? cat.id);
            const blobVariant = blobVariantForCategory(cat.id);
            return (
              <Link
                key={cat.id}
                href={`/catalogo?categoria=${cat.slug}`}
                className="group flex flex-col items-center gap-3 text-center"
              >
                <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center">
                  <PaintedBlob
                    variant={blobVariant}
                    className="absolute inset-0 h-full w-full transition-transform group-hover:scale-110"
                    style={{ color: palette.bg }}
                  />
                  <Icon className="relative h-8 w-8" style={{ color: palette.fg }} />
                </div>
                <span className="text-sm font-semibold">{cat.name}</span>
              </Link>
            );
          })}
        </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="relative overflow-hidden bg-grain container mx-auto px-4 py-10">
        <LeafScatter className="pointer-events-none absolute -right-6 bottom-0 h-32 w-32 text-accent opacity-[0.1] sm:h-52 sm:w-52" />
        <LeafSprig className="pointer-events-none absolute -top-6 -left-3 h-24 w-14 text-primary opacity-[0.08] rotate-[25deg] sm:h-36 sm:w-20" />
        <div className="flex items-center justify-between mb-6 relative">
          <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Productos destacados</h2>
          <Link href="/catalogo?destacados=true" className="text-sm font-medium text-primary hover:underline">
            Ver más
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 relative">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-3xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 relative">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} categoryMap={categoryMap} />
            ))}
          </div>
        )}
      </section>

      {/* Banner promocional: foto + bloque de ofertas, como en las referencias */}
      <section className="container mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-[2rem] min-h-[220px] flex items-end p-8 shadow-soft-lg">
            <img
              src="/images/banner-vela.jpg"
              alt="Vela encendida junto a piedras decorativas"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <p className="font-script text-2xl md:text-3xl text-primary-foreground leading-tight relative">
              Conectá con la naturaleza en cada detalle ♡
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] bg-secondary p-8 md:p-10 flex flex-col justify-center shadow-soft-lg">
            <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-primary relative">
              Ofertas imperdibles
            </h2>
            <p className="text-muted-foreground mt-2 max-w-sm relative">
              Productos seleccionados con los mejores precios.
            </p>
            <Link href="/catalogo?destacados=true" className="relative mt-6 w-fit">
              <button className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-full px-6 py-3 font-semibold hover:-translate-y-0.5 transition-all shadow-soft">
                Ver ofertas
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="container mx-auto px-4 pb-14">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-wave bg-mandala-tile-light p-8 md:p-14 text-center shadow-soft-lg">
          <OrganicBlob className="absolute -right-28 -bottom-28 h-80 w-80 text-primary-foreground opacity-15" />
          <Bloom className="absolute left-6 top-6 h-16 w-16 text-primary-foreground opacity-20 sm:left-10 sm:top-10 sm:h-24 sm:w-24" />
          <Vine className="pointer-events-none absolute top-0 left-0 h-6 w-full text-primary-foreground opacity-[0.15] sm:h-8" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-primary-foreground">
              ¿Buscás algo específico?
            </h2>
            <p className="text-primary-foreground/80 mt-3 max-w-xl mx-auto">
              Explorá nuestro catálogo completo con una gran variedad de productos y rubros.
            </p>
            <Link href="/catalogo">
              <button className="mt-7 inline-flex items-center gap-2 bg-background text-foreground rounded-full px-6 py-3 font-semibold hover:-translate-y-0.5 transition-all shadow-soft">
                Ir al catálogo
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
