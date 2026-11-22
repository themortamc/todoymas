import { describe, expect, it } from 'vitest';
import { billableWeightKg, calculateShipping, correoPrice, resolveZone, ShippingError } from '../lib/shipping';

describe('zona de envío', () => {
  it('sale de la provincia (con o sin tildes)', () => {
    expect(resolveZone('5500', 'Mendoza')).toBe(2);
    expect(resolveZone('1414', 'Ciudad Autónoma de Buenos Aires')).toBe(1);
    expect(resolveZone('5000', 'Córdoba')).toBe(1);
  });
  it('CP patagónico sin letra nunca cobra menos que zona 3', () => {
    expect(resolveZone('9000', 'Mendoza')).toBe(3);
  });
  it('CPA con letra de otra provincia se rechaza', () => {
    expect(() => resolveZone('X5000ABC', 'Mendoza')).toThrow(ShippingError);
    expect(resolveZone('M5500ABC', 'Mendoza')).toBe(2);
  });
  it('rechaza CP o provincia inválidos', () => {
    expect(() => resolveZone('12', 'Mendoza')).toThrow(ShippingError);
    expect(() => resolveZone('5500', 'Narnia')).toThrow(ShippingError);
  });
});

describe('peso facturable', () => {
  it('usa 0,5 kg por unidad si no hay peso cargado', () => {
    expect(billableWeightKg([{ quantity: 3 }])).toBe(1.5);
  });
  it('cobra el volumétrico si es mayor que el real', () => {
    expect(billableWeightKg([{ quantity: 1, weightKg: 1, lengthCm: 30, widthCm: 30, heightCm: 30 }])).toBe(4.5);
  });
});

describe('precio de Correo', () => {
  it('usa el escalón correcto de la tabla', () => {
    expect(correoPrice(0.5, 2, 'domicilio')).toBe(10340); // 10335 redondeado hacia arriba a $10
    expect(correoPrice(0.6, 2, 'domicilio')).toBe(11140);
  });
  it('más de 25 kg se divide en bultos', () => {
    expect(correoPrice(30, 1, 'sucursal')).toBe(41500 + 14050);
  });
  it('carrito vacío no cotiza', () => {
    expect(() => calculateShipping({ postalCode: '5500', province: 'Mendoza', items: [] })).toThrow(ShippingError);
  });
  it('cotiza domicilio y sucursal para Mendoza', () => {
    const q = calculateShipping({ postalCode: '5500', province: 'Mendoza', items: [{ quantity: 1, weightKg: 0.4 }] });
    expect(q).toEqual({ zone: 2, weightKg: 0.4, domicilio: 10340, sucursal: 7120 });
  });
});
