// ============================================================
//  Registro central de paquetes por tipo de equipo
//  Punto de entrada único para obtener el paquete de cualquier equipo
// ============================================================

import type { TipoEquipo } from "@/lib/db/types";
import type { EquipmentPackage, ModuloVisita } from "./types";
import { CONVENCIONAL_PACKAGE } from "./convencional";

/** Paquetes disponibles — agregar nuevos tipos aquí */
const PACKAGES: Partial<Record<TipoEquipo, EquipmentPackage>> = {
  CONVENCIONAL: CONVENCIONAL_PACKAGE,
  // Futuros:
  // CT: CT_PACKAGE,
  // MAMOGRAFO: MAMOGRAFO_PACKAGE,
  // PANORAMICO: PANORAMICO_PACKAGE,
};

/**
 * Módulos por defecto para equipos sin paquete definido.
 * Permite que la app no rompa mientras se migran todos los tipos.
 */
const MODULOS_DEFAULT: ModuloVisita[] = [
  {
    id: "condiciones",
    nombre: "Condiciones Ambientales",
    nombreCorto: "Condiciones",
    icon: "Thermometer",
    orden: 1,
    requerido: true,
  },
  {
    id: "levantamiento",
    nombre: "Levantamiento Radiométrico",
    nombreCorto: "Levantamiento",
    icon: "Gauge",
    orden: 2,
    requerido: true,
  },
  {
    id: "inspeccion",
    nombre: "Inspección Visual",
    nombreCorto: "Inspección",
    icon: "Eye",
    orden: 3,
    requerido: false,
  },
  {
    id: "pruebas",
    nombre: "Pruebas de Control de Calidad",
    nombreCorto: "Pruebas",
    icon: "FlaskConical",
    orden: 4,
    requerido: true,
  },
  {
    id: "evidencias",
    nombre: "Evidencias Fotográficas",
    nombreCorto: "Evidencias",
    icon: "Camera",
    orden: 5,
    requerido: false,
  },
  {
    id: "pre-informe",
    nombre: "Pre-Informe PDF",
    nombreCorto: "Pre-Informe",
    icon: "FileText",
    orden: 6,
    requerido: false,
    ruta: "pre-informe",
  },
];

/**
 * Obtiene el paquete completo para un tipo de equipo.
 * Retorna undefined si no hay paquete definido.
 */
export function getPackage(tipoEquipo: TipoEquipo): EquipmentPackage | undefined {
  return PACKAGES[tipoEquipo];
}

/**
 * Verifica si un tipo de equipo tiene paquete completo definido.
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

/**
 * Obtiene los módulos de un tipo de equipo.
 * Si no tiene paquete, retorna los módulos por defecto.
 */
export function getModules(tipoEquipo: TipoEquipo): ModuloVisita[] {
  return PACKAGES[tipoEquipo]?.modulos ?? MODULOS_DEFAULT;
}

/**
 * Obtiene los módulos por defecto (para visitas sin equipo asignado).
 */
export function getDefaultModules(): ModuloVisita[] {
  return MODULOS_DEFAULT;
}

/**
 * Obtiene los IDs de módulos requeridos para un tipo de equipo.
 */
export function getRequiredModules(tipoEquipo: TipoEquipo): string[] {
  const modulos = getModules(tipoEquipo);
  return modulos.filter((m) => m.requerido).map((m) => m.id);
}
