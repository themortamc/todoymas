# todoymas
Tienda real (Next.js 14 + Supabase + Cloudflare Workers/OpenNext). Push a main = deploy automático en ~2 min.
- Verificar: `npm run typecheck`, `npm run lint`, `npm test` (vitest), `npm run build`. El hook Stop corre typecheck+lint.
- Hay pre-push en .git/hooks: nunca `--no-verify`.
- Preguntar antes de tocar la DB de Supabase (migraciones en `supabase/migrations/`), pagos o dominio.
- Recargos y alias de pago son decisión de la dueña: no cambiar sin pedido (ver memoria todoymas-proyecto).
- Envío en `lib/shipping.ts` y `lib/shipping-weights.ts`; contacto/alias en `lib/contact.ts`.
