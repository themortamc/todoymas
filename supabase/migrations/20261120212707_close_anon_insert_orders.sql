/*
# Cierra la inserción anónima de pedidos

Los pedidos online los crea el servidor (/api/checkout) con la service role,
recalculando precios, envío y recargo desde la base. Antes cualquiera podía
insertar un pedido con el total, los precios y el envío que quisiera.
*/

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
