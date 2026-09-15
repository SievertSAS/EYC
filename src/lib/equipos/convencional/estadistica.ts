// ============================================================
//  Estadística compartida — fuente única de verdad
//
//  promedio/desviacion/cvPct se reimplementaban de forma independiente en
//  evaluacion.ts, secciones-convencional.ts (4 lugares) y
//  generar-pre-informe.ts. Todas usaban la misma fórmula (n-1), pero al no
//  compartir una sola fuente, un ajuste futuro a una no se propaga a las
//  demás (#121).
// ============================================================

export function promedio(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function desviacion(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = promedio(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/** Coeficiente de variación en % */
export function cvPct(arr: number[]): number {
  const m = promedio(arr);
  return m > 0 ? (desviacion(arr) / m) * 100 : 0;
}
