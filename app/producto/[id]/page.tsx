'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Minus, Plus, Check, Truck, Store, ShieldCheck, Package } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LeafSprig, Bloom } from '@/components/decorative-plants';
import { useCart, type CartVariant } from '@/lib/cart-context';
import { supabase, type Product, type Category, type ProductVariant } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<Category | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantByGroup, setSelectedVariantByGroup] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!prod) {
        setLoading(false);
        return;
      }

      setProduct(prod as Product);

      if ((prod as Product).has_variants) {
        const { data: vars } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', id)
          .order('sort_order');
        const list = (vars as ProductVariant[]) ?? [];
        setVariants(list);
        // Si un grupo tiene una sola opción, la preseleccionamos para no
        // obligar a tocar algo que no es realmente una elección.
        const groups = Array.from(new Set(list.map((v) => v.group_name)));
        const preselected: Record<string, string> = {};
        groups.forEach((g) => {
          const opts = list.filter((v) => v.group_name === g);
          if (opts.length === 1) preselected[g] = opts[0].id;
        });
        setSelectedVariantByGroup(preselected);
      }

      if ((prod as Product).category_id) {
        const { data: cat } = await supabase
          .from('categories')
          .select('*')
          .eq('id', (prod as Product).category_id!)
          .maybeSingle();
        setCategory(cat as Category | null);
      }

      if ((prod as Product).subcategory_id) {
        const { data: sub } = await supabase
          .from('categories')
          .select('*')
          .eq('id', (prod as Product).subcategory_id!)
          .maybeSingle();
        setSubcategory(sub as Category | null);
      }

      if ((prod as Product).category_id) {
        const { data: rel } = await supabase
          .from('products')
          .select('*')
          .eq('category_id', (prod as Product).category_id)
          .neq('id', id)
          .limit(4);
        setRelated((rel as Product[]) ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square rounded-xl bg-muted animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse" />
              <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (!product) {
    notFound();
  }

  const outOfStockBase = product.stock <= 0;

  // Variantes agrupadas (ej: "Color" -> [Rojo cereza, Bordó...]),
  // conservando el orden en que aparecen.
  const groupNames: string[] = [];
  const groupedVariants: Record<string, ProductVariant[]> = {};
  for (const v of variants) {
    if (!groupedVariants[v.group_name]) {
      groupedVariants[v.group_name] = [];
      groupNames.push(v.group_name);
    }
    groupedVariants[v.group_name].push(v);
  }

  const hasVariants = groupNames.length > 0;
  const allGroupsSelected = groupNames.every((g) => !!selectedVariantByGroup[g]);
  const selectedVariantObjects = groupNames
    .map((g) => variants.find((v) => v.id === selectedVariantByGroup[g]))
    .filter((v): v is ProductVariant => !!v);

  // Si la variante elegida tiene foto propia (ej: el labial en "Rojo
  // cereza"), la mostramos primero en la galería en vez de la genérica.
  const activeVariantImage = selectedVariantObjects.find((v) => v.image_url)?.image_url ?? null;
  const images = activeVariantImage
    ? [activeVariantImage, ...product.images.filter((img) => img !== activeVariantImage)]
    : product.images.length > 0
      ? product.images
      : [''];

  const variantStock = selectedVariantObjects.length
    ? Math.min(...selectedVariantObjects.map((v) => v.stock))
    : null;

  const outOfStock = hasVariants
    ? (allGroupsSelected ? (variantStock ?? 0) <= 0 : false)
    : outOfStockBase;

  const maxQuantity = hasVariants && allGroupsSelected ? (variantStock ?? 0) : product.stock;

  const cartVariant: CartVariant | undefined = hasVariants && allGroupsSelected
    ? {
        id: selectedVariantObjects.map((v) => v.id).join('+'),
        group_name: groupNames.join(', '),
        label: selectedVariantObjects.map((v) => v.label).join(', '),
        color_hex: selectedVariantObjects.find((v) => v.color_hex)?.color_hex ?? null,
        image_url: activeVariantImage,
      }
    : undefined;

  function selectVariant(group: string, variantId: string) {
    setSelectedVariantByGroup((prev) => ({ ...prev, [group]: variantId }));
    setQuantity(1);
    setSelectedImage(0);
  }

  const handleAddToCart = () => {
    if (hasVariants && !allGroupsSelected) return;
    addItem(product, quantity, cartVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <StoreLayout>
      <div className="relative overflow-hidden">
        <LeafSprig className="pointer-events-none absolute -top-3 right-2 h-20 w-12 text-primary opacity-[0.08] rotate-12 sm:-top-6 sm:right-6 sm:h-32 sm:w-20" />
        <Bloom className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 text-accent opacity-[0.07] hidden md:block" />
        <div className="container mx-auto px-4 py-8 relative">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span>/</span>
          <Link href="/catalogo" className="hover:text-primary">Catálogo</Link>
          {category && (
            <>
              <span>/</span>
              <Link href={`/catalogo?categoria=${category.slug}`} className="hover:text-primary">
                {category.name}
              </Link>
            </>
          )}
          {subcategory && (
            <>
              <span>/</span>
              <span className="text-foreground">{subcategory.name}</span>
            </>
          )}
        </div>

        <Link href="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
              {images[selectedImage] && !imgErrors[selectedImage] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  onError={() => setImgErrors((prev) => ({ ...prev, [selectedImage]: true }))}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  Sin imagen
                </div>
              )}
              {product.featured && (
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                  Destacado
                </Badge>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      'h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      selectedImage === i ? 'border-primary' : 'border-border'
                    )}
                  >
                    {img && !imgErrors[i] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={`${product.name} ${i + 1}`}
                        onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              {category && (
                <Link href={`/catalogo?categoria=${category.slug}`}>
                  <Badge variant="secondary" className="mb-2">{category.name}</Badge>
                </Link>
              )}
              <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
            </div>

            <div className="flex items-center gap-2">
              {hasVariants && !allGroupsSelected ? (
                <Badge variant="secondary">Elegí una opción para ver el stock</Badge>
              ) : outOfStock ? (
                <Badge variant="destructive">Sin stock</Badge>
              ) : (
                <Badge className="bg-success text-success-foreground">
                  <Check className="h-3 w-3 mr-1" />
                  {hasVariants ? variantStock : product.stock} disponibles
                </Badge>
              )}
            </div>

            {hasVariants && (
              <div className="space-y-4">
                {groupNames.map((group) => (
                  <div key={group}>
                    <p className="text-sm font-semibold mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {groupedVariants[group].map((opt) => {
                        const isSelected = selectedVariantByGroup[group] === opt.id;
                        const optOutOfStock = opt.stock <= 0;
                        if (opt.image_url) {
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              title={`${opt.label}${optOutOfStock ? ' (sin stock)' : ''}`}
                              onClick={() => selectVariant(group, opt.id)}
                              disabled={optOutOfStock}
                              className={cn(
                                'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                                isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                                optOutOfStock && 'opacity-30 cursor-not-allowed'
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={opt.image_url} alt={opt.label} className="h-full w-full object-cover" />
                              {isSelected && (
                                <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                                  <Check className="h-5 w-5 text-white drop-shadow" />
                                </span>
                              )}
                              <span className="absolute bottom-0 inset-x-0 truncate bg-background/85 px-1 py-0.5 text-[10px] font-medium leading-tight">
                                {opt.label}
                              </span>
                            </button>
                          );
                        }
                        if (opt.color_hex) {
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              title={`${opt.label}${optOutOfStock ? ' (sin stock)' : ''}`}
                              onClick={() => selectVariant(group, opt.id)}
                              disabled={optOutOfStock}
                              className={cn(
                                'relative h-10 w-10 rounded-full border-2 transition-all shrink-0',
                                isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                                optOutOfStock && 'opacity-30 cursor-not-allowed'
                              )}
                              style={{ backgroundColor: opt.color_hex }}
                            >
                              {isSelected && (
                                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                              )}
                            </button>
                          );
                        }
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => selectVariant(group, opt.id)}
                            disabled={optOutOfStock}
                            className={cn(
                              'rounded-lg border-2 px-3.5 py-2 text-sm font-medium transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/40',
                              optOutOfStock && 'opacity-40 cursor-not-allowed line-through'
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Descripción</h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.description ?? 'Sin descripción disponible.'}
              </p>
            </div>

            <Separator />

            {/* Quantity + Add to cart */}
            {!outOfStock && (
              <div className="flex items-center gap-3">
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={hasVariants && !allGroupsSelected}
                >
                  {added ? (
                    <><Check className="h-4 w-4 mr-2" /> Agregado al carrito</>
                  ) : (
                    <><ShoppingCart className="h-4 w-4 mr-2" /> Agregar al carrito</>
                  )}
                </Button>
              </div>
            )}

            {/* Shipping info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Truck className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Envío a domicilio</p>
                  <p className="text-xs text-muted-foreground">A todo el país</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Store className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Retiro en local</p>
                  <p className="text-xs text-muted-foreground">Sin costo</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Compra segura</p>
                  <p className="text-xs text-muted-foreground">Pago protegido</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos relacionados
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {related.map((p) => (
                <ProductCardMini key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        </div>
      </div>
    </StoreLayout>
  );
}

function ProductCardMini({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/producto/${product.id}`}>
      <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-lg">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.images[0] && !imgError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
          <p className="text-lg font-bold text-primary mt-1">{formatPrice(product.price)}</p>
        </div>
      </div>
    </Link>
  );
}


