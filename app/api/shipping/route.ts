import { NextResponse } from 'next/server';
import { calculateShipping } from '@/lib/shipping';

interface QuoteItem {
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postalCode, province, items } = body as {
      postalCode: string;
      province?: string;
      items?: QuoteItem[];
    };

    if (!postalCode || postalCode.trim().length < 4) {
      return NextResponse.json(
        { success: false, error: 'Código postal inválido' },
        { status: 400 }
      );
    }

    // El cálculo (zonas, peso estimado y tarifas) vive en lib/shipping.ts.
    const itemCount = Array.isArray(items)
      ? items.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0)
      : 0;
    const { cost, zone } = calculateShipping({ postalCode, province, itemCount });

    return NextResponse.json({
      success: true,
      cost,
      zone,
      estimatedDays: '3 a 5 días hábiles',
      service: 'Correo Argentino - Paq.ar (Desde Mendoza Palmira)',
    });
  } catch (error) {
    console.error('Error in shipping calculation API:', error);
    return NextResponse.json(
      { success: false, error: 'Error al calcular el costo de envío' },
      { status: 500 }
    );
  }
}
