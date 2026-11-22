/*
# Envío: peso/medidas por producto, costo de envío guardado y pedidos creados por el servidor

1. Changes
- products.weight_kg, length_cm, width_cm, height_cm (opcionales): peso y
  medidas del producto ya embalado. El envío se cotiza con el mayor entre el
  peso real y el volumétrico (largo × ancho × alto / 6000). Si un producto no
  tiene peso cargado, se estima 0,5 kg por unidad.
- orders.shipping_cost: lo que se cobró de envío (ya incluido en total).
- orders.shipping_service: 'domicilio' o 'sucursal' (Correo Argentino), o
  null si es retiro en el local.
- Se borra la política "anon_insert_orders": los pedidos online ahora los crea
  el servidor (/api/checkout) con la service role, recalculando precios,
  envío y recargo desde la base. Antes cualquiera podía insertar un pedido
  con el total, los precios y el envío que quisiera.
- Los empleados no pueden cambiar shipping_cost ni shipping_service (mismo
  criterio que total/items).

2. Notes
- Solo agrega columnas (nullable o con default), no toca datos existentes.
- Las ventas de mostrador siguen igual: usan RPCs SECURITY DEFINER.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg numeric(8,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm numeric(6,1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm numeric(6,1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm numeric(6,1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_shipping_dims_positive') THEN
    ALTER TABLE products ADD CONSTRAINT products_shipping_dims_positive CHECK (
      (weight_kg IS NULL OR weight_kg > 0)
      AND (length_cm IS NULL OR length_cm > 0)
      AND (width_cm IS NULL OR width_cm > 0)
      AND (height_cm IS NULL OR height_cm > 0)
    );
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service text;

CREATE OR REPLACE FUNCTION public.enforce_employee_order_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.total IS DISTINCT FROM OLD.total
     OR NEW.items IS DISTINCT FROM OLD.items
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.mp_preference_id IS DISTINCT FROM OLD.mp_preference_id
     OR NEW.mp_payment_id IS DISTINCT FROM OLD.mp_payment_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
     OR NEW.shipping_service IS DISTINCT FROM OLD.shipping_service
  THEN
    RAISE EXCEPTION 'No tenés permiso para modificar ese dato del pedido';
  END IF;

  RETURN NEW;
END;
$$;
