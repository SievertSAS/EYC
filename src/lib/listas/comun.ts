// ============================================================
//  Piezas compartidas de los listados filtrables (visitas, solicitudes):
//  normalización de texto, rangos de fecha, lectura de query params y
//  agrupación por estado para el tablero kanban.
// ============================================================

export type VistaLista = "tabla" | "kanban";

export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Minúsculas y sin tildes: base de toda comparación de texto en los filtros. */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** true si algún campo contiene la búsqueda (ya normalizada). Búsqueda vacía = true. */
export function coincideBusqueda(q: string, campos: (string | undefined | null)[]): boolean {
  if (!q) return true;
  return campos.some((c) => !!c && normalizar(c).includes(q));
}

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Devuelve la fecha si es un YYYY-MM-DD real; si no, null. */
export function parseFecha(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = FECHA_RE.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === v ? v : null;
}

/**
 * Rango de fechas inclusivo, comparando solo el día (YYYY-MM-DD). Si hay
 * algún límite activo, un registro sin fecha queda fuera.
 */
export function dentroDeRango(
  fecha: string | undefined | null,
  desde: string | null,
  hasta: string | null
): boolean {
  if (!desde && !hasta) return true;
  if (!fecha) return false;
  const dia = fecha.slice(0, 10);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

/** Valores de una clave repetida (`?c=a&c=b`), sin vacíos ni duplicados. */
export function parseMultiple(
  params: URLSearchParams,
  clave: string,
  esValido: (v: string) => boolean = () => true
): string[] {
  const vistos = new Set<string>();
  for (const v of params.getAll(clave)) {
    if (v && esValido(v)) vistos.add(v);
  }
  return [...vistos];
}

export function parseVista(params: URLSearchParams): VistaLista {
  return params.get("vista") === "kanban" ? "kanban" : "tabla";
}

export function agregarMultiple(params: URLSearchParams, clave: string, valores: string[]): void {
  for (const v of valores) params.append(clave, v);
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Opciones únicas por `value`, sin vacíos, ordenadas por etiqueta (insensible a tildes). */
export function opcionesDistintas(opciones: (OpcionFiltro | undefined)[]): OpcionFiltro[] {
  const porValor = new Map<string, OpcionFiltro>();
  for (const o of opciones) {
    if (o && o.value && !porValor.has(o.value)) porValor.set(o.value, o);
  }
  return [...porValor.values()].sort((a, b) => collator.compare(a.label, b.label));
}

/** Coincidencia de un valor libre (p. ej. ciudad) contra una selección, sin tildes. */
export function incluyeNormalizado(seleccion: string[], valor: string | undefined): boolean {
  if (!valor) return false;
  const v = normalizar(valor.trim());
  return seleccion.some((s) => normalizar(s.trim()) === v);
}

export interface GrupoEstado<T, E extends string> {
  estado: E;
  items: T[];
}

/**
 * Agrupa por estado en el orden dado. Siempre devuelve una columna por
 * estado (aunque esté vacía); los estados fuera de `orden` se descartan.
 */
export function agruparPorEstado<T, E extends string>(
  items: T[],
  getEstado: (item: T) => string,
  orden: readonly E[]
): GrupoEstado<T, E>[] {
  const grupos = new Map<string, T[]>(orden.map((e) => [e, []]));
  for (const item of items) grupos.get(getEstado(item))?.push(item);
  return orden.map((estado) => ({ estado, items: grupos.get(estado)! }));
}
