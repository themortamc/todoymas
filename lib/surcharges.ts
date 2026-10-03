import { supabase } from './supabase';

export type SurchargeMap = Record<string, number>;

export const DEFAULT_SURCHARGES: SurchargeMap = {
  mercadopago: 18,
  gocuotas: 19,
  transferencia: 0,
  efectivo: 0,
};

// Trae el % de recargo configurado para cada método de pago desde
// `payment_surcharges`. Si falla la consulta (sin conexión, etc.) devuelve
// los valores por defecto para que el checkout nunca se rompa, aunque el
// cobro real siempre se recalcula del lado del servidor igual.
export async function fetchSurcharges(): Promise<SurchargeMap> {
  try {
    const { data, error } = await supabase.from('payment_surcharges').select('payment_method, surcharge_percent');
    if (error || !data) return { ...DEFAULT_SURCHARGES };
    const map: SurchargeMap = {};
    for (const row of data as { payment_method: string; surcharge_percent: number }[]) {
      map[row.payment_method] = Number(row.surcharge_percent) || 0;
    }
    return { ...DEFAULT_SURCHARGES, ...map };
  } catch {
    return { ...DEFAULT_SURCHARGES };
  }
}
