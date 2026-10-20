// ============================================================
//  Fechas del informe — emisión y vencimiento
//
//  La fecha del informe es SIEMPRE la fecha de la visita, y el vencimiento
//  es esa fecha + 2 años (Res. 1811). Todo se maneja como texto ISO de solo
//  día (`aaaa-mm-dd`) sin pasar por `Date` en UTC, para no correr el día por
//  la zona horaria (en Colombia, UTC-5, `toISOString()` después de las 19:00
//  ya devuelve el día siguiente, y `new Date("aaaa-mm-dd")` es medianoche
//  UTC, o sea el día anterior en hora local).
// ============================================================

const VIGENCIA_ANIOS = 2;

const ISO_DIA = /^(\d{4})-(\d{2})-(\d{2})/;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

// "en-CA" formatea como aaaa-mm-dd. La zona es fija para que el cliente y el
// servidor (p. ej. /verificar, que corre en UTC) coincidan en qué día es hoy.
const FORMATO_DIA_COLOMBIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario en Colombia (no UTC) en `aaaa-mm-dd`. */
export function fechaIsoColombia(d: Date = new Date()): string {
  return FORMATO_DIA_COLOMBIA.format(d);
}

/** Suma años a una fecha `aaaa-mm-dd`. El 29 de febrero cae en el 28 si el año destino no es bisiesto. */
export function sumarAnios(fechaIso: string, anios: number): string {
  const m = fechaIso.match(ISO_DIA);
  if (!m) throw new Error(`Fecha inválida: ${fechaIso}`);
  const anio = Number(m[1]) + anios;
  const mes = Number(m[2]);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(Number(m[3]), ultimoDia);
  return `${anio}-${pad2(mes)}-${pad2(dia)}`;
}

/**
 * Emisión = fecha de la visita (solo el día); vencimiento = emisión + 2 años.
 * Si la visita no tiene fecha, se usa el día de `hoy` en Colombia.
 */
export function fechasDelInforme(
  fechaVisita: string | null | undefined,
  hoy: Date = new Date()
): { fechaEmision: string; fechaVencimiento: string } {
  const m = (fechaVisita ?? "").trim().match(ISO_DIA);
  const fechaEmision = m ? `${m[1]}-${m[2]}-${m[3]}` : fechaIsoColombia(hoy);
  return { fechaEmision, fechaVencimiento: sumarAnios(fechaEmision, VIGENCIA_ANIOS) };
}

/** "20 de octubre de 2026". "No reporta" si viene vacía; tal cual si no es `aaaa-mm-dd`. */
export function textoFechaLarga(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (s === "") return "No reporta";
  const m = s.match(ISO_DIA);
  if (!m) return s;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}
