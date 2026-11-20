// Cálculo del costo de envío por Correo Argentino (Clásico, MiCorreo).
//
// Cómo cobra Correo (y cómo lo replica este archivo):
// 1. La ZONA depende solo de la provincia de DESTINO (no de la distancia ni
//    del origen): 3 zonas, ver PROVINCE_ZONE.
// 2. El PESO FACTURABLE es el mayor entre el peso real y el volumétrico
//    (largo × ancho × alto en cm / 6000; si los tres lados suman más de
//    200 cm el divisor es 4000).
// 3. El precio sale de una tabla por ESCALONES de peso (hasta 500 g, 1, 2,
//    3, 5, 10, 15, 20 y 25 kg), distinta para entrega a domicilio y a
//    sucursal. Más de 25 kg va en varios bultos.
//
// ACTUALIZAR LA TABLA: cuando Correo aumenta, se editan RATE_TABLE (o se
// sube EXTRA_MARGIN_PERCENT). Nada más. Conviene cotizar en MiCorreo con la
// cuenta del local y copiar los valores.
//
// Fuente de los precios: tarifas de lista de MiCorreo, noviembre 2026
// (relevamiento de zendaenvios.com medido contra la API de MiCorreo). Los
// valores marcados "(est.)" no estaban publicados y se estimaron con la
// misma proporción entre escalones/zonas que los valores conocidos,
// redondeando hacia arriba.

export type ShippingZone = 1 | 2 | 3;
export type ShippingService = 'domicilio' | 'sucursal';

export const RATES_UPDATED_AT = '2026-11';

// Margen sobre la tarifa de Correo (embalaje, redondeos, aumentos sin
// actualizar). 0 = se cobra la tarifa de lista tal cual.
export const EXTRA_MARGIN_PERCENT = 0;

// Peso que se asume por unidad cuando el producto no tiene peso cargado.
export const DEFAULT_ITEM_WEIGHT_KG = 0.5;
// Máximo por bulto en Correo Argentino.
export const MAX_PACKAGE_KG = 25;

type Tier = { upToKg: number; domicilio: [number, number, number]; sucursal: [number, number, number] };

// [zona 1, zona 2, zona 3]
export const RATE_TABLE: Tier[] = [
  { upToKg: 0.5, domicilio: [9492, 10335, 10396], sucursal: [6480, 7118, 7357] },
  { upToKg: 1, domicilio: [10227, 11140, 11221], sucursal: [6739, 7415, 7745] },
  // Z3 domicilio, Z1 y Z3 sucursal (est.)
  { upToKg: 2, domicilio: [10529, 11505, 12000], sucursal: [8000, 8638, 9500] },
  { upToKg: 3, domicilio: [11118, 12541, 13379], sucursal: [8768, 9946, 11274] },
  { upToKg: 5, domicilio: [16914, 18953, 20907], sucursal: [14050, 16927, 19862] },
  // sucursal (est.)
  { upToKg: 10, domicilio: [22623, 26948, 32402], sucursal: [18800, 24100, 30800] },
  // Z2/Z3 domicilio y sucursal (est.)
  { upToKg: 15, domicilio: [35053, 41800, 50300], sucursal: [29200, 37300, 47700] },
  // Z2/Z3 domicilio y sucursal (est.)
  { upToKg: 20, domicilio: [42165, 50300, 60400], sucursal: [35100, 44900, 57400] },
  // todo (est.): +17% domicilio / +18% sucursal sobre el escalón anterior
  { upToKg: 25, domicilio: [49400, 58900, 70700], sucursal: [41500, 53000, 67800] },
];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// Zonas de Correo Argentino por provincia de destino.
const PROVINCE_ZONE: Record<string, ShippingZone> = {
  'ciudad autonoma de buenos aires': 1,
  'buenos aires': 1,
  cordoba: 1,
  'entre rios': 1,
  'la pampa': 1,
  'santa fe': 1,
  catamarca: 2,
  chaco: 2,
  corrientes: 2,
  formosa: 2,
  'la rioja': 2,
  mendoza: 2,
  misiones: 2,
  neuquen: 2,
  'rio negro': 2,
  'san juan': 2,
  'san luis': 2,
  'santiago del estero': 2,
  tucuman: 2,
  chubut: 3,
  jujuy: 3,
  salta: 3,
  'santa cruz': 3,
  'tierra del fuego': 3,
};

// Letra de provincia del CPA (ISO 3166-2:AR) -> nombre normalizado.
const CPA_LETTER_PROVINCE: Record<string, string> = {
  A: 'salta',
  B: 'buenos aires',
  C: 'ciudad autonoma de buenos aires',
  D: 'san luis',
  E: 'entre rios',
  F: 'la rioja',
  G: 'santiago del estero',
  H: 'chaco',
  J: 'san juan',
  K: 'catamarca',
  L: 'la pampa',
  M: 'mendoza',
  N: 'misiones',
  P: 'formosa',
  Q: 'neuquen',
  R: 'rio negro',
  S: 'santa fe',
  T: 'tucuman',
  U: 'chubut',
  V: 'tierra del fuego',
  W: 'corrientes',
  X: 'cordoba',
  Y: 'jujuy',
  Z: 'santa cruz',
};

