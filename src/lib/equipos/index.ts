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
} from "./registry";

// Tipos
export type { EquipmentPackage, ModuloVisita } from "./types";
export type { GrupoPruebaDefinition, PruebaEnGrupo } from "./grupo-types";

// Motor de fórmulas
export {
  evaluateFormula,
  evaluateAllFormulas,
  evaluateFormulaSummaries,
  evaluateCriterios,
  evaluateCriterio,
  suggestConcepto,
  evaluateGroup,
  stats,
} from "./engine";
export type { FormulaContext, ResultadoPruebaCalculado } from "./engine";
