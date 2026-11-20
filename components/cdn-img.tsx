'use client';

import { forwardRef, type ImgHTMLAttributes } from 'react';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/product-images/`;

// Convierte la URL pública de Supabase de una foto de producto en la ruta
// /img/... que la sirve desde el caché de Cloudflare (ver app/img/[...path]).
// Cualquier otra URL se devuelve tal cual.
export function cdnImageUrl(url?: string | null): string {
  if (!url) return '';
  if (SUPABASE_URL && url.startsWith(PUBLIC_PREFIX)) {
    return `/img/product-images/${url.slice(PUBLIC_PREFIX.length)}`;
  }
  return url;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null };

// <img> para fotos de productos. Si por algún motivo la ruta de Cloudflare
// falla, vuelve sola a la URL original de Supabase: la foto nunca desaparece.
export const CdnImg = forwardRef<HTMLImageElement, Props>(function CdnImg({ src, onError, alt = '', ...rest }, ref) {
  const original = src || '';
  const cdn = cdnImageUrl(original);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={cdn}
      alt={alt}
      onError={(e) => {
        const img = e.currentTarget;
        if (cdn !== original && !img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = original;
          return;
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
});
