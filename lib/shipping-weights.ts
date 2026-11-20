// Peso estimado de envío por producto, para cuando no tiene peso cargado.
//
// La tienda no carga peso ni medidas, así que se estima a partir del NOMBRE
// del producto (reglas por palabra clave) y, si ninguna regla aplica, con un
// promedio por CATEGORÍA. Los valores son el peso FACTURABLE del paquete ya
// embalado (incluye caja y el peso volumétrico de los productos voluminosos),
// redondeado hacia arriba: es preferible cobrar un poco de más que absorber
// la diferencia.
//
// Para ajustar: se agrega o se cambia una regla en WEIGHT_RULES. La primera
// regla que coincide gana, así que las más específicas van primero.

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// [patrón sobre el nombre normalizado (sin acentos, minúsculas), kg]
export const WEIGHT_RULES: [RegExp, number][] = [
  // Electrodomésticos y cocina grandes
  [/air ?fryer|freidora/, 5],
  [/procesadora/, 4],
  [/set 5 piezas de cocina|bateria de cocina|juego de ollas/, 5],
  [/cafetera electrica/, 3],
  [/juguera|pochoclera|waflera|waffle|sandwichera|panquequera|pizza maker|maquina para donas/, 2.5],
  [/plancha a vapor|hervidor y termo/, 2],
  [/hervidor|minipimer|mixer|lonchera electrica/, 1.5],
  [/cafetera italiana|tetera|pava/, 1],
  [/batidora para cafe/, 0.3],

  // Muebles, organizadores y textiles
  [/rack organizador|estanteria|zapatero/, 5],
  [/escurridor de platos rejilla/, 1],
  [/escurridor/, 3],
  [/silla(s)? plegable|reposera/, 3],
  [/soporte (movible )?para tv/, 2.5],
  [/cortina/, 2],
  [/cubresillon tres cuerpos|fundas cubresillones|fundas de sillas con mantel/, 2],
  [/cubresillon|fundas? (de|para) sillas/, 1.5],
  [/sabana/, 1.5],

  // Vajilla y vidrio (pesado y con mucho embalaje)
  [/set 4 vasos/, 1.5],
  [/set .*(taza|plato|copa|vaso|jarra)|set tazas|copas/, 2.5],
  [/set .*molde|set de cubiertos|set de 5 aceiteros|botellas x3/, 2],
  [/jarra|set de especieros|rallador/, 1.5],
  [/taza individual|kit 5 utensilios|set cuchillo/, 0.8],

  // Termos, botellas y vasos térmicos
  [/kit termo|termo .*mate|termo y mate/, 2],
  [/termo(?!metro)|botella|taza (mug )?termica|vasos? (keep|termo)|vaso\/termo/, 1.2],

  // Herramientas y auto
  [/cargador de bateria|compresor/, 2],
  [/juego de atornilladores/, 1.5],

  // Electrónica
  [/camara de seguridad cuadruple/, 2],
  [/camara de seguridad/, 1],
  [/karaoke|purificador de agua/, 1.5],
  [/parlante|radio|farola|tv box|amplificador|rgb led panel/, 0.8],
  [/secador de pelo|pistola masajeadora|masajeador/, 1],
  [/planchita|buclera|plancha (para|de) pelo|depiladora|afeitadora|cortadora|patillera/, 0.6],
  [/auricular|cable|tarjeta de memoria|reloj|smartwatch|microfono/, 0.3],
  [/linterna|faro|receptor|cargador de carga|soporte de celular|glucometro|termometro|tensiometro|mini atornillador|kit 31/, 0.4],

  // Aromaterapia pesada
  [/lampara de sal|lampara sal/, 3],
  [/humificador|humidificador|hornito/, 0.8],

  // Cuidado personal en sets
  [/kit shampoo|set cremas|sales de bano/, 1],
];

// Promedio por categoría (nombre normalizado) cuando ninguna regla aplica.
export const CATEGORY_WEIGHTS: Record<string, number> = {
  aromaterapia: 0.3,
  belleza: 0.4,
  bazar: 1,
  'camping y aire libre': 1,
  electrodomesticos: 3,
  electronica: 0.6,
  hogar: 1,
  indumentaria: 0.5,
  pesca: 0.8,
  tecnologia: 0.3,
};

export const FALLBACK_WEIGHT_KG = 0.5;

export function estimateWeightKg(name: string, categoryName?: string | null): number {
  const n = normalize(name || '');
  for (const [rx, kg] of WEIGHT_RULES) {
    if (rx.test(n)) return kg;
  }
  const cat = categoryName ? CATEGORY_WEIGHTS[normalize(categoryName).trim()] : undefined;
  return cat ?? FALLBACK_WEIGHT_KG;
}
