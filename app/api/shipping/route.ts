import { NextResponse } from 'next/server';
import { CheckoutError, getPublicSupabase, loadCart, quoteShippingFor } from '@/lib/server/checkout';

// Cotización de envío para mostrar en el checkout. El peso sale de los
// productos de la base (no de lo que mande el navegador). El cobro real se
// vuelve a calcular en /api/checkout, así que esto es solo informativo.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const db = await getPublicSupabase();
    const cart = await loadCart(db, body?.items);
    const quote = quoteShippingFor(cart.shippingItems, body?.postalCode, body?.province);

    return NextResponse.json({
      success: true,
      zone: quote.zone,
      weightKg: quote.weightKg,
      domicilio: quote.domicilio,
      sucursal: quote.sucursal,
      estimatedDays: '2 a 5 días hábiles',
      service: 'Correo Argentino - Clásico',
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error in shipping calculation API:', error);
    return NextResponse.json({ success: false, error: 'Error al calcular el costo de envío' }, { status: 500 });
  }
}
