/*
# Etiqueta "En oferta" en los productos

1. Changes
- products.on_sale (boolean, por defecto false): marca un producto como
  "en oferta". La tienda muestra una etiqueta "En oferta" en la tarjeta y en
  la página del producto, y el catálogo puede filtrar solo las ofertas.

2. Notes
- Solo agrega una columna. Todos los productos existentes quedan sin la
  etiqueta (false); se activa producto por producto desde el panel.
- No cambia precios ni stock. Las reglas de acceso (quién puede editar
  productos) son las mismas de siempre: solo admin.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;
