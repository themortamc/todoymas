import { getServerEnv } from '@/lib/server/env';

// Firma (HMAC-SHA256) que va en la URL del webhook de GoCuotas para cada
// pedido. GoCuotas no firma sus webhooks, así que sin esto cualquiera podía
// mandar un POST "approved" con el id de un pedido y marcarlo como pagado.
// Como la firma depende de un secreto del servidor, solo GoCuotas (que
// recibió la URL firmada al crear el checkout) puede llamarla.

const enc = new TextEncoder();

async function key(): Promise<CryptoKey> {
  const secret = await getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return crypto.subtle.importKey('raw', enc.encode(`gocuotas-webhook:v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function gocuotasWebhookToken(orderId: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', await key(), enc.encode(orderId)));
}

export async function verifyGocuotasWebhookToken(orderId: string, token: string | null): Promise<boolean> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = await gocuotasWebhookToken(orderId);
  // Comparación en tiempo constante.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
