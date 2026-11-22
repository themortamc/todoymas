import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { onlineSurchargePercent } from '../lib/surcharges';

const map = { gocuotas: 12, mercadopago_tarjeta: 15, efectivo: 0 };

describe('recargos online', () => {
  it('aplica el % configurado del método', () => {
    expect(onlineSurchargePercent(map, 'gocuotas')).toBe(12);
    expect(onlineSurchargePercent(map, 'mercadopago_tarjeta')).toBe(15);
  });
  it('transferencia y métodos desconocidos nunca llevan recargo', () => {
    expect(onlineSurchargePercent(map, 'transferencia')).toBe(0);
    expect(onlineSurchargePercent({ transferencia: 50 }, 'transferencia')).toBe(0);
  });
});
