/*
# Más de una categoría por producto

Hasta ahora cada producto tenía una sola categoría (category_id) y una sola
subcategoría (subcategory_id). Esta migración permite sumarle categorías
adicionales a un producto, sin tocar lo que ya existe.

1. New Tables
- `product_extra_categories`: una fila por cada categoría ADICIONAL de un
  producto (puede ser una categoría principal o una subcategoría).
  - product_id (uuid, FK products, ON DELETE CASCADE)
  - category_id (uuid, FK categories, ON DELETE CASCADE)
  - PK (product_id, category_id)

2. Notes
- La categoría/subcategoría que ya tiene cada producto (category_id /
  subcategory_id) pasa a ser la "principal" y NO se modifica ni se migra:
  todos los productos quedan exactamente como están. Las categorías
  adicionales empiezan vacías.
- Si se borra un producto o una categoría, sus filas de acá se borran solas.

3. Security (RLS)
- SELECT: público (la tienda necesita leerlas para filtrar por categoría).
- INSERT/UPDATE/DELETE: solo admin, igual que la tabla products.
*/

CREATE TABLE IF NOT EXISTS product_extra_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_extra_categories_category
  ON product_extra_categories (category_id);

ALTER TABLE product_extra_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_product_extra_categories" ON product_extra_categories;
CREATE POLICY "public_select_product_extra_categories" ON product_extra_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_product_extra_categories" ON product_extra_categories;
CREATE POLICY "admin_insert_product_extra_categories" ON product_extra_categories FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_product_extra_categories" ON product_extra_categories;
CREATE POLICY "admin_update_product_extra_categories" ON product_extra_categories FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_product_extra_categories" ON product_extra_categories;
CREATE POLICY "admin_delete_product_extra_categories" ON product_extra_categories FOR DELETE
  TO authenticated USING (is_admin());
