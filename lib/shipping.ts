// Cálculo del costo de envío (Correo Argentino, origen Mendoza - Palmira, CP 5577).
//
// IMPORTANTE: estos valores son una TARIFA ESTIMADA fija, no una cotización
// real de Correo Argentino. Si Correo cobra más que esta tabla, la diferencia
// la absorbe el local. Para ajustar precios, se editan SHIPPING_ZONE_RATES y
// EXTRA_COST_PER_KG; no hay que tocar nada más.

export type ShippingZone = 'cuyo' | 'centro' | 'buenosAires' | 'resto';

export const SHIPPING_ZONE_RATES: Record<ShippingZone, number> = {
  cuyo: 2800, // Mendoza, San Juan, San Luis
  centro: 4200, // Córdoba, Santa Fe
  buenosAires: 4900, // CABA y Buenos Aires
  resto: 6500, // Patagonia, NEA, NOA y el resto del país
};

// Cada kg por encima de MIN_WEIGHT_KG suma este monto.
export const EXTRA_COST_PER_KG = 600;
// El peso real de los productos no se conoce: se estima por cantidad de unidades.
export const KG_PER_ITEM = 0.5;
export const MIN_WEIGHT_KG = 1;

const ZONE_ORDER: ShippingZone[] = ['cuyo', 'centro', 'buenosAires', 'resto'];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const PROVINCE_ZONE: Record<string, ShippingZone> = {
  mendoza: 'cuyo',
  'san juan': 'cuyo',
  'san luis': 'cuyo',
  cordoba: 'centro',
  'santa fe': 'centro',
  'buenos aires': 'buenosAires',
  'ciudad autonoma de buenos aires': 'buenosAires',
};

// Zona según la provincia elegida. Una provincia que no está en la tabla de
// arriba cae en "resto del país". Sin provincia devuelve null.
export function zoneFromProvince(province?: string | null): ShippingZone | null {
  if (!province || !province.trim()) return null;
  return PROVINCE_ZONE[normalize(province)] ?? 'resto';
}

function zoneFromLetter(letter: string): ShippingZone {
  if (letter === 'M' || letter === 'J' || letter === 'D') return 'cuyo'; // Mendoza, San Juan, San Luis
  if (letter === 'X' || letter === 'S') return 'centro'; // Córdoba, Santa Fe
  if (letter === 'C' || letter === 'B') return 'buenosAires'; // CABA y Buenos Aires
  return 'resto';
}

// Zona según el código postal. Con letra de provincia (formato CPA, ej.
// "X5000") la letra manda; sin letra se usan los rangos numéricos del código
// viejo de 4 dígitos, que son solo una aproximación (se superponen entre
// provincias), por eso `source` avisa de dónde salió la zona.
export function zoneFromPostalCode(postalCode: string): { zone: ShippingZone; source: 'letter' | 'numeric' } {
  const cp = postalCode.trim().toUpperCase();
  if (/^[A-Z]/.test(cp)) {
    return { zone: zoneFromLetter(cp.charAt(0)), source: 'letter' };
  }
  const n = parseInt(cp.replace(/\D/g, ''), 10);
  let zone: ShippingZone;
  if (n >= 5400 && n <= 5799) zone = 'cuyo';
  else if (n >= 2000 && n <= 5999) zone = 'centro';
  else if (n >= 1000 && n <= 1999) zone = 'buenosAires';
  else zone = 'resto';
  return { zone, source: 'numeric' };
}

// Si la provincia y el código postal no coinciden, se cobra la zona MÁS CARA:
// así un dato mal cargado nunca deja un envío por debajo de lo que corresponde.
export function resolveZone(postalCode: string, province?: string | null): ShippingZone {
  const fromCp = zoneFromPostalCode(postalCode);
  const fromProvince = zoneFromProvince(province);

  const candidates: ShippingZone[] = [];
  if (fromProvince) candidates.push(fromProvince);
  // Con la provincia elegida, el rango numérico del CP (aproximado) no cuenta;
  // la letra del CPA, en cambio, sí es un dato firme.
  if (fromCp.source === 'letter' || !fromProvince) candidates.push(fromCp.zone);

  return candidates.reduce((max, z) => (ZONE_ORDER.indexOf(z) > ZONE_ORDER.indexOf(max) ? z : max));
}

export type ShippingQuote = { cost: number; zone: ShippingZone; weightKg: number };

export function calculateShipping(input: {
  postalCode: string;
  province?: string | null;
  itemCount: number;
}): ShippingQuote {
  const itemCount = Number.isFinite(input.itemCount) && input.itemCount > 0 ? Math.floor(input.itemCount) : 1;
  const weightKg = Math.max(MIN_WEIGHT_KG, itemCount * KG_PER_ITEM);
  const zone = resolveZone(input.postalCode, input.province);
  const weightExtra = Math.max(0, weightKg - MIN_WEIGHT_KG) * EXTRA_COST_PER_KG;
  return { cost: Math.round(SHIPPING_ZONE_RATES[zone] + weightExtra), zone, weightKg };
}
