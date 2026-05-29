// ============================================================
//  Registro de paquetes de pruebas por tipo de equipo
// ============================================================

import type { TipoEquipo } from "@/lib/db/types";
import type { PaquetePruebas } from "./types";
import { CONVENCIONAL_PACKAGE } from "./convencional";

/** Paquetes disponibles — agregar nuevos tipos aquí */
const PACKAGES: Partial<Record<TipoEquipo, PaquetePruebas>> = {
  CONVENCIONAL: CONVENCIONAL_PACKAGE,
};

/**
 * Obtiene el paquete de pruebas para un tipo de equipo.
 * Retorna undefined si no hay paquete definido (usa pruebas genéricas).
 */
export function getPackage(tipoEquipo: TipoEquipo): PaquetePruebas | undefined {
  return PACKAGES[tipoEquipo];
}

/**
 * Verifica si un tipo de equipo tiene paquete de pruebas definido.
 */
export function hasPackage(tipoEquipo: TipoEquipo): boolean {
  return tipoEquipo in PACKAGES;
}

/**
 * Lista todos los tipos de equipo con paquete definido.
 */
export function getPackagedEquipmentTypes(): TipoEquipo[] {
  return Object.keys(PACKAGES) as TipoEquipo[];
}

export type { PaquetePruebas } from "./types";
