import { db } from "@/lib/db";

// ============================================================
//  Motor de completitud de módulos de visita
//  Centraliza la lógica que antes estaba inline en
//  visitas/[id]/page.tsx para reusar en state machine y UI
// ============================================================

export type ModuloStatus = "sin_iniciar" | "en_progreso" | "completado";

export interface ModuloInfo {
  id: string;
  status: ModuloStatus;
  required: boolean;
  detail?: string;
}

export interface VisitCompleteness {
  total: number;
  completed: number;
  percentage: number;
  /** IDs de módulos requeridos que no están completados */
  blocking: string[];
  modules: ModuloInfo[];
}

/** Módulos que DEBEN completarse para avanzar a "completada" */
const REQUIRED_MODULES = ["condiciones", "levantamiento", "pruebas"];

/** Módulos opcionales — no bloquean transición */
const OPTIONAL_MODULES = ["inspeccion", "evidencias"];

/**
 * Calcula el estado de cada módulo para una visita.
 */
export async function getModuleStatuses(
  visitaId: number
): Promise<Record<string, ModuloStatus>> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return {};

  // Contar datos de cada módulo en paralelo
  const [
    pruebasTotal,
    pruebasCompletadas,
    gruposTotal,
    gruposCompletados,
    medicionesCount,
    evidenciasCount,
    partesCount,
    elementosCount,
  ] = await Promise.all([
    db.prueba_resultados.where("visita_id").equals(visitaId).count(),
    db.prueba_resultados
      .where("visita_id")
      .equals(visitaId)
      .filter((p) => p.completado)
      .count(),
    db.grupo_resultados.where("visita_id").equals(visitaId).count(),
    db.grupo_resultados
      .where("visita_id")
      .equals(visitaId)
      .filter((g) => g.completado)
      .count(),
    db.mediciones_radiometricas.where("visita_id").equals(visitaId).count(),
    db.evidencias.where("visita_id").equals(visitaId).count(),
    db.partes_equipo.where("equipo_id").equals(visita.equipo_id ?? 0).count(),
    db.elementos_proteccion.where("visita_id").equals(visitaId).count(),
  ]);

  return {
    info: "completado", // siempre completo (precargado)
    condiciones: getCondicionesStatus(visita),
    levantamiento: getLevantamientoStatus(medicionesCount),
    inspeccion: getInspeccionStatus(partesCount, elementosCount),
    pruebas: getPruebasStatus(pruebasTotal, pruebasCompletadas, gruposTotal, gruposCompletados),
    evidencias: getEvidenciasStatus(evidenciasCount),
    "pre-informe": "sin_iniciar" as ModuloStatus, // estado especial, no aplica completitud
  };
}

/**
 * Calcula el progreso general de la visita y lista los módulos bloqueantes.
 */
export async function getVisitCompleteness(
  visitaId: number
): Promise<VisitCompleteness> {
  const statuses = await getModuleStatuses(visitaId);

  const allModuleIds = [...REQUIRED_MODULES, ...OPTIONAL_MODULES];
  const modules: ModuloInfo[] = allModuleIds.map((id) => ({
    id,
    status: statuses[id] ?? "sin_iniciar",
    required: REQUIRED_MODULES.includes(id),
  }));

  const completed = modules.filter((m) => m.status === "completado").length;
  const total = modules.length;
  const blocking = modules
    .filter((m) => m.required && m.status !== "completado")
    .map((m) => m.id);

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    blocking,
    modules,
  };
}

// ─── Status helpers ───

function getCondicionesStatus(visita: {
  temperatura_c?: number | null;
  presion_hpa?: number | null;
}): ModuloStatus {
  const hasTemp = visita.temperatura_c != null;
  const hasPres = visita.presion_hpa != null;
  if (hasTemp && hasPres) return "completado";
  if (hasTemp || hasPres) return "en_progreso";
  return "sin_iniciar";
}

function getLevantamientoStatus(medicionesCount: number): ModuloStatus {
  // Con al menos 1 medición se considera completado
  // (el técnico decide cuántos puntos medir)
  if (medicionesCount > 0) return "completado";
  return "sin_iniciar";
}

function getInspeccionStatus(
  partesCount: number,
  elementosCount: number
): ModuloStatus {
  if (partesCount > 0 || elementosCount > 0) return "completado";
  return "sin_iniciar";
}

function getPruebasStatus(
  pruebasTotal: number,
  pruebasCompletadas: number,
  gruposTotal: number,
  gruposCompletados: number
): ModuloStatus {
  // Si hay grupos (paquete nuevo): los grupos Y las pruebas deben estar completos
  if (gruposTotal > 0) {
    if (gruposCompletados === gruposTotal && pruebasCompletadas === pruebasTotal) {
      return "completado";
    }
    if (gruposCompletados > 0 || pruebasCompletadas > 0) return "en_progreso";
    return "sin_iniciar";
  }
  // Ruta legacy: solo pruebas
  if (pruebasTotal === 0) return "sin_iniciar";
  if (pruebasCompletadas === pruebasTotal) return "completado";
  return "en_progreso";
}

function getEvidenciasStatus(count: number): ModuloStatus {
  if (count > 0) return "completado";
  return "sin_iniciar";
}
