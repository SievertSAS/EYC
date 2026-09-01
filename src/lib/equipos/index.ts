// ============================================================
//  Punto de entrada del sistema de paquetes por equipo
//  Re-exporta todo lo necesario desde un solo import
// ============================================================

// Registro central
export {
  getPackage,
  hasPackage,
  getPackagedEquipmentTypes,
  getModules,
  getDefaultModules,
  getRequiredModules,
  canCreateVisitFor,
  assertCanCreateVisitFor,
  NoPackageError,
} from "./registry";

// Tipos
export type { EquipmentPackage, ModuloVisita } from "./types";
export type { GrupoPruebaDefinition, PruebaEnGrupo } from "./grupo-types";

// El motor genérico de fórmulas (`engine.ts`) se retiró — #45 opción B.
// El veredicto Conforme / No conforme lo produce `convencional/evaluacion.ts`
// (evaluadores a mano). Ninguna fórmula real se llegó a definir en `grupos.ts`.