export class ShippingError extends Error {}

export function zoneFromProvince(province?: string | null): ShippingZone | null {
  if (typeof province !== 'string' || !province.trim()) return null;
  return PROVINCE_ZONE[normalize(province)] ?? null;
}

// Acepta "5577", "M5577" o el CPA completo "M5577ABC" (con o sin espacios).
export function parsePostalCode(raw: unknown): { digits: number; letter: string | null } | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const cp = String(raw).replace(/\s+/g, '').toUpperCase();
  const m = /^([A-Z])?(\d{4})([A-Z]{3})?$/.exec(cp);
  if (!m) return null;
  const digits = parseInt(m[2], 10);
  if (digits < 1000) return null;
  return { digits, letter: m[1] ?? null };
}

// Zona a cobrar. La provincia manda; el código postal sirve para detectar
// errores de carga:
// - con letra de CPA: tiene que coincidir con la provincia, si no se rechaza.
// - sin letra: los CP 9000-9499 (Chubut, Santa Cruz, Tierra del Fuego) y
//   4400-4699 (Salta, Jujuy) son siempre zona 3, así que si se eligió otra
//   provincia se cobra zona 3 (nunca por debajo de lo que corresponde).
export function resolveZone(postalCode: unknown, province: unknown): ShippingZone {
  const cp = parsePostalCode(postalCode);
  if (!cp) throw new ShippingError('Código postal inválido. Escribí los 4 números (ej: 5577).');
  const provinceZone = zoneFromProvince(typeof province === 'string' ? province : null);
  if (!provinceZone) throw new ShippingError('Elegí una provincia válida.');

  if (cp.letter) {
    const letterProvince = CPA_LETTER_PROVINCE[cp.letter];
    if (!letterProvince || letterProvince !== normalize(province as string)) {
      throw new ShippingError('El código postal no corresponde a la provincia elegida. Revisalos.');
    }
    return provinceZone;
  }

  const n = cp.digits;
  const cpIsZone3 = (n >= 9000 && n <= 9499) || (n >= 4400 && n <= 4699);
  return cpIsZone3 ? 3 : provinceZone;
}

export type ShippingItem = {
  quantity: number;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== undefined && Number.isFinite(n) && n > 0 ? n : null;
};

// Peso facturable del paquete: el mayor entre la suma de pesos reales y la
// suma de pesos volumétricos (suma de volúmenes = caja bien armada).
export function billableWeightKg(items: ShippingItem[]): number {
  let real = 0;
  let volumetric = 0;
  for (const item of items) {
    const qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    if (!qty) continue;
    real += (positive(item.weightKg) ?? DEFAULT_ITEM_WEIGHT_KG) * qty;
    const l = positive(item.lengthCm);
    const w = positive(item.widthCm);
    const h = positive(item.heightCm);
    if (l && w && h) {
      const divisor = l + w + h > 200 ? 4000 : 6000;
      volumetric += ((l * w * h) / divisor) * qty;
    }
  }
  return Math.round(Math.max(real, volumetric) * 1000) / 1000;
}

function packagePrice(weightKg: number, zone: ShippingZone, service: ShippingService): number {
  const tier = RATE_TABLE.find((t) => weightKg <= t.upToKg) ?? RATE_TABLE[RATE_TABLE.length - 1];
  return tier[service][zone - 1];
}

// Precio de Correo para un peso total: hasta 25 kg es un bulto; más pesado
// se divide en bultos de 25 kg + el resto.
export function correoPrice(weightKg: number, zone: ShippingZone, service: ShippingService): number {
  let remaining = Math.max(weightKg, 0.001);
  let price = 0;
  while (remaining > MAX_PACKAGE_KG) {
    price += packagePrice(MAX_PACKAGE_KG, zone, service);
    remaining -= MAX_PACKAGE_KG;
  }
  price += packagePrice(remaining, zone, service);
  return Math.ceil((price * (1 + EXTRA_MARGIN_PERCENT / 100)) / 10) * 10;
}

export type ShippingQuote = {
  zone: ShippingZone;
  weightKg: number;
  domicilio: number;
  sucursal: number;
};

// Cotiza ambas modalidades. Tira ShippingError si el CP/provincia no sirven
// o no hay productos.
export function calculateShipping(input: { postalCode: unknown; province: unknown; items: ShippingItem[] }): ShippingQuote {
  const zone = resolveZone(input.postalCode, input.province);
  if (!Array.isArray(input.items) || input.items.length === 0) throw new ShippingError('El carrito está vacío.');
  const weightKg = billableWeightKg(input.items);
  if (weightKg <= 0) throw new ShippingError('El carrito está vacío.');
  return {
    zone,
    weightKg,
    domicilio: correoPrice(weightKg, zone, 'domicilio'),
    sucursal: correoPrice(weightKg, zone, 'sucursal'),
  };
}
