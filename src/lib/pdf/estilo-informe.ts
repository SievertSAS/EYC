// ============================================================
//  Estilo compartido del pre-informe (equipo convencional)
//  Fuente única de constantes y helpers de estilo usados por
//  `generar-pre-informe.ts` y `secciones-convencional.ts`.
// ============================================================

export type RGB = [number, number, number];

// ─── Colores ───

export const COLOR_PRIMARY: RGB = [51, 65, 85];
export const COLOR_HEADER_BG: RGB = [241, 245, 249];
export const COLOR_GRAY: RGB = [100, 116, 139];
export const COLOR_BLACK: RGB = [30, 30, 30];
export const COLOR_ALT_ROW: RGB = [248, 250, 252];
export const COLOR_BORDER: RGB = [203, 213, 225];

/** Veredicto favorable / conforme. */
export const COLOR_OK: RGB = [16, 150, 80];
/** Veredicto no favorable / no conforme. */
export const COLOR_BAD: RGB = [220, 50, 50];
/** Veredicto pendiente (ámbar). */
export const COLOR_PENDIENTE: RGB = [217, 119, 6];

// ─── Unidades tipográficas ───

/** Milímetros por punto tipográfico. */
export const PT = 0.3528;
/** Interlineado sencillo natural de Helvetica (múltiplo del cuerpo). */
export const HELV = 1.149;
/** Descendente de Helvetica como fracción del cuerpo. */
const DESCENT = 0.21;

/** Convierte puntos a milímetros. */
export function pt(valor: number): number {
  return valor * PT;
}

/** Interlineado sencillo (mm) para un cuerpo de `size` pt. */
export function lineaSencilla(size: number): number {
  return size * HELV * PT;
}

/**
 * Distancia (mm) desde el borde superior de la caja de una línea hasta su
 * línea base. La caja mide `lineH` de alto y la línea base queda un
 * descendente por encima de su borde inferior (modelo de Word).
 */
export function baseDesdeTope(size: number, lineH: number = lineaSencilla(size)): number {
  return lineH - size * PT * DESCENT;
}

// ─── Geometría (mm, A4 vertical) ───

export const PAGE_WIDTH = 210;
export const PAGE_HEIGHT = 297;
export const MARGIN_TOP = 22.5;
export const MARGIN_BOTTOM = 18;
export const MARGIN_LEFT = 21;
export const MARGIN_RIGHT = 20;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
/** Borde derecho del área de contenido (x de los textos alineados a la derecha). */
export const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_RIGHT;
/** Borde superior del contenido en páginas con encabezado. */
export const CONTENT_TOP = MARGIN_TOP;
/** Límite inferior de contenido antes de forzar salto de página. */
export const PAGE_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;

// ─── Tipografía (pt) ───

export const FONT = {
  coverTitle: 22,
  h1: 13,
  h2: 11,
  h3: 9.5,
  body: 9,
  tableCaption: 8.5,
  tableHead: 8.5,
  tableBody: 8.5,
  /** Piso para tablas anchas que no entran a 8,5 pt (dejar comentario del motivo). */
  tableMin: 7.5,
  figureCaption: 8.5,
  headerFooter: 8,
  tocTitle: 13,
  tocEntry: 9,
} as const;

/** Alto de línea de párrafo: 9 pt × interlineado Helvetica × 1,12. */
export const LINE_H = FONT.body * HELV * 1.12 * PT;

// ─── Espaciado vertical (mm) ───

export const SPACE = {
  h1: { before: pt(12), after: pt(6) },
  h2: { before: pt(9), after: pt(4) },
  h3: { before: pt(6), after: pt(3) },
  paragraph: { after: pt(6) },
  tableCaption: { before: pt(8), after: pt(4) },
  table: { after: pt(8) },
  figureCaption: { before: pt(4), after: pt(8) },
  tocTitle: { after: pt(12) },
} as const;

/** Distancia de la línea base (última línea) de un título 1/2 a su regla inferior. */
export const TITLE_RULE_GAP = 2;

// ─── Tablas ───

