/**
 * #113 — conversión de unidades para DAP y Kerma. Dos magnitudes con dos
 * fuentes distintas: `dap_nominal` viene del panel del equipo del cliente
 * (unidad configurable en `unidad_dap`), `dosis_medida_mgy`/`dap_medido`
 * vienen del instrumento RaySafe (unidad configurable en `unidad_kerma`).
 * Los nombres de campo en `ConvRaysafeMedicion` quedan sin cambios por
 * compatibilidad, aunque ahora puedan contener un valor en otra unidad —
 * la conversión se aplica solo al calcular/mostrar, nunca al guardar.
 */

export type UnidadDap = "mgy_cm2" | "ugy_cm2" | "dgy_cm2" | "gy_m2";
export type UnidadKerma = "ugy" | "mgy" | "cgy" | "dgy" | "gy";

/** Factor para convertir 1 unidad a mGy·cm² (unidad de referencia interna). */
const FACTOR_DAP: Record<UnidadDap, number> = {
  mgy_cm2: 1,
  ugy_cm2: 1 / 1000,
  dgy_cm2: 10,
  // 1 Gy·m² = 1000 mGy × 10 000 cm² = 10 000 000 mGy·cm²
  gy_m2: 1000 * 10_000,
};

/** Factor para convertir 1 unidad a mGy (unidad de referencia interna). */
const FACTOR_KERMA: Record<UnidadKerma, number> = {
  ugy: 1 / 1000,
  mgy: 1,
  cgy: 10,
  dgy: 100,
  gy: 1000,
};

export const LABEL_UNIDAD_DAP: Record<UnidadDap, string> = {
  mgy_cm2: "mGy·cm²",
  ugy_cm2: "µGy·cm²",
  dgy_cm2: "dGy·cm²",
  gy_m2: "Gy·m²",
};

export const LABEL_UNIDAD_KERMA: Record<UnidadKerma, string> = {
  ugy: "µGy",
  mgy: "mGy",
  cgy: "cGy",
  dgy: "dGy",
  gy: "Gy",
};

/** Normaliza un valor de DAP a mGy·cm² (unidad de referencia interna). */
export function convertirDap(valor: number, desde: UnidadDap | undefined): number {
  return valor * FACTOR_DAP[desde ?? "mgy_cm2"];
}

/** Normaliza un valor de Kerma a mGy (unidad de referencia interna). */
export function convertirKerma(valor: number, desde: UnidadKerma | undefined): number {
  return valor * FACTOR_KERMA[desde ?? "mgy"];
}
