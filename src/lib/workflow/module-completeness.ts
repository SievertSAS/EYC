import { db } from "@/lib/db";
import { getPackage, getDefaultModules } from "@/lib/equipos/registry";
import type { ModuloVisita } from "@/lib/equipos/types";

// ============================================================
//  Motor de completitud de módulos de visita
//  Consulta las tablas dedicadas de cada equipo (conv_*, etc.)
// ============================================================

export type ModuloStatus = "sin_iniciar" | "en_progreso" | "completado";

export interface ModuleProgress {
  status: ModuloStatus;
  percentage: number;
}

export interface ModuloInfo {
  id: string;
  status: ModuloStatus;
  percentage: number;
  required: boolean;
}

export interface VisitCompleteness {
  total: number;
  completed: number;
  percentage: number;
  blocking: string[];
  modules: ModuloInfo[];
}

// ─── Helpers ───

function notEmpty(v: unknown): boolean {
  return v != null && v !== "" && !(typeof v === "number" && isNaN(v));
}

function pct(values: unknown[]): number {
  if (values.length === 0) return 100;
  const filled = values.filter(notEmpty).length;
  return Math.round((filled / values.length) * 100);
}

function toProgress(p: number): ModuleProgress {
  return {
    status: p === 0 ? "sin_iniciar" : p === 100 ? "completado" : "en_progreso",
    percentage: p,
  };
}

async function getModulosForVisita(visitaId: number): Promise<ModuloVisita[]> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return [];

  if (visita.equipo_id) {
    const equipo = await db.equipos.get(visita.equipo_id);
    if (equipo?.tipo_equipo) {
      const pkg = getPackage(equipo.tipo_equipo);
      if (pkg) return pkg.modulos.filter((m) => m.id !== "pre-informe" && m.id !== "info");
    }
  }

  return getDefaultModules().filter((m) => m.id !== "pre-informe" && m.id !== "info");
}

// ─── Info (precarga) — núcleo, compartido por todos los equipos ───

async function getInfoPercentage(visita: {
  equipo_id?: number | null;
  ubicacion_id?: number | null;
  solicitud_id: number;
  fecha_visita?: string | null;
}): Promise<number> {
  const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
  const ubicacion = visita.ubicacion_id
    ? await db.ubicaciones_rx.get(visita.ubicacion_id)
    : undefined;
  const solicitud = await db.solicitudes.get(visita.solicitud_id);
  const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
  const tubo = equipo?.id
    ? await db.tubos.where("equipo_id").equals(equipo.id).first()
    : undefined;

  return pct([
    visita.fecha_visita,
    cliente?.nombre_cliente,
    cliente?.nit,
    cliente?.telefono,
    cliente?.naturaleza,
    cliente?.nombre_representante_legal,
    ubicacion?.nombre_servicio,
    ubicacion?.licencia,
    ubicacion?.codigo_habilitacion,
    equipo?.gen_marca,
    equipo?.gen_numero_serie,
    equipo?.gen_modelo,
    equipo?.gen_fase,
    equipo?.sistema_adquisicion,
    equipo?.distancia_foco_paciente,
    equipo?.filtracion_inherente_mmal,
    equipo?.filtracion_anadida_mmal,
    tubo?.marca,
    tubo?.kv_max,
    tubo?.ma_max,
  ]);
}

// ─── Convencional — completitud por grupo usando tablas conv_* ───

async function getConvGrupoAPercentage(visitaId: number): Promise<number> {
  const [setup, mediciones, inspeccion, elementos] = await Promise.all([
    db.conv_levantamiento_setup.where("visita_id").equals(visitaId).first(),
    db.conv_mediciones.where("visita_id").equals(visitaId).count(),
    db.conv_inspeccion_items.where("visita_id").equals(visitaId).toArray(),
    db.conv_elementos_proteccion.where("visita_id").equals(visitaId).count(),
  ]);

  const setupFields = pct([
    setup?.fondo_natural_usv_h,
    setup?.distancia_tubo_operario_m,
    setup?.tecnica_kv,
    setup?.tecnica_ma,
  ]);

  const medPct = mediciones > 0 ? 100 : 0;

  const inspeccionFilled = inspeccion.filter((i) => notEmpty(i.concepto)).length;
  const inspeccionTotal = inspeccion.length || 1;
  const inspeccionPct = Math.round((inspeccionFilled / inspeccionTotal) * 100);

  const elemPct = elementos > 0 ? 100 : 0;

  // Pesos: setup 20%, mediciones 30%, inspección 40%, elementos 10%
  return Math.round(setupFields * 0.2 + medPct * 0.3 + inspeccionPct * 0.4 + elemPct * 0.1);
}

// ─── Main: getModuleStatuses ───

export async function getModuleStatuses(
  visitaId: number,
): Promise<Record<string, ModuleProgress>> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return {};

  const infoPct = await getInfoPercentage(visita);
  const grupoAPct = await getConvGrupoAPercentage(visitaId);

  // Los demás grupos se implementan conforme se construyen
  return {
    info: toProgress(infoPct),
    "grupo-a": toProgress(grupoAPct),
    "grupo-b": toProgress(0),
    "grupo-c": toProgress(0),
    "grupo-d": toProgress(0),
    "grupo-e": toProgress(0),
    "pre-informe": toProgress(0),
  };
}

// ─── Visit completeness ───

export async function getVisitCompleteness(visitaId: number): Promise<VisitCompleteness> {
  const progressMap = await getModuleStatuses(visitaId);
  const modulos = await getModulosForVisita(visitaId);

  const modules: ModuloInfo[] = modulos.map((m) => {
    const p = progressMap[m.id] ?? { status: "sin_iniciar" as ModuloStatus, percentage: 0 };
    return { id: m.id, status: p.status, percentage: p.percentage, required: m.requerido };
  });

  const completed = modules.filter((m) => m.status === "completado").length;
  const total = modules.length;
  const blocking = modules.filter((m) => m.required && m.status !== "completado").map((m) => m.id);

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    blocking,
    modules,
  };
}

// ─── Bulk (simplificado para listado de visitas) ───

export async function getVisitCompletenessBulk(
  visitaIds: number[],
): Promise<Map<number, VisitCompleteness>> {
  if (visitaIds.length === 0) return new Map();

  const result = new Map<number, VisitCompleteness>();

  // Para el listado usamos una versión ligera — no computa cada grupo en detalle
  for (const vid of visitaIds) {
    const completeness = await getVisitCompleteness(vid);
    result.set(vid, completeness);
  }

  return result;
}
