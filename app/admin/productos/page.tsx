'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { ImageUploader } from '@/components/admin/image-uploader';
import { VariantEditor, emptyVariantRow, type VariantFormRow } from '@/components/admin/variant-editor';
import { fetchExtraCategoryMap, type ExtraCategoryMap } from '@/lib/product-categories';

const NONE = 'none';

type FormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  stock: string;
  category_id: string;
  subcategory_id: string;
  extra_category_ids: string[];
  images: string[];
  featured: boolean;
  variants: VariantFormRow[];
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  price: '',
  stock: '',
  category_id: NONE,
  subcategory_id: NONE,
  extra_category_ids: [],
  images: [],
  featured: false,
  variants: [],
};

export default function ProductosPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extraMap, setExtraMap] = useState<ExtraCategoryMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setLoading(true);
    const [{ data: prods }, { data: cats }, extras] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      fetchExtraCategoryMap(),
    ]);
    setProducts((prods as Product[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setExtraMap(extras);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const parents = categories.filter((c) => !c.parent_id);
  const subcategoriesFor = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '-';

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      stock: String(p.stock),
      category_id: p.category_id ?? NONE,
      subcategory_id: p.subcategory_id ?? NONE,
      extra_category_ids: extraMap[p.id] ?? [],
      images: p.images ?? [],
      featured: p.featured,
      variants: [],
    });
    setDialogOpen(true);

    if (p.has_variants) {
      const { data } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', p.id)
        .order('sort_order');
      if (data) {
        setForm((prev) =>
          prev.id === p.id
            ? {
                ...prev,
                variants: data.map((v) => ({
                  id: v.id,
                  group_name: v.group_name,
                  label: v.label,
                  color_hex: v.color_hex ?? '',
                  image_url: v.image_url ?? '',
                  stock: String(v.stock),
                })),
              }
            : prev
        );
      }
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) {
      toast({ title: 'Falta completar nombre y precio', variant: 'destructive' });
      return;
    }

    const cleanVariants = form.variants
      .map((v, index) => ({ ...v, group_name: v.group_name.trim(), label: v.label.trim(), index }))
      .filter((v) => v.label);

    for (const v of cleanVariants) {
      if (!v.group_name) {
        toast({ title: 'Falta el nombre del grupo en una variante', description: `Completá el grupo (ej: "Color") para "${v.label}".`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      category_id: form.category_id === NONE ? null : form.category_id,
      subcategory_id: form.subcategory_id === NONE ? null : form.subcategory_id,
      images: form.images,
      featured: form.featured,
    };

    const { data: savedProduct, error } = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id).select().maybeSingle()
      : await supabase.from('products').insert(payload).select().maybeSingle();

    if (error || !savedProduct) {
      setSaving(false);
      toast({ title: 'No se pudo guardar el producto', description: error?.message, variant: 'destructive' });
      return;
    }

    const productId = savedProduct.id as string;

    // Categorías adicionales: se reemplazan por la lista actual (sin repetir
    // la categoría/subcategoría principal, que ya cuenta por sí sola).
    const extraIds = form.extra_category_ids.filter(
      (id) => id !== payload.category_id && id !== payload.subcategory_id
    );
    const { error: deleteExtrasError } = await supabase
      .from('product_extra_categories')
      .delete()
      .eq('product_id', productId);
    let extrasError = deleteExtrasError;
    if (!extrasError && extraIds.length > 0) {
      const { error: insertExtrasError } = await supabase
        .from('product_extra_categories')
        .insert(extraIds.map((category_id) => ({ product_id: productId, category_id })));
      extrasError = insertExtrasError;
    }
    if (extrasError) {
      toast({
        title: 'El producto se guardó, pero no se pudieron guardar las categorías adicionales',
        description: extrasError.message,
        variant: 'destructive',
      });
    }

    // Reemplaza todas las variantes existentes por la lista actual: más
    // simple y confiable que calcular altas/bajas/cambios fila por fila.
    const { error: deleteVariantsError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);

    if (deleteVariantsError) {
      setSaving(false);
      toast({ title: 'El producto se guardó, pero no se pudieron actualizar las variantes', description: deleteVariantsError.message, variant: 'destructive' });
      setDialogOpen(false);
      loadData();
      return;
    }

    if (cleanVariants.length > 0) {
      const { error: insertVariantsError } = await supabase.from('product_variants').insert(
        cleanVariants.map((v) => ({
          product_id: productId,
          group_name: v.group_name,
          label: v.label,
          color_hex: v.color_hex || null,
          image_url: v.image_url || null,
          stock: Number(v.stock) || 0,
          sort_order: v.index,
        }))
      );

      if (insertVariantsError) {
        setSaving(false);
        toast({ title: 'El producto se guardó, pero no se pudieron guardar las variantes', description: insertVariantsError.message, variant: 'destructive' });
        setDialogOpen(false);
        loadData();
        return;
      }
    }

    setSaving(false);
    toast({ title: form.id ? 'Producto actualizado' : 'Producto creado' });
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);

    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Producto eliminado' });
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-muted-foreground">{products.length} productos en el catálogo</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo producto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron productos.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {p.featured && <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />}
                    <span className="truncate max-w-[240px]">{p.name}</span>
                    {p.has_variants && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Variantes</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {categoryName(p.category_id)}
                  {p.subcategory_id && ` / ${categoryName(p.subcategory_id)}`}
                  {(extraMap[p.id]?.length ?? 0) > 0 && (
                    <span className="block text-xs">
                      + {extraMap[p.id].map((id) => categoryName(id)).join(', ')}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatPrice(p.price)}</TableCell>
                <TableCell>
                  <Badge variant={p.stock === 0 ? 'destructive' : p.stock <= 5 ? 'outline' : 'secondary'}>
                    {p.stock}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Riel de pesca 2.10m"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Precio</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v, subcategory_id: NONE })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin categoría</SelectItem>
                    {parents.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategoría</Label>
                <Select
                  value={form.subcategory_id}
                  onValueChange={(v) => setForm({ ...form, subcategory_id: v })}
                  disabled={form.category_id === NONE}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin subcategoría</SelectItem>
                    {subcategoriesFor(form.category_id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categorías adicionales</Label>
              <p className="text-xs text-muted-foreground">
                Marcá otras categorías en las que también tiene que aparecer este producto.
              </p>
              <div className="max-h-44 overflow-y-auto rounded-lg border p-3 space-y-1.5">
                {parents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Todavía no hay categorías.</p>
                )}
                {parents.map((parent) => (
                  <div key={parent.id} className="space-y-1.5">
                    <ExtraCategoryOption category={parent} form={form} setForm={setForm} />
                    {subcategoriesFor(parent.id).map((sub) => (
                      <div key={sub.id} className="pl-6">
                        <ExtraCategoryOption category={sub} form={form} setForm={setForm} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Imágenes</Label>
              <ImageUploader
                images={form.images}
                onChange={(images) => setForm({ ...form, images })}
              />
            </div>

            <div className="rounded-lg border p-3">
              <VariantEditor
                variants={form.variants}
                onChange={(variants) => setForm({ ...form, variants })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Producto destacado</p>
                <p className="text-xs text-muted-foreground">Aparece en la portada de la tienda</p>
              </div>
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => setForm({ ...form, featured: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar &quot;{deleteTarget?.name}&quot;? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExtraCategoryOption({
  category,
  form,
  setForm,
}: {
  category: Category;
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  const isMain = form.category_id === category.id || form.subcategory_id === category.id;
  const checked = isMain || form.extra_category_ids.includes(category.id);
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox
        checked={checked}
        disabled={isMain}
        onCheckedChange={(value) => {
          const next = value === true
            ? Array.from(new Set([...form.extra_category_ids, category.id]))
            : form.extra_category_ids.filter((id) => id !== category.id);
          setForm({ ...form, extra_category_ids: next });
        }}
      />
      <span>{category.name}</span>
      {isMain && <span className="text-xs text-muted-foreground">(principal)</span>}
    </label>
  );
}
