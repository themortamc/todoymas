/*
# Recargos: solo Efectivo, Mercado Pago, GoCuotas y Tarjetas

Simplifica la tabla `payment_surcharges` para que, tanto online como en el
mostrador, los únicos métodos con recargo configurable sean:
Efectivo, Mercado Pago, GoCuotas y Tarjetas.

1. Filas que quedan (online / mostrador)
- efectivo                / mostrador_efectivo      (0%)
- mercadopago_dinero      / mostrador_mercadopago   (0%)
- gocuotas                / mostrador_gocuotas      (19%)
- mercadopago_tarjeta     / mostrador_tarjeta       (18%)

2. Qué hace
- Agrega las filas que falten (mostrador_mercadopago y mostrador_gocuotas).
  Las que ya existían NO se tocan: si ya cambiaste algún porcentaje desde el
  panel, se conserva.
- Borra las filas de métodos que ya no se configuran (transferencia online y
  transferencia/otro del mostrador). La transferencia online sigue
  existiendo como forma de pago, simplemente sin recargo.

3. Notes
- Solo toca la tabla de configuración de recargos. No modifica productos ni
  pedidos. Las ventas ya registradas conservan el recargo que tuvieron.
*/

INSERT INTO payment_surcharges (payment_method, surcharge_percent) VALUES
  ('efectivo', 0),
  ('mercadopago_dinero', 0),
  ('gocuotas', 19),
  ('mercadopago_tarjeta', 18),
  ('mostrador_efectivo', 0),
  ('mostrador_mercadopago', 0),
  ('mostrador_gocuotas', 19),
  ('mostrador_tarjeta', 18)
ON CONFLICT (payment_method) DO NOTHING;

DELETE FROM payment_surcharges
WHERE payment_method NOT IN (
  'efectivo',
  'mercadopago_dinero',
  'gocuotas',
  'mercadopago_tarjeta',
  'mostrador_efectivo',
  'mostrador_mercadopago',
  'mostrador_gocuotas',
  'mostrador_tarjeta'
);
