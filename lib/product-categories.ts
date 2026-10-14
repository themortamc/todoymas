import { supabase, type Category, type Product } from './supabase';

// product_id -> ids de las categorías ADICIONALES de ese producto
export type ExtraCategoryMap = Record<string, string[]>;

// Trae todas las categorías adicionales de todos los productos. Si la tabla
// todavía no existe (migración sin correr) o falla la consulta, devuelve un
// mapa vacío: la tienda sigue funcionando con la categoría principal.
export async function fetchExtraCategoryMap(): Promise<ExtraCategoryMap> {
  try {
    const { data, error } = await supabase
      .from('product_extra_categories')
      .select('product_id, category_id');
    if (error || !data) return {};
    const map: ExtraCategoryMap = {};
    for (const row of data as { product_id: string; category_id: string }[]) {
      (map[row.product_id] ??= []).push(row.category_id);
    }
    return map;
  } catch {
    return {};
  }
}

// Todas las categorías por las que un producto debe aparecer: la principal,
// la subcategoría, las adicionales y, para cada subcategoría, su categoría
// padre (así un producto en "Pesca > Reels" también aparece en "Pesca").
export function allCategoryIdsForProduct(
  product: Pick<Product, 'id' | 'category_id' | 'subcategory_id'>,
  extraMap: ExtraCategoryMap,
  categoryMap: Record<string, Category>
): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (!id) return;
    ids.add(id);
    const parentId = categoryMap[id]?.parent_id;
    if (parentId) ids.add(parentId);
  };
  add(product.category_id);
  add(product.subcategory_id);
  for (const id of extraMap[product.id] ?? []) add(id);
  return ids;
}
