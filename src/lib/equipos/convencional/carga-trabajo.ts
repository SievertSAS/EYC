/**
 * #105 — selección manual de la carga de trabajo usada en el cálculo de
 * dosis anual (Grupo A). Sin modo fijado, se mantiene el criterio
 * conservador histórico: el mayor entre la estimada y la estándar.
 */
export function calcularWUsado(
  wEstimada: number,
  wEstandar: number,
  modo: "estimada" | "tipica" | undefined
): number {
  if (modo === "estimada") return wEstimada;
  if (modo === "tipica") return wEstandar;
  return Math.max(wEstimada, wEstandar);
}
