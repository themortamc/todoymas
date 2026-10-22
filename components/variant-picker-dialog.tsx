'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase, type Product, type ProductVariant } from '@/lib/supabase';
import type { CartVariant } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export type PickedVariant = {
  variant: CartVariant;
  /** Unidades disponibles de la opción elegida (el mínimo entre los grupos). */
  stock: number;
};

// Ventana para elegir color / talle / aroma / etc. de un producto con
// variantes sin tener que entrar a su ficha. Se usa en las tarjetas del
// catálogo y en la pantalla de ventas de mostrador.
export function VariantPickerDialog({
  product,
  open,
  onOpenChange,
  confirmLabel = 'Agregar',
  onConfirm,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmLabel?: string;
  onConfirm: (picked: PickedVariant) => void;
}) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !product) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setVariants([]);
    setSelected({});
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(true);
          setLoading(false);
          return;
        }
        const list = (data as ProductVariant[]) ?? [];
        setVariants(list);
        // Si un grupo tiene una sola opción, la dejamos elegida: no es una
        // decisión real y así se ahorra un toque.
        const groups = Array.from(new Set(list.map((v) => v.group_name)));
        const pre: Record<string, string> = {};
        groups.forEach((g) => {
          const opts = list.filter((v) => v.group_name === g);
          if (opts.length === 1 && opts[0].stock > 0) pre[g] = opts[0].id;
        });
        setSelected(pre);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  const { groupNames, grouped } = useMemo(() => {
    const names: string[] = [];
    const map: Record<string, ProductVariant[]> = {};
    for (const v of variants) {
      if (!map[v.group_name]) {
        map[v.group_name] = [];
        names.push(v.group_name);
      }
      map[v.group_name].push(v);
    }
    return { groupNames: names, grouped: map };
  }, [variants]);

  const selectedObjects = groupNames
    .map((g) => variants.find((v) => v.id === selected[g]))
    .filter((v): v is ProductVariant => !!v);
  const allSelected = groupNames.length > 0 && selectedObjects.length === groupNames.length;
  const stock = selectedObjects.length ? Math.min(...selectedObjects.map((v) => v.stock)) : null;
  const previewImage =
    selectedObjects.find((v) => v.image_url)?.image_url ?? product?.images[0] ?? null;
  const canConfirm = allSelected && (stock ?? 0) > 0;

  function handleConfirm() {
    if (!canConfirm || stock === null) return;
    onConfirm({
      variant: {
        id: selectedObjects.map((v) => v.id).join('+'),
        group_name: groupNames.join(', '),
        label: selectedObjects.map((v) => v.label).join(', '),
        color_hex: selectedObjects.find((v) => v.color_hex)?.color_hex ?? null,
        image_url: selectedObjects.find((v) => v.image_url)?.image_url ?? null,
      },
      stock,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.name ?? 'Elegí una opción'}</DialogTitle>
          <DialogDescription>
            {product ? `${formatPrice(product.price)} · ` : ''}Elegí las opciones antes de agregar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewImage} alt={product?.name ?? ''} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-sm text-muted-foreground self-center">
            {allSelected
              ? (stock ?? 0) > 0
                ? `${stock} ${stock === 1 ? 'disponible' : 'disponibles'}`
                : 'Sin stock en esta opción'
              : 'Elegí una opción de cada grupo para ver el stock.'}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando opciones...
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">No pudimos cargar las opciones. Probá de nuevo.</p>
        ) : groupNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este producto no tiene opciones cargadas.</p>
        ) : (
          <div className="space-y-4">
            {groupNames.map((group) => (
              <div key={group}>
                <p className="text-sm font-semibold mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {grouped[group].map((opt) => {
                    const isSelected = selected[group] === opt.id;
                    const optOut = opt.stock <= 0;
                    const pick = () => setSelected((prev) => ({ ...prev, [group]: opt.id }));

                    if (opt.image_url) {
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          title={`${opt.label}${optOut ? ' (sin stock)' : ''}`}
                          onClick={pick}
                          disabled={optOut}
                          className={cn(
                            'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                            isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                            optOut && 'opacity-30 cursor-not-allowed'
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={opt.image_url} alt={opt.label} className="h-full w-full object-cover" />
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                              <Check className="h-5 w-5 text-brand-cream drop-shadow" />
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
                          title={`${opt.label}${optOut ? ' (sin stock)' : ''}`}
                          onClick={pick}
                          disabled={optOut}
                          className={cn(
                            'relative h-10 w-10 rounded-full border-2 transition-all shrink-0',
                            isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                            optOut && 'opacity-30 cursor-not-allowed'
                          )}
                          style={{ backgroundColor: opt.color_hex }}
                        >
                          {isSelected && (
                            <Check className="absolute inset-0 m-auto h-4 w-4 text-brand-cream drop-shadow" />
                          )}
                        </button>
                      );
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={pick}
                        disabled={optOut}
                        className={cn(
                          'rounded-lg border-2 px-3.5 py-2 text-sm font-medium transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40',
                          optOut && 'opacity-40 cursor-not-allowed line-through'
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
