import { describe, expect, it } from 'vitest';
import { withRunningBalance, waPhone, reminderLink, accountsCsv, type AccountBalance } from '../lib/fiado';

describe('saldo acumulado', () => {
  it('ordena por fecha y acumula compras, pagos y ajustes', () => {
    const r = withRunningBalance([
      { amount: -3000, created_at: '2026-11-03' },
      { amount: 10000, created_at: '2026-11-01' },
      { amount: '500.5', created_at: '2026-11-02' },
    ]);
    expect(r.map((m) => m.saldo)).toEqual([10000, 10500.5, 7500.5]);
  });
});

describe('teléfonos para WhatsApp', () => {
  it('acepta los formatos habituales', () => {
    expect(waPhone('261 665-7183')).toBe('5492616657183');
    expect(waPhone('0261 15 665 7183')).toBe('5492616657183');
    expect(waPhone('+54 9 261 6657183')).toBe('5492616657183');
    expect(waPhone('2634 15-27-9451')).toBe('5492634279451');
  });
  it('rechaza números incompletos o vacíos', () => {
    expect(waPhone('')).toBeNull();
    expect(waPhone('12345')).toBeNull();
  });
});

describe('recordatorio', () => {
  it('arma el link con el saldo y el nombre de pila', () => {
    const l = reminderLink('Juan Pérez', '2616657183', 12500)!;
    expect(l.startsWith('https://wa.me/5492616657183?text=')).toBe(true);
    expect(decodeURIComponent(l)).toContain('Hola Juan');
    expect(decodeURIComponent(l)).toContain('12.500');
  });
  it('no arma link sin deuda o sin teléfono', () => {
    expect(reminderLink('Ana', '2616657183', 0)).toBeNull();
    expect(reminderLink('Ana', null, 5000)).toBeNull();
  });
});

describe('exportar', () => {
  it('genera CSV con ; y escapa comillas', () => {
    const row = { name: 'Kiosco "El Sol"', phone: null, balance: 1500.5, credit_limit: null, last_movement_at: '2026-11-20T10:00:00Z' } as unknown as AccountBalance;
    const csv = accountsCsv([row]);
    expect(csv).toContain('Cliente;Teléfono;Saldo');
    expect(csv).toContain('"Kiosco ""El Sol""";;1500,50;;2026-11-20');
  });
});
