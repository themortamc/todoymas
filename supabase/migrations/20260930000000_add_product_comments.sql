/*
# Comentarios de clientes en los productos

1. New Tables
- `product_comments`: comentarios (con puntaje opcional de 1 a 5 estrellas)
  que dejan los clientes en la página de cada producto.
  - product_id (FK products, ON DELETE CASCADE)
  - author_name (1 a 60 caracteres)
  - rating (1 a 5, opcional)
  - body (1 a 1000 caracteres)
  - approved (boolean, por defecto false): un comentario NO se muestra en la
    tienda hasta que el dueño lo aprueba desde /admin/comentarios.

2. Security (RLS)
- SELECT público: solo los comentarios aprobados.
- SELECT autenticado: todos (el panel necesita ver los pendientes).
- INSERT (cualquiera, sin cuenta): solo si approved = false, así nadie puede
  publicarse un comentario aprobado por su cuenta.
- UPDATE / DELETE: solo admin (aprobar, editar o borrar).

3. Anti-spam
- Los comentarios nacen sin aprobar, así que el spam nunca llega a mostrarse.
- Además, un trigger frena inundaciones: si ya entraron 10 comentarios en
  los últimos 10 minutos, rechaza los siguientes hasta que baje el ritmo.

4. Notes
- Solo agrega una tabla nueva. No toca productos, pedidos ni nada existente.
*/

CREATE TABLE IF NOT EXISTS product_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 1 AND 60),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_comments_product
  ON product_comments (product_id, approved, created_at DESC);

ALTER TABLE product_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_approved_comments" ON product_comments;
CREATE POLICY "public_select_approved_comments" ON product_comments FOR SELECT
  TO anon, authenticated USING (approved = true);

DROP POLICY IF EXISTS "auth_select_all_comments" ON product_comments;
CREATE POLICY "auth_select_all_comments" ON product_comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "anyone_insert_pending_comments" ON product_comments;
CREATE POLICY "anyone_insert_pending_comments" ON product_comments FOR INSERT
  TO anon, authenticated WITH CHECK (approved = false);

DROP POLICY IF EXISTS "admin_update_comments" ON product_comments;
CREATE POLICY "admin_update_comments" ON product_comments FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_comments" ON product_comments;
CREATE POLICY "admin_delete_comments" ON product_comments FOR DELETE
  TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION public.limit_comment_flood()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM product_comments WHERE created_at > now() - interval '10 minutes') >= 10 THEN
    RAISE EXCEPTION 'Estamos recibiendo muchos comentarios juntos. Probá de nuevo en unos minutos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_comment_flood ON product_comments;
CREATE TRIGGER trg_limit_comment_flood BEFORE INSERT ON product_comments
  FOR EACH ROW EXECUTE FUNCTION public.limit_comment_flood();
