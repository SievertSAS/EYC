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

/** Error de "este tipo de equipo todavía no se puede trabajar". */
export class NoPackageError extends Error {
  readonly tipoEquipo: TipoEquipo;
  constructor(tipoEquipo: TipoEquipo) {
    super(
      `No se puede crear una visita para "${tipoEquipo}": no hay paquete de pruebas definido. ` +
        `Solo CONVENCIONAL está habilitado. Ver hallazgo #7 en docs/modules/06-grupos-registry.md.`
    );
    this.name = "NoPackageError";
    this.tipoEquipo = tipoEquipo;
  }
}

/**
 * ¿Se puede crear una visita para este tipo de equipo HOY?
 *
 * Solo los tipos con paquete (`hasPackage`). Guard del hallazgo #7:
 * `module-completeness.getModuleStatuses` solo produce estados para los ids
 * del paquete CONVENCIONAL (`info`, `grupo-a`..`grupo-e`, `pre-informe`), NO
 * para los de `MODULOS_DEFAULT` (`condiciones`, `levantamiento`, …). Una
 * visita de un tipo sin paquete tendría todos sus módulos requeridos en
 * "sin_iniciar" para siempre → nunca podría pasar el gate de "enviar a
 * revisión".
 *
 * BACKLOG PRIORIZADO: antes de habilitar el segundo tipo de equipo hay que
 * unificar esos ids entre `getModuleStatuses` y `getDefaultModules`, y
 * recién ahí quitar este guard.
 */
export function canCreateVisitFor(tipoEquipo: TipoEquipo): boolean {
  return hasPackage(tipoEquipo);
}

/** Lanza `NoPackageError` si el tipo de equipo no se puede trabajar todavía. */
export function assertCanCreateVisitFor(tipoEquipo: TipoEquipo): void {
  if (!canCreateVisitFor(tipoEquipo)) {
    throw new NoPackageError(tipoEquipo);
  }
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
