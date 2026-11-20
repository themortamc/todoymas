import { getCloudflareContext } from '@opennextjs/cloudflare';

// Sirve las fotos de productos a través de Cloudflare en vez de directo desde
// Supabase Storage.
//
// Por qué: el plan gratis de Supabase incluye 5 GB/mes de tráfico de salida
// (egress) y cada visita bajaba las fotos desde Supabase. Acá la foto se pide
// a Supabase una sola vez y queda guardada en el caché de Cloudflare (y en el
// navegador del cliente), así que las visitas siguientes no consumen egress
// de Supabase.
//
// Las fotos se suben con nombre único (uuid) y nunca se pisan, así que se
// pueden cachear por un año sin riesgo de mostrar una versión vieja.

const BUCKET = 'product-images';
const FILE_RE = /^[A-Za-z0-9._-]{1,200}$/;
const ONE_YEAR = 60 * 60 * 24 * 365;

type CacheLike = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const parts = params.path ?? [];
  const [bucket, file] = parts;
  // Solo fotos públicas de productos (nunca comprobantes ni otros buckets).
  if (parts.length !== 2 || bucket !== BUCKET || !FILE_RE.test(file) || file.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!supabaseUrl) return new Response('Not configured', { status: 500 });

  const cache = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default;
  const cacheKey = new Request(new URL(`/img/${BUCKET}/${file}`, request.url).toString());

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`);
  if (!upstream.ok || !upstream.body) {
    // Supabase devuelve 400 cuando el archivo no existe.
    return new Response('Not found', {
      status: upstream.status >= 500 ? 502 : 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const headers = {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': `public, max-age=${ONE_YEAR}, immutable`,
    'X-Content-Type-Options': 'nosniff',
  };
  // X-Img-Cache: MISS = se pidió a Supabase; HIT = salió del caché de Cloudflare.
  const response = new Response(upstream.body, { status: 200, headers: { ...headers, 'X-Img-Cache': 'MISS' } });

  if (cache) {
    const cached = new Response(response.clone().body, { status: 200, headers: { ...headers, 'X-Img-Cache': 'HIT' } });
    const put = cache.put(cacheKey, cached).catch(() => {});
    try {
      getCloudflareContext().ctx.waitUntil(put);
    } catch {
      await put;
    }
  }

  return response;
}
