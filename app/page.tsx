'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Truck, MapPin, CreditCard, Headphones, Home } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { ProductCard } from '@/components/product-card';
import { LeafBranch, LeafSprig, LogoMark, PaintedBlob, MandalaLine, MountainLine, Bloom, Vine } from '@/components/decorative-plants';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { CATEGORY_ICON_MAP as iconMap, tintForCategory, blobVariantForCategory, subtitleForCategory } from '@/lib/category-icons';

type ThinIcon = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number | string;
}>;

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
          .limit(6),
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

  // Rubros del hero: sin repetir (puede existir una categoría llamada "Más").
  const heroRubros = [...categories.slice(0, 5).map((c) => c.name), 'Más'].filter(
    (name, i, all) => all.indexOf(name) === i
  );

  return (
    <StoreLayout>
      {/* Hero: panel arena cálido con jardín (hojas + mandalas + velos), mandala
          de agua a la derecha y paisaje de línea al pie. Sin foto: la marca la
          sostienen la tipografía y las ilustraciones del manual. */}
      <section className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/70">
        <div className="container relative mx-auto px-4 sm:px-6 py-12 md:py-16 lg:py-20">
          {/* Mandala grande a la derecha, como el círculo del manual de marca */}
          <MandalaLine className="pointer-events-none absolute -right-24 -top-32 hidden h-[30rem] w-[30rem] text-primary/35 md:block" />
          <MandalaLine className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 text-brand-clay/40 md:hidden" />
          <MandalaLine className="pointer-events-none absolute -left-28 -bottom-40 hidden h-72 w-72 text-primary/20 lg:block" />
          {/* Paisaje de línea, al pie del panel */}
          <MountainLine className="pointer-events-none absolute bottom-4 right-8 hidden h-24 w-56 text-primary/50 lg:block xl:h-28 xl:w-60" />
          <LeafBranch className="pointer-events-none absolute left-0 top-6 h-44 w-auto text-primary/50 hidden md:block" />
          <LeafBranch className="pointer-events-none absolute left-1 bottom-2 h-32 w-auto text-primary/40 hidden md:block -scale-x-100" />
          <LeafBranch className="pointer-events-none absolute right-2 top-1/2 h-52 w-auto -translate-y-1/2 text-primary/30 hidden xl:block -scale-x-100" />
          <Bloom className="pointer-events-none absolute left-[46%] top-6 hidden h-16 w-16 text-brand-clay/50 md:block" />
          <Bloom className="pointer-events-none absolute bottom-8 left-[38%] hidden h-10 w-10 text-primary/30 lg:block" />
          <Vine className="pointer-events-none absolute bottom-1 left-1/4 hidden w-64 text-primary/40 md:block" />

          <div className="relative max-w-2xl">
            <p className="font-script text-2xl md:text-3xl text-primary">Todo lo que necesitás...</p>
            <h1 className="font-display font-black uppercase tracking-tight text-primary text-5xl md:text-6xl xl:text-7xl leading-[1.05] mt-2">
              Todo y Más
            </h1>
            <p className="font-script text-2xl md:text-3xl text-foreground mt-2">en un solo lugar ♡</p>
            <p className="text-[11px] md:text-xs font-semibold tracking-[0.14em] text-foreground/70 mt-5 uppercase">
              {heroRubros.join('  ·  ')}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-7">
              <Link href="/catalogo">
                <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-8 py-3 text-sm font-semibold shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all">
                  Ver productos
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <p className="font-script text-xl md:text-2xl text-accent-ink leading-tight">
                Lo esencial, lo útil,<br />lo que te gusta... ♡
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="relative overflow-hidden bg-grain bg-garden bg-brand-sage/25 border-y border-primary/10">
        <LeafBranch className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-72 w-auto text-primary/50 hidden lg:block" />
        <LeafBranch className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-72 w-auto text-primary/50 hidden lg:block -scale-x-100" />
        <MandalaLine className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 text-primary/[0.10]" />
        <Bloom className="pointer-events-none absolute left-8 top-6 h-12 w-12 text-brand-clay/40 hidden md:block" />
        <Bloom className="pointer-events-none absolute right-10 bottom-6 h-14 w-14 text-primary/25 hidden md:block" />
        <div className="container mx-auto px-4 py-12 md:py-14 relative">
          <div className="text-center mb-10">
            <p className="font-script text-xl md:text-2xl text-accent-ink">un poco de todo...</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
              Nuestros rubros
            </h2>
            <Vine className="mx-auto mt-2 h-8 w-56 text-primary/50" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-10">
            {categories.map((cat) => {
              const Icon = (cat.icon ? iconMap[cat.icon] ?? Home : Home) as ThinIcon;
              const palette = tintForCategory(cat.icon ?? cat.id);
              const blobVariant = blobVariantForCategory(cat.id);
              const subtitle = subtitleForCategory(cat.icon);
              return (
                <Link
                  key={cat.id}
                  href={`/catalogo?categoria=${cat.slug}`}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center">
                    <PaintedBlob
                      variant={blobVariant}
                      className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                      style={{ color: palette.bg }}
                    />
                    <Icon className="relative h-10 w-10" style={{ color: palette.fg }} strokeWidth={1.5} />
                  </div>
                  <span className="mt-3 font-display text-base md:text-lg font-bold text-foreground">
                    {cat.name}
                  </span>
                  {subtitle && (
                    <span className="text-xs text-muted-foreground leading-snug mt-0.5 max-w-[12rem]">
                      {subtitle}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Productos destacados */}
      <section className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/55">
        <MandalaLine className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 text-primary/20 hidden md:block" />
        <MandalaLine className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 text-brand-clay/30" />
        <LeafSprig className="pointer-events-none absolute right-6 bottom-4 h-32 w-20 text-primary/25 hidden lg:block rotate-12" />
        <Bloom className="pointer-events-none absolute left-1/3 top-4 h-10 w-10 text-brand-clay/40 hidden md:block" />
        <div className="container relative mx-auto px-4 py-10 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="flex items-center gap-2.5 text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
              <LogoMark className="h-7 w-7 md:h-8 md:w-8 text-primary shrink-0" />
              Productos destacados
            </h2>
            <Link
              href="/catalogo?destacados=true"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl border border-border bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} categoryMap={categoryMap} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Banner + ofertas */}
      <section className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/60 border-y border-primary/10">
        <LeafBranch className="pointer-events-none absolute left-0 bottom-0 h-48 w-auto text-primary/50 hidden lg:block" />
        <LeafBranch className="pointer-events-none absolute right-0 top-0 h-48 w-auto text-primary/50 hidden lg:block -scale-x-100 rotate-180" />
        <MandalaLine className="pointer-events-none absolute left-1/4 -bottom-28 h-56 w-56 text-primary/20 hidden md:block" />
        <Bloom className="pointer-events-none absolute right-1/4 top-4 h-12 w-12 text-brand-clay/40 hidden md:block" />
        <div className="container mx-auto px-4 py-10 md:py-14 relative">
          <div className="grid md:grid-cols-[1fr_1.25fr_1fr] rounded-[2rem] overflow-hidden shadow-soft-lg">
            <div className="relative overflow-hidden bg-[#D8E4D3] bg-leaf-tile p-8 md:p-10 flex flex-col items-start justify-center gap-4">
              <LeafBranch className="pointer-events-none absolute -left-6 -top-8 h-40 w-auto text-primary/30 -scale-x-100" />
              <MandalaLine className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 text-primary/35" />
              <Bloom className="pointer-events-none absolute right-6 top-6 h-12 w-12 text-primary/30" />
              <LogoMark className="relative h-16 w-16 text-primary" />
              <p className="relative font-script text-2xl md:text-[1.7rem] leading-snug text-primary">
                Conectá con la naturaleza en cada detalle ♡
              </p>
            </div>
            <div className="relative min-h-[240px] md:min-h-[300px]">
              <img
                src="/images/banner-vela.jpg"
                alt="Vela de loto encendida con sahumerios"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="relative overflow-hidden bg-wave bg-grain bg-mandala-tile-light p-8 md:p-10 flex flex-col items-start justify-center">
              <MandalaLine className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 text-primary-foreground/35" />
              <LeafSprig className="pointer-events-none absolute -left-4 -bottom-6 h-36 w-20 text-primary-foreground/25 -rotate-12" />
              <LogoMark className="relative h-12 w-12 text-primary-foreground/90" />
              <h2 className="relative font-display font-bold uppercase tracking-wide text-primary-foreground text-2xl md:text-[1.7rem] leading-tight mt-4">
                Ofertas imperdibles
              </h2>
              <p className="relative text-primary-foreground/80 text-sm mt-2">
                Productos seleccionados con los mejores precios.
              </p>
              <Link href="/catalogo?destacados=true" className="relative mt-6">
                <span className="inline-flex items-center gap-2 bg-brand-clay text-primary rounded-full px-6 py-2.5 text-sm font-semibold hover:-translate-y-0.5 transition-all shadow-soft">
                  Ver ofertas
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="relative overflow-hidden bg-grain bg-garden bg-brand-sage/20">
        <MandalaLine className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 text-primary/[0.10]" />
        <Vine className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 w-72 text-primary/40 hidden md:block" />
        <LeafBranch className="pointer-events-none absolute left-2 bottom-0 h-36 w-auto text-primary/30 hidden lg:block" />
        <LeafBranch className="pointer-events-none absolute right-2 bottom-0 h-36 w-auto text-primary/30 hidden lg:block -scale-x-100" />
        <div className="container relative mx-auto px-4 pb-12 md:pb-16 pt-10 md:pt-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 lg:divide-x lg:divide-border">
          {[
            { icon: Truck, title: 'Envíos a todo el país', desc: 'Rápidos y seguros.' },
            { icon: MapPin, title: 'Retiro en tienda', desc: 'Coordiná y pasá a buscar.' },
            { icon: CreditCard, title: 'Medios de pago', desc: 'Tarjetas, transferencias y más.' },
            { icon: Headphones, title: 'Atención personalizada', desc: 'Te ayudamos en lo que necesites.' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 lg:justify-center lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
    </StoreLayout>
  );
}