/** Márgenes de página para autoTable: las tablas que saltan de página respetan encabezado y pie. */
export const TABLE_MARGIN = {
  top: MARGIN_TOP,
  right: MARGIN_RIGHT,
  bottom: MARGIN_BOTTOM,
  left: MARGIN_LEFT,
};

export const TABLE_STYLE = {
  theme: "grid" as const,
  headStyles: {
    fillColor: COLOR_PRIMARY,
    textColor: [255, 255, 255] as RGB,
    fontStyle: "bold" as const,
    fontSize: FONT.tableHead as number,
  },
  bodyStyles: { fontSize: FONT.tableBody as number, textColor: COLOR_BLACK },
  alternateRowStyles: { fillColor: COLOR_ALT_ROW },
  rowPageBreak: "avoid" as const,
  margin: TABLE_MARGIN,
};

type PlainObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge de overrides sobre `TABLE_STYLE` (los arrays se reemplazan). */
export function tableStyle<T extends PlainObject>(overrides: T): typeof TABLE_STYLE & T {
  return deepMerge(TABLE_STYLE as unknown as PlainObject, overrides) as typeof TABLE_STYLE & T;
}

function deepMerge(base: PlainObject, over: PlainObject): PlainObject {
  const out: PlainObject = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k] as PlainObject, v) : v;
  }
  return out;
}

// ─── Dato faltante ───

/** Marcador único de dato faltante en celdas de tabla. */
export const DASH = "—";

const TOKENS_VACIOS = new Set(["", "na", "n/a", "n/d", "no aplica", "no reporta", "-", "--"]);

/**
 * Normaliza un valor de celda: `null` / `undefined` / string vacío o cualquiera
 * de los tokens "vacíos" heredados ("NA", "N/A", "No reporta"…) → `fallback`
 * (por defecto `DASH`). Números y strings con contenido se devuelven como
 * string tal cual.
 */
export function dato(v: unknown, fallback: string = DASH): string {
  if (v == null) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : fallback;
  const s = String(v).trim();
  return TOKENS_VACIOS.has(s.toLowerCase()) ? fallback : s;
}

// ─── Veredicto: etiqueta y color ───

export type NivelVeredicto = "seccion" | "celda";

/**
 * Colores por etiqueta de veredicto. Acepta las dos familias de vocabulario:
 *  - nivel sección/general: FAVORABLE / NO FAVORABLE / PENDIENTE / NO APLICA
 *  - nivel celda de medición: Conforme / No conforme / No aplica / —
 * Devuelve `COLOR_GRAY` para "no aplica" y desconocidos.
 */
export function veredictoColor(label: string | undefined | null): RGB {
  switch (normalizarVeredicto(label)) {
    case "ok":
      return COLOR_OK;
    case "bad":
      return COLOR_BAD;
    case "pendiente":
      return COLOR_PENDIENTE;
    default:
      return COLOR_GRAY;
  }
}

type ClaseVeredicto = "ok" | "bad" | "pendiente" | "neutro";

function normalizarVeredicto(label: string | undefined | null): ClaseVeredicto {
  const s = (label ?? "").trim().toLowerCase().replace(/_/g, " ");
  if (s === "favorable" || s === "conforme") return "ok";
  if (s === "no favorable" || s === "no conforme") return "bad";
  if (s === "pendiente" || s === "no concluyente") return "pendiente";
  return "neutro";
}

interface CellHookData {
  section: string;
  column: { index: number };
  cell: { raw: unknown; styles: { textColor: unknown; fontStyle: string } };
}

/**
 * Factory de `didParseCell` para jspdf-autotable: colorea (y pone en negrita) la
 * celda de la columna `columnIndex` del cuerpo según su veredicto.
 */
export function didParseVeredictoCell(columnIndex: number) {
  return (data: CellHookData) => {
    if (data.section !== "body" || data.column.index !== columnIndex) return;
    const clase = normalizarVeredicto(String(data.cell.raw));
    if (clase === "neutro") return;
    data.cell.styles.textColor =
      clase === "ok" ? COLOR_OK : clase === "bad" ? COLOR_BAD : COLOR_PENDIENTE;
    data.cell.styles.fontStyle = "bold";
  };
}
