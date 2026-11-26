/*
# Fiado / cuentas corrientes

Pedido de la dueña (2026-11-24): llevar el registro de los clientes que compran
"fiado" (crédito personal) y de lo que van pagando.

1. Tablas nuevas
- `customer_accounts`: clientes con cuenta corriente (nombre, teléfono, nota,
  límite opcional). No se borran si tienen movimientos (se archivan).
- `account_movements`: cada compra fiada (+) y cada pago (−). El saldo de un
  cliente es la suma de sus movimientos. Monto con signo:
    compra > 0 · pago < 0 · ajuste ≠ 0 (solo admin, para corregir errores).

2. Vista `account_balances` (security_invoker: respeta RLS) con saldo y
   último movimiento por cliente.

3. Funciones (SECURITY DEFINER, solo usuarios del panel):
- `register_fiado_sale`: registra la venta de mostrador con la función
  existente `register_counter_sale` (stock, precios del servidor, descuento
  máximo de empleados) y en la MISMA transacción suma la deuda al cliente.
  Respeta el límite de fiado si el cliente tiene uno.
- `register_account_payment`: registra un pago (total o parcial).
- `register_account_adjustment`: corrección manual, solo admin.

4. Permisos (RLS)
- Ver y crear clientes, y ver movimientos: personal del panel (admin y empleado).
- Los movimientos solo se crean por las funciones; borrar movimientos y
  clientes: solo admin.

5. No cambia nada existente: `register_counter_sale`, orders, productos y la
   tienda online quedan igual.
*/

-- Personal del panel = usuarios con perfil admin o empleado.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'empleado') FROM profiles WHERE id = auth.uid()),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  credit_limit numeric(12,2) CHECK (credit_limit IS NULL OR credit_limit >= 0),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('compra', 'pago', 'ajuste')),
  amount numeric(12,2) NOT NULL CHECK (
    (kind = 'compra' AND amount > 0) OR
    (kind = 'pago' AND amount < 0) OR
    (kind = 'ajuste' AND amount <> 0)
  ),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_method text,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_account_movements_account ON public.account_movements(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_movements_order ON public.account_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_name ON public.customer_accounts(lower(name));

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_accounts" ON public.customer_accounts FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "staff_insert_accounts" ON public.customer_accounts FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "staff_update_accounts" ON public.customer_accounts FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "admin_delete_accounts" ON public.customer_accounts FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "staff_select_movements" ON public.account_movements FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "admin_delete_movements" ON public.account_movements FOR DELETE TO authenticated USING (is_admin());
-- Sin políticas de INSERT/UPDATE: los movimientos se crean solo con las funciones de abajo.

CREATE OR REPLACE VIEW public.account_balances
WITH (security_invoker = true) AS
SELECT
  a.id, a.name, a.phone, a.notes, a.credit_limit, a.archived, a.created_at,
  COALESCE(SUM(m.amount), 0)::numeric(12,2) AS balance,
  MAX(m.created_at) AS last_movement_at
FROM public.customer_accounts a
LEFT JOIN public.account_movements m ON m.account_id = a.id
GROUP BY a.id;

GRANT SELECT ON public.account_balances TO authenticated;

-- Venta fiada: venta de mostrador + deuda, en una sola transacción.
CREATE OR REPLACE FUNCTION public.register_fiado_sale(
  p_account_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_discount numeric DEFAULT 0
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account customer_accounts%ROWTYPE;
  v_balance numeric(12,2);
  v_order orders;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'No tenés permiso para registrar fiados';
  END IF;

  -- Bloquea la cuenta para que dos ventas simultáneas no salteen el límite.
  SELECT * INTO v_account FROM customer_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.archived THEN
    RAISE EXCEPTION 'El cliente no existe o está archivado';
  END IF;

  v_order := register_counter_sale(p_items, 'fiado', v_account.name, p_notes, p_discount);

  IF v_account.credit_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM account_movements WHERE account_id = v_account.id;
    IF v_balance + v_order.total > v_account.credit_limit THEN
      RAISE EXCEPTION 'Con esta compra % pasaría su límite de fiado (%). Debe %.',
        v_account.name, v_account.credit_limit, v_balance;
    END IF;
  END IF;

  INSERT INTO account_movements (account_id, kind, amount, order_id, payment_method, note)
  VALUES (v_account.id, 'compra', v_order.total, v_order.id, 'fiado', p_notes);

  RETURN v_order;
END;
$$;

-- Pago del cliente (parcial o total).
CREATE OR REPLACE FUNCTION public.register_account_payment(
  p_account_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'efectivo',
  p_note text DEFAULT NULL
)
RETURNS account_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov account_movements;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'No tenés permiso para registrar pagos';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago tiene que ser mayor a cero';
  END IF;
  PERFORM 1 FROM customer_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente no existe';
  END IF;

  INSERT INTO account_movements (account_id, kind, amount, payment_method, note)
  VALUES (p_account_id, 'pago', -round(p_amount, 2), COALESCE(NULLIF(btrim(p_payment_method), ''), 'efectivo'), p_note)
  RETURNING * INTO v_mov;
  RETURN v_mov;
END;
$$;

-- Corrección manual del saldo (por ejemplo, cargar una deuda vieja). Solo admin.
CREATE OR REPLACE FUNCTION public.register_account_adjustment(
  p_account_id uuid,
  p_amount numeric,
  p_note text
)
RETURNS account_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov account_movements;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo el dueño puede corregir saldos';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'El ajuste no puede ser cero';
  END IF;
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'Escribí el motivo del ajuste';
  END IF;
  PERFORM 1 FROM customer_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente no existe';
  END IF;

  INSERT INTO account_movements (account_id, kind, amount, note)
  VALUES (p_account_id, 'ajuste', round(p_amount, 2), p_note)
  RETURNING * INTO v_mov;
  RETURN v_mov;
END;
$$;

REVOKE ALL ON FUNCTION public.register_fiado_sale(uuid, jsonb, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_account_payment(uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_account_adjustment(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_fiado_sale(uuid, jsonb, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_account_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_account_adjustment(uuid, numeric, text) TO authenticated;

-- Defensa en profundidad (aplicado aparte como `fiado_revoke_anon`): los visitantes sin
-- sesión no ejecutan las funciones ni leen las tablas (igual los bloqueaban is_staff y RLS).
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_fiado_sale(uuid, jsonb, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_account_payment(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_account_adjustment(uuid, numeric, text) FROM anon;
REVOKE ALL ON public.customer_accounts FROM anon;
REVOKE ALL ON public.account_movements FROM anon;
REVOKE ALL ON public.account_balances FROM anon;
