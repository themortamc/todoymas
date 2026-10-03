/*
# Recargos por método de pago (configurable desde el panel)

1. New Tables
- `payment_surcharges`: un % de recargo por método de pago.
  - payment_method (text, PK): 'mercadopago' | 'gocuotas' | 'transferencia' | 'efectivo'
  - surcharge_percent (numeric): ej. 18 = 18%
  - updated_at

2. Security (RLS)
- SELECT: público (anon + authenticated) — el checkout necesita leer el %
  para mostrar el recargo y calcular el total antes de que el cliente pague.
- INSERT/UPDATE/DELETE: solo admin (is_admin()), vía el panel en
  /admin/pagos. Un empleado puede ver pero no cambiar los recargos.

3. Notes
- Semillas iniciales: Mercado Pago 18%, GoCuotas 19%, transferencia y
  efectivo 0% (se pueden cambiar desde el panel en cualquier momento).
- El checkout SIEMPRE recalcula el recargo del lado del servidor (en
  create-preference y en gocuotas/create-checkout) a partir de esta tabla
  antes de cobrar, para que nadie pueda manipular el % desde el navegador.
*/

CREATE TABLE IF NOT EXISTS payment_surcharges (
  payment_method text PRIMARY KEY,
  surcharge_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (surcharge_percent >= 0 AND surcharge_percent <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payment_surcharges (payment_method, surcharge_percent) VALUES
  ('mercadopago', 18),
  ('gocuotas', 19),
  ('transferencia', 0),
  ('efectivo', 0)
ON CONFLICT (payment_method) DO NOTHING;

ALTER TABLE payment_surcharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_payment_surcharges" ON payment_surcharges;
CREATE POLICY "public_select_payment_surcharges" ON payment_surcharges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_payment_surcharges" ON payment_surcharges;
CREATE POLICY "admin_insert_payment_surcharges" ON payment_surcharges FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_payment_surcharges" ON payment_surcharges;
CREATE POLICY "admin_update_payment_surcharges" ON payment_surcharges FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_payment_surcharges" ON payment_surcharges;
CREATE POLICY "admin_delete_payment_surcharges" ON payment_surcharges FOR DELETE
  TO authenticated USING (is_admin());

-- Helper que usan los endpoints de servidor (create-preference, gocuotas
-- create-checkout) para recalcular el recargo sin confiar en lo que mande
-- el navegador. SECURITY DEFINER + bypass de RLS vía el rol del dueño de
-- la función, igual que el resto de las funciones del proyecto.
CREATE OR REPLACE FUNCTION public.get_surcharge_percent(p_payment_method text)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT surcharge_percent FROM payment_surcharges WHERE payment_method = p_payment_method),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_surcharge_percent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_surcharge_percent(text) TO anon, authenticated;
