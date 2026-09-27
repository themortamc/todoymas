// Ilustraciones decorativas de plantas/hojas, pensadas para usarse como
// acentos de fondo (absolute + overflow-hidden en el contenedor padre).
// Usan currentColor para heredar color vía clases de texto (text-primary,
// text-accent, etc.) y opacidad vía las utilidades de Tailwind (/10, /20...).
//
// IMPORTANTE DE MARCA: los pétalos y las hojas son APUNTADOS (forma de
// almendra / gota), nunca óvalos ni elipses. Por eso ningún componente de
// este archivo usa <ellipse> para pétalos/hojas: todo se dibuja con <path>
// de punta afilada. Los únicos círculos permitidos son los anillos y el
// centro de los mandalas.

function pointedPetalUp(cx: number, tipY: number, baseY: number, halfWidth: number): string {
  // Pétalo apuntado vertical: punta afilada arriba, base angosta abajo,
  // vientre curvo a los costados. Nada de óvalos.
  const midY = (tipY + baseY) / 2;
  return `M${cx},${tipY} Q${cx + halfWidth},${midY} ${cx},${baseY} Q${cx - halfWidth},${midY} ${cx},${tipY} Z`;
}

/** Hoja apuntada vertical centrada en (0,0): punta arriba, base abajo. */
function pointedLeaf(rx: number, ry: number): string {
  // Curvas asimétricas: la hoja se ensancha hacia la base como una hoja
  // real (lanceolada), no simétrica como un óvalo.
  return `M0,${-ry} C${rx},${-ry * 0.25} ${rx * 1.05},${ry * 0.45} 0,${ry} C${-rx * 1.05},${ry * 0.45} ${-rx},${-ry * 0.25} 0,${-ry} Z`;
}

export function OrganicBlob({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M431.5 73.5C495 116 552 178 566 250.5c14 72.5-14 155.5-63.5 216.5C453 528 380 566 305 570.5c-75 4.5-153.5-24.5-207-79.5C44.5 436 16 355.5 21.5 278 27 200.5 66.5 126 128 82C189.5 38 273 24.5 344 33c71 8.5 24 -1.5 87.5 40.5Z"
      />
    </svg>
  );
}

export function LeafScatter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" className={className} fill="none" aria-hidden="true">
      <path
        d="M120 460c60-140 200-220 340-200-20 140-140 240-280 260-30 4-50-30-60-60Z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <path d="M150 445c70-110 190-170 290-165" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <circle cx="470" cy="120" r="5" fill="currentColor" opacity="0.3" />
      <circle cx="500" cy="150" r="3" fill="currentColor" opacity="0.25" />
      <circle cx="440" cy="95" r="3" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

// Ramita simple con un tallo y unas pocas hojas APUNTADAS, pensada para
// acentos chicos en esquinas (headers de sección, footer, estados vacíos).
export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 320" preserveAspectRatio="xMidYMid meet" className={className} fill="none" aria-hidden="true">
      <path
        d="M100 300C96 230 94 160 100 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Hojas apuntadas con nervadura central */}
      <g strokeLinecap="round">
        <path d="M100 250c-38-6-62-34-68-74 44 2 74 26 68 74Z" fill="currentColor" opacity="0.28" stroke="none" />
        <path d="M98 244 44 192" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <path d="M100 190c40-4 66-30 74-70-46 0-78 24-74 70Z" fill="currentColor" opacity="0.22" stroke="none" />
        <path d="M102 184l52-44" stroke="currentColor" strokeWidth="1" opacity="0.28" />
        <path d="M100 130c-32-6-52-28-58-62 38 2 62 22 58 62Z" fill="currentColor" opacity="0.3" stroke="none" />
        <path d="M98 124 54 80" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <path d="M100 70c26-6 42-22 48-48-32 2-52 18-48 48Z" fill="currentColor" opacity="0.25" stroke="none" />
        <path d="M102 64l30-30" stroke="currentColor" strokeWidth="1" opacity="0.28" />
      </g>
    </svg>
  );
}

