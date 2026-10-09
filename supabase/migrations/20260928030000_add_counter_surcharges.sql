/*
# Recargo en ventas de mostrador

Hasta ahora el recargo por método de pago solo existía en el checkout
online. Las ventas de mostrador (register_counter_sale) nunca lo aplicaban.

1. Changes
- payment_surcharges: nuevas filas con prefijo 'mostrador_' (una por método
  de pago del mostrador). Se editan desde /admin/pagos, en una sección
  aparte de los recargos online.
  - mostrador_tarjeta: 18% (igual que online)
  - mostrador_efectivo / mostrador_transferencia / mostrador_otro: 0%
- register_counter_sale: ahora calcula el recargo del lado del servidor
  (nunca confía en el navegador) sobre (subtotal - descuento), lo guarda en
  orders.surcharge_amount y lo suma al total.

2. Notes
- Solo agrega columnas/filas y reemplaza la función (misma firma). No toca
  productos ni ventas anteriores: las ventas viejas quedan con recargo 0.
- Mantiene todo lo de seguridad existente (tope de descuento del 15% para
  empleados, created_by, control de stock).
*/

INSERT INTO payment_surcharges (payment_method, surcharge_percent) VALUES
  ('mostrador_tarjeta', 18),
  ('mostrador_efectivo', 0),
  ('mostrador_transferencia', 0),
  ('mostrador_otro', 0)
ON CONFLICT (payment_method) DO NOTHING;

CREATE OR REPLACE FUNCTION register_counter_sale(
  p_items jsonb,
  p_payment_method text DEFAULT 'efectivo',
  p_customer_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_discount numeric DEFAULT 0
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product products%ROWTYPE;
  v_qty int;
  v_final_items jsonb := '[]'::jsonb;
  v_discount numeric(10,2) := GREATEST(COALESCE(p_discount, 0), 0);
  v_max_discount numeric(10,2);
  v_method text := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'efectivo');
  v_surcharge_percent numeric;
  v_surcharge numeric(10,2) := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para un producto';
    END IF;

    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos ya no existe';
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": quedan % unidades', v_product.name, v_product.stock;
    END IF;

    UPDATE products SET stock = stock - v_qty WHERE id = v_product.id;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_final_items := v_final_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_qty,
      'image', COALESCE(v_product.images[1], '')
    );
  END LOOP;

  IF NOT is_admin() THEN
    v_max_discount := round(v_subtotal * 0.15, 2);
    IF v_discount > v_max_discount THEN
      RAISE EXCEPTION 'Los empleados pueden descontar como máximo 15%% del total ($%). Para un descuento mayor pedile al dueño que lo cargue.', v_max_discount;
    END IF;
  END IF;

  -- Recargo del mostrador según el método de pago, sobre lo que queda
  -- después del descuento. Se calcula acá (servidor), no en el navegador.
  v_surcharge_percent := get_surcharge_percent('mostrador_' || v_method);
  v_surcharge := round(GREATEST(v_subtotal - v_discount, 0) * (COALESCE(v_surcharge_percent, 0) / 100), 2);

  v_total := GREATEST(v_subtotal - v_discount, 0) + v_surcharge;

  INSERT INTO orders (
    customer_name, status, shipping_method, channel, payment_method, notes, total, surcharge_amount, items, created_by
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Cliente de mostrador'),
    'entregado',
    'retiro',
    'mostrador',
    v_method,
    p_notes,
    v_total,
    v_surcharge,
    v_final_items,
    auth.uid()
  )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION register_counter_sale(jsonb, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_counter_sale(jsonb, text, text, text, numeric) TO authenticated;
