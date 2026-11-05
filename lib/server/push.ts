import { NextResponse } from 'next/server';
import { getServerEnv } from './env';
import { buildWebPushRequest } from './webpush';

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// 'ok'    -> el servicio de push aceptó el mensaje
// 'gone'  -> la suscripción ya no existe (el dispositivo la canceló): hay que borrarla
// 'error' -> falló por otro motivo
export type PushResult = 'ok' | 'gone' | 'error';

export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<PushResult> {
  try {
    const rawPrivate = await getServerEnv('VAPID_PRIVATE_KEY');
    if (!rawPrivate) {
      console.error('Falta configurar VAPID_PRIVATE_KEY');
      return 'error';
    }
    const siteUrl = (
      (await getServerEnv('NEXT_PUBLIC_SITE_URL')) || 'https://todoymas307.com.ar'
    ).replace(/\/$/, '');

    const { endpoint, headers, body } = await buildWebPushRequest({
      subscription: sub,
      payload,
      privateJwk: JSON.parse(rawPrivate),
      subject: siteUrl,
    });

    const res = await fetch(endpoint, { method: 'POST', headers, body });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) {
      console.error('El servicio de push respondió', res.status, (await res.text()).slice(0, 300));
      return 'error';
    }
    return 'ok';
  } catch (err) {
    console.error('Error enviando push:', err);
    return 'error';
  }
}

// Traduce los errores de requireAdmin() a respuestas HTTP. Devuelve null si es otro error.
export function pushAuthError(error: unknown) {
  const msg = error instanceof Error ? error.message : '';
  if (msg.startsWith('Unauthorized')) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }
  if (msg.startsWith('Forbidden')) {
    return NextResponse.json(
      { success: false, error: 'Solo el dueño puede activar los avisos.' },
      { status: 403 }
    );
  }
  return null;
}
