# Backups

Cada lunes a las 03:00 (Argentina) corre `.github/workflows/backup.yml`. Copia la base de datos y las fotos de productos, lo cifra con AES-256 y lo guarda 90 días como artifact en GitHub Actions. Solo lee la base: no modifica nada.

## Configuración (una sola vez)

En GitHub: Settings → Secrets and variables → Actions → New repository secret.

1. `SUPABASE_DB_URL`: en Supabase, botón **Connect** → **Session pooler** (no "Direct connection": GitHub no tiene IPv6). Copiá la URI y reemplazá `[YOUR-PASSWORD]` por la contraseña de la base.
2. `BACKUP_PASSPHRASE`: una contraseña larga (20+ caracteres), por ejemplo la salida de `openssl rand -base64 32`. **Guardala en tu gestor de contraseñas: sin ella los backups no se pueden abrir.**

Para probar: Actions → "Backup semanal" → **Run workflow**.

> GitHub desactiva los workflows programados de repos públicos que pasan 60 días sin actividad. Si te llega ese mail, reactivalo con un clic en la pestaña Actions.

## Restaurar

**Nunca restaures encima de la base de producción.** Restaurá primero en un proyecto nuevo de Supabase y revisá ahí.

```bash
gpg -d todoymas-backup-AAAA-MM-DD.tar.gz.gpg > backup.tar.gz   # pide la passphrase
mkdir backup && tar -xzf backup.tar.gz -C backup

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backup/db/roles.sql \
  --file backup/db/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backup/db/data.sql \
  --dbname "URI_DEL_PROYECTO_NUEVO"
```

Las fotos quedan en `backup/product-images/`. Se suben al bucket `product-images` con los mismos nombres. Los comprobantes de transferencia (bucket privado) no están incluidos.
