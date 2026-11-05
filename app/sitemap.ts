import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://todoymas307.com.ar').replace(/\/$/, '');
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/carrito`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
