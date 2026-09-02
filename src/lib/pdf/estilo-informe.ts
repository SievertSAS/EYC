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

// ─── Geometría (mm, A4 vertical) ───

export const MARGIN = 20;
export const PAGE_WIDTH = 210;
export const PAGE_HEIGHT = 297;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const HEADER_HEIGHT = 22;
/** Límite inferior de contenido antes de forzar salto de página. */
export const PAGE_BOTTOM = 275;
/** Alto de línea de párrafo. */
export const LINE_H = 4.2;

// ─── Espaciado vertical ───

/** Aire después de un bloque (tabla / imagen / figura). */
export const GAP_AFTER_BLOCK = 8;
/** Aire antes de un título de subsección. */
export const GAP_BEFORE_TITLE = 6;
/** Aire después de un título de subsección, antes de su contenido. */
export const GAP_AFTER_TITLE = 3;

// ─── Tablas ───

export const TABLE_STYLE = {
  theme: "grid" as const,
  headStyles: {
    fillColor: COLOR_PRIMARY,
    textColor: [255, 255, 255] as RGB,
    fontStyle: "bold" as const,
    fontSize: 7,
  },
  bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
  alternateRowStyles: { fillColor: COLOR_ALT_ROW },
  margin: { left: MARGIN, right: MARGIN },
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
 * de los tokens "vacíos" heredados ("NA", "N/A", "No reporta"…) → `DASH`.
 * Números y strings con contenido se devuelven como string tal cual.
 */
export function dato(v: unknown): string {
  if (v == null) return DASH;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : DASH;
  const s = String(v).trim();
  return TOKENS_VACIOS.has(s.toLowerCase()) ? DASH : s;
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
