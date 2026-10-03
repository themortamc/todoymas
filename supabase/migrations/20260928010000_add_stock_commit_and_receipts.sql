/*
# Stock online recién al confirmar el pedido (no por tenerlo en el carrito)
  + comprobante de transferencia adjunto

1. Problema que resuelve
- El carrito es 100% local (localStorage) y nunca tocaba el stock de
  Supabase. El stock de ventas de mostrador ya se descontaba bien
  (register_counter_sale), pero los pedidos ONLINE no descontaban stock
  en ningún lado: quedaba 100% manual desde el panel. Eso generaba el
  problema reportado: sin ningún descuento automático y prolijo, el stock
  terminaba quedando mal llevado a mano.
- La solución NO es "reservar" stock mientras algo está en el carrito (eso
  es justamente lo que el cliente no quiere: que un carrito abandonado le
  deje mercadería "trabada"). En cambio, el stock recién se descuenta en
  el momento exacto en que el pedido queda confirmado:
  - Efectivo / Transferencia: al crear el pedido (ya se consideran un
    compromiso firme, igual que antes).
  - Mercado Pago / GoCuotas: recién cuando el webhook confirma el pago
    ("aprobado") - nunca antes. Si el cliente abandona el checkout externo
    o el pago falla, el stock nunca se tocó.
- Si un pedido de efectivo/transferencia se cancela después, el stock se
  devuelve automáticamente (trigger), para que cancelar un pedido no deje
  stock perdido para siempre.

2. New Columns (orders)
- stock_committed_at (timestamptz, null): marca de cuándo se descontó el
  stock de este pedido. Sirve como "traba" atómica para no descontar dos
  veces (ej. reintentos del webhook).
- receipt_path (text, null): path dentro del bucket de storage
  'payment-receipts' del comprobante de transferencia que subió el cliente.

3. New Function
- commit_order_stock(p_order_id uuid): reclama atómicamente el pedido
  (stock_committed_at IS NULL -> now()) y descuenta products.stock según
  los items guardados en el propio pedido. Si ya se había reclamado, no
  hace nada (idempotente - se puede llamar varias veces sin problema,
  incluso en reintentos de webhook).
- attach_payment_receipt(p_order_id uuid, p_receipt_path text): guarda el
  path del comprobante en el pedido. Solo aplica a pedidos de
  transferencia.
- restore_stock_on_order_cancel(): trigger - al pasar un pedido a
  'cancelado' habiendo descontado stock, lo devuelve.

4. New Storage Bucket
- `payment-receipts`: bucket privado (no público) para comprobantes de
  transferencia, que suelen tener datos bancarios/personales.
  - INSERT: anon + authenticated (el cliente sube sin estar logueado)
  - SELECT/DELETE: solo authenticated (panel) - se accede con signed URLs,
    nunca con URL pública directa.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_committed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_amount numeric(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.commit_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_qty int;
  v_product_id uuid;
BEGIN
  -- Reclamo atómico: si ya se había descontado el stock de este pedido
  -- (ej. el webhook se reintentó), esta UPDATE no afecta ninguna fila y
  -- no hacemos nada más.
  UPDATE orders
    SET stock_committed_at = now()
    WHERE id = p_order_id AND stock_committed_at IS NULL
    RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_product_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- GREATEST(..., 0): a esta altura el pago ya está confirmado (o es un
    -- compromiso firme de efectivo/transferencia), así que no tiene
    -- sentido fallar la operación por falta de stock - simplemente no lo
    -- dejamos ir negativo, para que quede claro que se vendió de más.
    UPDATE products SET stock = GREATEST(stock - v_qty, 0) WHERE id = v_product_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_order_stock(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.attach_payment_receipt(p_order_id uuid, p_receipt_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
    SET receipt_path = p_receipt_path
    WHERE id = p_order_id AND payment_method = 'transferencia';
END;
$$;

REVOKE ALL ON FUNCTION public.attach_payment_receipt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_payment_receipt(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_qty int;
  v_product_id uuid;
BEGIN
  IF NEW.status = 'cancelado'
     AND OLD.status IS DISTINCT FROM 'cancelado'
     AND NEW.stock_committed_at IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) LOOP
      v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
      v_qty := COALESCE((v_item->>'quantity')::int, 0);
      IF v_product_id IS NOT NULL AND v_qty > 0 THEN
        UPDATE products SET stock = stock + v_qty WHERE id = v_product_id;
      END IF;
    END LOOP;
    NEW.stock_committed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON orders;
CREATE TRIGGER trg_restore_stock_on_cancel BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_order_cancel();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "anon_insert_payment_receipts" ON storage.objects;
CREATE POLICY "anon_insert_payment_receipts" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "authenticated_select_payment_receipts" ON storage.objects;
CREATE POLICY "authenticated_select_payment_receipts" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "authenticated_delete_payment_receipts" ON storage.objects;
CREATE POLICY "authenticated_delete_payment_receipts" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'payment-receipts');
