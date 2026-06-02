import { getVisitCompleteness } from "./module-completeness";

// ============================================================
//  Validación de módulos para gates de transición
// ============================================================

export interface ValidationError {
  moduleId: string;
  message: string;
  /** Ruta relativa al módulo para navegación directa */
  route: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

const MODULE_ROUTES: Record<string, string> = {
  condiciones: "condiciones",
  levantamiento: "levantamiento",
  pruebas: "pruebas",
  inspeccion: "inspeccion",
  evidencias: "evidencias",
};

const MODULE_LABELS: Record<string, string> = {
  condiciones: "Condiciones Ambientales",
  levantamiento: "Levantamiento Radiométrico",
  pruebas: "Pruebas de Control de Calidad",
  inspeccion: "Inspección Visual",
  evidencias: "Evidencias Fotográficas",
};

const MODULE_ERRORS: Record<string, string> = {
  condiciones: "Registre la temperatura y presión atmosférica",
  levantamiento: "Agregue al menos un punto de medición radiométrica",
  pruebas: "Complete y asigne concepto a todas las pruebas",
  inspeccion: "Evalúe al menos un componente del equipo",
  evidencias: "Capture al menos una evidencia fotográfica",
};

/**
 * Valida si la visita cumple los requisitos para completarse.
 * Retorna errores descriptivos con rutas de navegación.
 */
export async function validateForCompletion(visitaId: number): Promise<ValidationResult> {
  const completeness = await getVisitCompleteness(visitaId);

  const errors: ValidationError[] = completeness.blocking.map((moduleId) => ({
    moduleId,
    message: MODULE_ERRORS[moduleId] ?? `Módulo "${moduleId}" incompleto`,
    route: MODULE_ROUTES[moduleId] ?? moduleId,
  }));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Devuelve la etiqueta legible de un módulo.
 */
export function getModuleLabel(moduleId: string): string {
  return MODULE_LABELS[moduleId] ?? moduleId;
}