// Enredadera horizontal: tallo sinuoso con hojitas apuntadas alternadas,
// pensada para correr a lo largo de un borde (top/bottom de una sección).
export function Vine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 90" preserveAspectRatio="xMidYMid meet" className={className} fill="none" aria-hidden="true">
      <path
        d="M0 45c40-30 80 30 120 0s80-30 120 0 80 30 120 0 80-30 140 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path d="M55 40c-4-16 6-28 22-30-2 18-8 28-22 30Z" fill="currentColor" opacity="0.28" />
      <path d="M135 20c10-14 26-14 38-4-14 10-26 12-38 4Z" fill="currentColor" opacity="0.24" />
      <path d="M215 60c-6-16 2-30 18-34 0 18-4 30-18 34Z" fill="currentColor" opacity="0.3" />
      <path d="M295 20c10-14 26-14 38-4-14 10-26 12-38 4Z" fill="currentColor" opacity="0.24" />
      <path d="M375 60c-6-16 2-30 18-34 0 18-4 30-18 34Z" fill="currentColor" opacity="0.28" />
      <circle cx="450" cy="42" r="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

// Flor simple de cinco pétalos APUNTADOS con centro, para sumar variedad
// de elementos naturales además de hojas (acentos chicos, poca opacidad).
export function Bloom({ className }: { className?: string }) {
  // Pétalo apuntado hacia arriba: punta en y=6, base cerca del centro.
  // (El control de la cuadrática rinde la mitad de ancho visual, por eso
  // se pasa el doble del ancho deseado.)
  const petalD = pointedPetalUp(50, 6, 46, 22);
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
      <g fill="currentColor">
        {petals.map((a) => (
          <path key={a} d={petalD} opacity="0.28" transform={`rotate(${a} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="10" opacity="0.4" />
        <circle cx="50" cy="50" r="4" opacity="0.5" />
      </g>
    </svg>
  );
}

// Mandala ornamental, en línea con el logo de la marca. Pensada como
// textura de fondo (poca opacidad, currentColor) para secciones grandes:
// hero, franjas de categorías, footer. Pétalos APUNTADOS (gota/almendra)
// repetidos por rotación — nunca óvalos.
export function Mandala({ className }: { className?: string }) {
  const C = 200;
  const ring = (r: number, len: number, halfW: number, count: number, opacity: number) => {
    const d = pointedPetalUp(C, C - r - len / 2, C - r + len / 2, halfW);
    const items = [];
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i;
      items.push(
        <path key={`${r}-${i}`} d={d} opacity={opacity} transform={`rotate(${angle} ${C} ${C})`} />
      );
    }
    return items;
  };

  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx={C} cy={C} r="190" opacity="0.15" />
        <circle cx={C} cy={C} r="150" opacity="0.18" />
        <circle cx={C} cy={C} r="60" opacity="0.25" />
      </g>
      <g fill="currentColor">
        {ring(170, 52, 20, 12, 0.16)}
        {ring(120, 68, 26, 12, 0.2)}
        {ring(70, 52, 22, 12, 0.26)}
        <circle cx={C} cy={C} r="16" opacity="0.32" />
      </g>
    </svg>
  );
}

// Isotipo de mandala/flor de loto para el logo (header, footer). A
// diferencia de <Mandala>, pensada como textura de fondo a baja opacidad,
// esta va a opacidad plena y tamaño chico, como el ícono de línea fina
// del manual de marca. Pétalos apuntados, sin óvalos.
export function LogoMark({ className }: { className?: string }) {
  const C = 50;
  const petals = (r: number, len: number, halfW: number, count: number) => {
    const d = pointedPetalUp(C, C - r - len / 2, C - r + len / 2, halfW);
    const items = [];
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i;
      items.push(
        <path key={`${r}-${i}`} d={d} transform={`rotate(${angle} ${C} ${C})`} />
      );
    }
    return items;
  };

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className={className} fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx={C} cy={C} r="47" strokeWidth="1" opacity="0.5" />
      <g>{petals(30, 24, 8, 8)}</g>
      <g>{petals(18, 20, 9, 8)}</g>
      <circle cx={C} cy={C} r="7" />
    </svg>
  );
}

// Mancha "pintada" (blob orgánico, no un círculo perfecto) para poner
// detrás de los íconos de categoría, imitando el trazo de acuarela/pincel
// del manual de marca. currentColor hereda el tinte pastel de cada rubro.
const BLOB_PATHS = [
  'M50 6c22 0 42 16 44 38 2 20-14 40-38 46-24 6-48-6-52-28C0 40 12 18 26 10 33 6 42 6 50 6Z',
  'M48 4c20-2 40 10 46 30 6 20-4 42-26 50-22 8-46 0-54-20C6 44 10 22 24 12 31 7 40 5 48 4Z',
  'M52 8c24-4 42 10 46 32 4 20-10 40-32 46-24 6-48-4-54-26C6 40 8 18 24 10c8-4 18-2 28-2Z',
];

export function PaintedBlob({
  className,
  variant = 0,
  style,
}: {
  className?: string;
  variant?: number;
  style?: React.CSSProperties;
}) {
  const d = BLOB_PATHS[Math.abs(variant) % BLOB_PATHS.length];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className={className} style={style} aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

// Mandala de línea fina, como el del manual de marca: solo contornos, para
// fondos grandes donde <Mandala> (con pétalos rellenos) resultaría pesado.
// Pétalos apuntados (gota), nunca óvalos.
export function MandalaLine({ className }: { className?: string }) {
  const C = 200;
  const ring = (r: number, len: number, halfW: number, count: number, opacity: number) => {
    const d = pointedPetalUp(C, C - r - len / 2, C - r + len / 2, halfW);
    const items = [];
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i;
      items.push(
        <path
          key={`${r}-${i}`}
          d={d}
          opacity={opacity}
          transform={`rotate(${angle} ${C} ${C})`}
        />
      );
    }
    return items;
  };

  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" className={className} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <circle cx={C} cy={C} r="196" opacity="0.5" />
      <circle cx={C} cy={C} r="168" opacity="0.45" />
      <circle cx={C} cy={C} r="74" opacity="0.5" />
      <circle cx={C} cy={C} r="30" opacity="0.55" />
      <g>{ring(150, 60, 24, 16, 0.5)}</g>
      <g>{ring(108, 48, 20, 12, 0.55)}</g>
      <g>{ring(56, 32, 15, 8, 0.6)}</g>
      <circle cx={C} cy={C} r="9" opacity="0.6" />
    </svg>
  );
}

// Paisaje de línea (montañas, sol y agua) calcado del manual de marca
// ("estilo de ilustraciones"). Pensado como acento de fondo en paneles
// claros: hero, banner de naturaleza. Hereda color vía currentColor.
export function MountainLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="252" cy="34" r="16" opacity="0.55" />
        <path d="M6 116 74 40l30 34 22-24 44 66Z" opacity="0.75" />
        <path d="M112 116 156 62l22 24 18-16 34 46Z" opacity="0.5" />
        <path d="M28 126c30-6 60-6 90 0s60 6 90 0 60-6 96 0" opacity="0.4" strokeWidth="1.2" />
        <path d="M40 134c30-5 60-5 90 0s60 5 90 0" opacity="0.25" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

// Ramita de eucalipto con hojas APUNTADAS lanceoladas (punta afilada y
// base angosta, con nervadura), calcada de las ilustraciones del manual
// de marca. Se usa en los bordes de las secciones grandes (hero,
// categorías, banner). Hereda color vía currentColor. Nunca óvalos.
export function LeafBranch({ className }: { className?: string }) {
  const leaves = [
    { cx: 36, cy: 272, rx: 10, ry: 22, rotate: -32 },
    { cx: 84, cy: 266, rx: 10, ry: 22, rotate: 30 },
    { cx: 35, cy: 222, rx: 10.5, ry: 23, rotate: -30 },
    { cx: 85, cy: 215, rx: 10.5, ry: 23, rotate: 28 },
    { cx: 36, cy: 170, rx: 10, ry: 22, rotate: -28 },
    { cx: 84, cy: 163, rx: 10, ry: 22, rotate: 27 },
    { cx: 38, cy: 120, rx: 9, ry: 20, rotate: -26 },
    { cx: 82, cy: 112, rx: 9, ry: 20, rotate: 25 },
    { cx: 42, cy: 72, rx: 8, ry: 17, rotate: -24 },
    { cx: 78, cy: 64, rx: 8, ry: 17, rotate: 23 },
    { cx: 64, cy: 26, rx: 8, ry: 18, rotate: 8 },
  ];
  return (
    <svg viewBox="0 0 120 320" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
      <path
        d="M60 318 C58 250 56 170 64 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.cx} ${l.cy}) rotate(${l.rotate})`}>
          <path d={pointedLeaf(l.rx, l.ry)} fill="currentColor" />
          {/* Nervadura: línea del tono del fondo para calar la hoja (vía
              style porque var() no funciona en atributos de presentación) */}
          <path
            d={`M0,${-l.ry * 0.72} L0,${l.ry * 0.72}`}
            style={{ stroke: 'hsl(var(--background))' }}
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.65"
          />
        </g>
      ))}
    </svg>
  );
}
