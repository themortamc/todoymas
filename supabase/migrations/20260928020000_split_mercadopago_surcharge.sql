/*
# Separar el recargo de Mercado Pago: tarjeta vs dinero en cuenta

El cliente no quiere que el recargo se aplique cuando alguien paga con el
dinero disponible en su cuenta de Mercado Pago - solo cuando paga con
tarjeta de crédito o débito. Como Mercado Pago no nos avisa de antemano con
qué método va a pagar el comprador (eso se elige adentro del checkout de
ellos), la única forma confiable de garantizar esto es crear DOS
preferencias distintas, cada una restringida (vía `excluded_payment_types`)
a un solo tipo de medio de pago:

- 'mercadopago_tarjeta': solo tarjetas. Lleva el recargo configurable.
- 'mercadopago_dinero': solo dinero en cuenta de Mercado Pago. Sin recargo.

1. Changes
- Renombra la fila 'mercadopago' de payment_surcharges a
  'mercadopago_tarjeta' (mantiene el mismo % que ya tenía configurado).
- Agrega la fila 'mercadopago_dinero' en 0%.
*/

UPDATE payment_surcharges
  SET payment_method = 'mercadopago_tarjeta'
  WHERE payment_method = 'mercadopago';

INSERT INTO payment_surcharges (payment_method, surcharge_percent) VALUES
  ('mercadopago_tarjeta', 18),
  ('mercadopago_dinero', 0)
ON CONFLICT (payment_method) DO NOTHING;
