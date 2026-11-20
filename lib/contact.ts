export const WHATSAPP_NUMBER = '5492616657183';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  'Hola! Te escribo desde la web de Todo y Más.'
)}`;
export const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7c5BEJJhzV6n5nCC0H';
// Datos para que el cliente transfiera (alias de Mercado Pago o de cualquier
// banco). Recibir una transferencia no tiene comisión, a diferencia de cobrar
// por el checkout de Mercado Pago (~8%). Si TRANSFER_ALIAS queda vacío, la
// pantalla de pedido realizado manda a coordinar los datos por WhatsApp.
export const TRANSFER_ALIAS = 'cedai.vane.vega';
export const TRANSFER_HOLDER = 'Vanesa Beatriz Vega';

export const INSTAGRAM_HANDLE = 'todoymas307';
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;
export const TIKTOK_HANDLE = 'todoymas307';
export const TIKTOK_URL = `https://www.tiktok.com/@${TIKTOK_HANDLE}`;
// TODO: reemplazar por el link real de la página de Facebook del cliente.
export const FACEBOOK_URL = 'https://facebook.com/todoymas';
