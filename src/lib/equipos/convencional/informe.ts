// ============================================================
//  Generador de informe PDF para equipo CONVENCIONAL
//  Delega al generador existente por ahora — será refactorizado
//  en la Fase 5 cuando se separe base-informe.ts
// ============================================================

import { generarPreInforme as generarPreInformeLegacy } from "@/lib/pdf/generar-pre-informe";

/**
 * Genera el informe PDF específico para equipo convencional.
 * Actualmente es un wrapper del generador legacy.
 * En Fase 5 se reemplazará por el renderer específico.
 */
export async function generarInformeConvencional(visitaId: number): Promise<Blob | null> {
  return generarPreInformeLegacy(visitaId);
}
