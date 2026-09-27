'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { ProductCard } from '@/components/product-card';
import { LeafSprig, Bloom } from '@/components/decorative-plants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

function CatalogContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const catSlug = searchParams.get('categoria') ?? '';
  const subSlug = searchParams.get('subcategoria') ?? '';
  const featuredOnly = searchParams.get('destacados') === 'true';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState<string>(catSlug);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(subSlug);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(featuredOnly);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setSearchInput(query);
    setSelectedCategory(catSlug);
    setSelectedSubcategory(subSlug);
    setShowFeaturedOnly(featuredOnly);
  }, [query, catSlug, subSlug, featuredOnly]);

  useEffect(() => {
    async function loadData() {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (cats) setCategories(cats as Category[]);

      let dbQuery = supabase.from('products').select('*');

      if (showFeaturedOnly) {
        dbQuery = dbQuery.eq('featured', true);
      }

      const { data: prods } = await dbQuery.order('created_at', { ascending: false });
      setProducts((prods as Product[]) ?? []);
      setLoading(false);
    }
    loadData();
  }, [showFeaturedOnly]);

  const parents = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const childrenOf = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach(c => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    return map;
  }, [categories]);

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    let result = [...products];

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    }

    if (selectedCategory) {
      const parentCat = parents.find(c => c.slug === selectedCategory);
      if (parentCat) {
        result = result.filter(p => {
          const pcat = p.category_id ? categoryMap[p.category_id] : null;
          const psub = p.subcategory_id ? categoryMap[p.subcategory_id] : null;
          return pcat?.slug === selectedCategory || psub?.slug === selectedCategory ||
            (psub && parents.find(pp => pp.id === psub.parent_id)?.slug === selectedCategory);
        });
      }
    }

    if (selectedSubcategory) {
      result = result.filter(p => {
        const psub = p.subcategory_id ? categoryMap[p.subcategory_id] : null;
        return psub?.slug === selectedSubcategory;
      });
    }

    if (priceMin) {
      const min = parseFloat(priceMin);
      if (!isNaN(min)) result = result.filter(p => p.price >= min);
    }
    if (priceMax) {
      const max = parseFloat(priceMax);
      if (!isNaN(max)) result = result.filter(p => p.price <= max);
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, query, selectedCategory, selectedSubcategory, priceMin, priceMax, sortBy, parents, categoryMap]);

  const activeFilters: string[] = [];
  if (query) activeFilters.push(`Búsqueda: "${query}"`);
  if (selectedCategory) activeFilters.push(parents.find(c => c.slug === selectedCategory)?.name ?? selectedCategory);
  if (selectedSubcategory) activeFilters.push(categories.find(c => c.slug === selectedSubcategory)?.name ?? selectedSubcategory);
  if (showFeaturedOnly) activeFilters.push('Destacados');
  if (priceMin) activeFilters.push(`Min: ${formatPrice(parseFloat(priceMin))}`);
  if (priceMax) activeFilters.push(`Max: ${formatPrice(parseFloat(priceMax))}`);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setPriceMin('');
    setPriceMax('');
    setShowFeaturedOnly(false);
  };

  const FiltersPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-3">Categorías</h3>
        <div className="space-y-1">
          <button
            className={cn(
              'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
              !selectedCategory ? 'bg-accent font-medium' : 'hover:bg-muted'
            )}
            onClick={() => { setSelectedCategory(''); setSelectedSubcategory(''); }}
          >
            Todas las categorías
          </button>
          {parents.map((parent) => {
            const subs = childrenOf[parent.id] ?? [];
            const isSel = selectedCategory === parent.slug;
            return (
              <div key={parent.id}>
                <button
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between',
                    isSel ? 'bg-accent font-medium' : 'hover:bg-muted'
                  )}
                  onClick={() => {
                    setSelectedCategory(isSel ? '' : parent.slug);
                    setSelectedSubcategory('');
                  }}
                >
                  {parent.name}
                  <ChevronDown className={cn('h-3 w-3 transition-transform', isSel && 'rotate-180')} />
                </button>
                {isSel && subs.length > 0 && (
                  <div className="ml-3 mt-0.5 space-y-0.5">
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                          selectedSubcategory === sub.slug ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                        )}
                        onClick={() => setSelectedSubcategory(selectedSubcategory === sub.slug ? '' : sub.slug)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="font-semibold text-sm mb-3">Precio</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="text-sm"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="font-semibold text-sm mb-3">Destacados</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showFeaturedOnly}
            onChange={(e) => setShowFeaturedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm">Solo productos destacados</span>
        </label>
      </div>

      {activeFilters.length > 0 && (
        <>
          <Separator />
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        </>
      )}
    </div>
  );

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-brand-sand/45">
        <LeafSprig className="pointer-events-none absolute -top-3 right-2 h-24 w-14 text-primary opacity-[0.1] rotate-12 sm:-top-6 sm:right-6 sm:h-40 sm:w-24" />
        <LeafSprig className="pointer-events-none absolute -bottom-4 -left-2 h-24 w-14 text-accent opacity-[0.08] -rotate-[20deg] sm:-bottom-6 sm:-left-3 sm:h-32 sm:w-20 md:h-40 md:w-24" />
        <Bloom className="pointer-events-none absolute right-1/3 -bottom-8 h-20 w-20 text-primary opacity-[0.06] hidden md:block" />
        <div className="container mx-auto px-4 py-8 relative">
          <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Catálogo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Cargando...' : `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px] hidden sm:flex">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevancia</SelectItem>
                <SelectItem value="price-asc">Precio: menor a mayor</SelectItem>
                <SelectItem value="price-desc">Precio: mayor a menor</SelectItem>
                <SelectItem value="name">Nombre A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile filter button */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Filtros
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)] p-4">
                  <FiltersPanel />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {activeFilters.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {f}
              </Badge>
            ))}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive">
              Limpiar todo
            </button>
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-36">
              <FiltersPanel />
            </div>
          </aside>

          {/* Products grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-3xl border border-border bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No se encontraron productos</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Intentá cambiar los filtros o la búsqueda
                </p>
                {activeFilters.length > 0 && (
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} categoryMap={categoryMap} />
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </StoreLayout>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogContent />
    </Suspense>
  );
}
