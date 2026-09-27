'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Truck, MapPin, CreditCard, Headphones, Home } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { ProductCard } from '@/components/product-card';
import { LeafBranch, LogoMark, PaintedBlob } from '@/components/decorative-plants';
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

  const heroRubros = [...categories.slice(0, 5).map((c) => c.name), 'Más'];

  return (
    <StoreLayout>
      {/* Hero: panel crema + foto con borde orgánico */}
      <section className="relative overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1fr] items-stretch">
          <div className="relative px-4 sm:px-6 lg:pl-12 xl:pl-20 lg:pr-8 py-12 md:py-16 lg:py-20">
            <LeafBranch className="pointer-events-none absolute left-0 top-4 h-44 w-auto text-primary/40 hidden md:block" />
            <LeafBranch className="pointer-events-none absolute left-1 bottom-2 h-32 w-auto text-primary/30 hidden md:block -scale-x-100" />
            <div className="relative max-w-xl">
              <p className="font-script text-2xl md:text-3xl text-primary">Todo lo que necesitás...</p>
              <h1 className="font-display font-black uppercase tracking-tight text-primary text-5xl md:text-6xl xl:text-7xl leading-[1.05] mt-2">
                Todo y Más
              </h1>
              <p className="font-script text-2xl md:text-3xl text-foreground mt-2">en un solo lugar ♡</p>
              <p className="text-[11px] md:text-xs font-semibold tracking-[0.14em] text-foreground/70 mt-5 uppercase">
                {heroRubros.join('  ·  ')}
              </p>
              <Link href="/catalogo" className="inline-block mt-7">
                <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-8 py-3 text-sm font-semibold shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all">
                  Ver productos
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
          <div className="relative px-4 pb-10 lg:p-0">
            <div className="relative h-72 sm:h-96 lg:h-full lg:min-h-[480px] overflow-hidden rounded-[2rem] lg:rounded-none lg:rounded-l-[5rem]">
              <img
                src="/images/hero-mochila.jpg"
                alt="Lago y montañas al atardecer con mochila y termo de camping"
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
              <p className="font-script text-xl md:text-2xl text-white/95 drop-shadow-md absolute top-5 right-5 md:top-8 md:right-8 text-right leading-snug">
                Lo esencial, lo útil,<br />lo que te gusta... ♡
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="relative overflow-hidden">
        <LeafBranch className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-64 w-auto text-primary/40 hidden lg:block" />
        <LeafBranch className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-64 w-auto text-primary/40 hidden lg:block -scale-x-100" />
        <div className="container mx-auto px-4 py-12 md:py-14 relative">
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
      <section className="container mx-auto px-4 py-10 md:py-12">
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
      </section>

      {/* Banner + ofertas */}
      <section className="relative overflow-hidden">
        <LeafBranch className="pointer-events-none absolute left-0 bottom-0 h-40 w-auto text-primary/40 hidden lg:block" />
        <LeafBranch className="pointer-events-none absolute right-0 top-0 h-40 w-auto text-primary/40 hidden lg:block -scale-x-100 rotate-180" />
        <div className="container mx-auto px-4 py-10 md:py-14 relative">
          <div className="grid md:grid-cols-[1fr_1.25fr_1fr] rounded-[2rem] overflow-hidden shadow-soft-lg">
            <div className="bg-[#D8E4D3] p-8 md:p-10 flex flex-col items-start justify-center gap-4">
              <LogoMark className="h-16 w-16 text-primary" />
              <p className="font-script text-2xl md:text-[1.7rem] leading-snug text-primary">
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
            <div className="bg-primary p-8 md:p-10 flex flex-col items-start justify-center">
              <LogoMark className="h-12 w-12 text-primary-foreground/90" />
              <h2 className="font-display font-bold uppercase tracking-wide text-primary-foreground text-2xl md:text-[1.7rem] leading-tight mt-4">
                Ofertas imperdibles
              </h2>
              <p className="text-primary-foreground/80 text-sm mt-2">
                Productos seleccionados con los mejores precios.
              </p>
              <Link href="/catalogo?destacados=true" className="mt-6">
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
      <section className="container mx-auto px-4 pb-12 md:pb-16">
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
      </section>
    </StoreLayout>
  );
}
