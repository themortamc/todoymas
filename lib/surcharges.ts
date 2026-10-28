import { supabase } from './supabase';

export type SurchargeMap = Record<string, number>;
export type SurchargeScope = 'online' | 'mostrador';

// Los únicos métodos con recargo configurable, tanto online como en el
// mostrador: Efectivo, Mercado Pago, GoCuotas y Tarjetas. La `key` es el
// nombre de la fila en la tabla `payment_surcharges`.
export const SURCHARGE_METHODS: Record<SurchargeScope, { key: string; label: string }[]> = {
  online: [
    { key: 'efectivo', label: 'Efectivo' },
    { key: 'mercadopago_dinero', label: 'Mercado Pago (dinero en cuenta)' },
    { key: 'gocuotas', label: 'GoCuotas' },
    { key: 'mercadopago_tarjeta', label: 'Tarjetas (crédito y débito)' },
  ],
  mostrador: [
    { key: 'mostrador_efectivo', label: 'Efectivo' },
    { key: 'mostrador_mercadopago', label: 'Mercado Pago' },
    { key: 'mostrador_gocuotas', label: 'GoCuotas' },
    { key: 'mostrador_tarjeta', label: 'Tarjetas (crédito y débito)' },
  ],
};

// Valores iniciales (los mismos que carga la migración). Solo se usan si no
// se puede consultar la base; si la consulta anda, manda lo que hay en la base.
export const DEFAULT_SURCHARGES: SurchargeMap = {
  efectivo: 0,
  mercadopago_dinero: 0,
  gocuotas: 19,
  mercadopago_tarjeta: 18,
  mostrador_efectivo: 0,
  mostrador_mercadopago: 0,
  mostrador_gocuotas: 19,
  mostrador_tarjeta: 18,
};

export const ONLINE_SURCHARGE_KEYS = SURCHARGE_METHODS.online.map((m) => m.key);

// % de recargo para un método del checkout online. La transferencia nunca
// lleva recargo (no está entre los métodos configurables).
export function onlineSurchargePercent(map: SurchargeMap, paymentMethod: string): number {
  return ONLINE_SURCHARGE_KEYS.includes(paymentMethod) ? map[paymentMethod] ?? 0 : 0;
}

// Trae el % de recargo configurado de cada método desde `payment_surcharges`.
// Un método que no tenga fila en la base cuenta como 0%, igual que hace el
// servidor al cobrar, así lo que se muestra siempre coincide con lo que se
// cobra. Solo si la consulta falla del todo se usan los valores iniciales.
export async function fetchSurcharges(): Promise<SurchargeMap> {
  try {
    const { data, error } = await supabase.from('payment_surcharges').select('payment_method, surcharge_percent');
    if (error || !data) return { ...DEFAULT_SURCHARGES };
    const map: SurchargeMap = {};
    for (const row of data as { payment_method: string; surcharge_percent: number }[]) {
      map[row.payment_method] = Number(row.surcharge_percent) || 0;
    }
    return map;
  } catch {
    return { ...DEFAULT_SURCHARGES };
  }
}
