// ============================================================
//  Fecha parcial — "AAAA", "AAAA-MM" o "AAAA-MM-DD"
//
//  No todos los fabricantes reportan la fecha completa de fabricación: a veces
//  solo el año, o año y mes. Se guarda como texto ISO parcial (ordenable
//  lexicográficamente) y se muestra en el orden local (dd/mm/aaaa, mm/aaaa).
//  La columna en Supabase valida el mismo formato (migración 043).
// ============================================================

export interface PartesFecha {
  anio: string;
  mes: string;
  dia: string;
}

const PATRON = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const VACIA: PartesFecha = { anio: "", mes: "", dia: "" };

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Separa un valor guardado en sus partes. Vacío o no reconocible → partes vacías. */
export function parseFechaParcial(v: string | null | undefined): PartesFecha {
  const m = (v ?? "").trim().match(PATRON);
  if (!m) return { ...VACIA };
  return { anio: m[1], mes: m[2] ?? "", dia: m[3] ?? "" };
}

/**
 * Arma el valor a guardar. "" si no hay año (campo vacío); `null` si las
 * partes no forman una fecha válida (año incompleto, día inexistente). El día
 * se ignora si no hay mes.
 */
export function componerFechaParcial({ anio, mes, dia }: PartesFecha): string | null {
  if (anio === "") return "";
  if (!/^\d{4}$/.test(anio)) return null;
  if (mes === "") return anio;
  const nMes = Number(mes);
  if (!/^\d{2}$/.test(mes) || nMes < 1 || nMes > 12) return null;
  if (dia === "") return `${anio}-${mes}`;
  const nDia = Number(dia);
  if (!/^\d{2}$/.test(dia) || nDia < 1 || nDia > diasDelMes(Number(anio), nMes)) return null;
  return `${anio}-${mes}-${dia}`;
}

export function esFechaParcialValida(v: string): boolean {
  if (!PATRON.test(v)) return false;
  return componerFechaParcial(parseFechaParcial(v)) === v;
}

/** "2019" / "03/2019" / "15/03/2019". `fallback` si está vacía; tal cual si no se reconoce. */
export function formatFechaParcial(v: string | null | undefined, fallback = "—"): string {
  const s = (v ?? "").trim();
  if (s === "") return fallback;
  if (!PATRON.test(s)) return s;
  const { anio, mes, dia } = parseFechaParcial(s);
  return [dia, mes, anio].filter(Boolean).join("/");
}
