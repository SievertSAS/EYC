import { db } from "@/lib/db";
import { getPackage, getDefaultModules } from "@/lib/equipos/registry";
import type { ModuloVisita } from "@/lib/equipos/types";
import { getEstadoPruebasPorGrupo } from "@/lib/equipos/convencional/evaluacion";

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

async function getModulosForVisita(visitaId: string): Promise<ModuloVisita[]> {
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
  equipo_id?: string | null;
  ubicacion_id?: string | null;
  solicitud_id: string;
  fecha_visita?: string | null;
}): Promise<number> {
  const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
  const ubicacion = visita.ubicacion_id
    ? await db.ubicaciones_rx.get(visita.ubicacion_id)
    : undefined;
  const solicitud = await db.solicitudes.get(visita.solicitud_id);
  const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
  const tubo = equipo?.id ? await db.tubos.where("equipo_id").equals(equipo.id).first() : undefined;

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

// ─── Convencional — completitud por grupo basada en pruebas resueltas ───
//
//  Un módulo grupo-x llega a 100% cuando ninguna de sus pruebas queda
//  "pendiente" (según el mismo criterio que usa el editor del pre-informe:
//  evaluarConceptoPrueba + toggle "incluida" de conv_informe_secciones).
//  Esto evita que el % se quede atascado por debajo de 100 cuando una
//  prueba legítimamente no aplica al equipo evaluado.

function pctResueltas(g: { total: number; pendientes: number } | undefined): number {
  // Fail-safe (#6): un grupo sin pruebas cuenta como "sin iniciar", no
  // "completo". Hoy es defensivo (para CONVENCIONAL cada grupo tiene 2-6
  // secciones fijas del catálogo), pero evita que un paquete futuro con un
  // grupo vacío pase el gate por default.
  if (!g || g.total === 0) return 0;
  return Math.round(((g.total - g.pendientes) / g.total) * 100);
}

// ─── Main: getModuleStatuses ───

export async function getModuleStatuses(visitaId: string): Promise<Record<string, ModuleProgress>> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return {};

  const [infoPct, estadoPorGrupo] = await Promise.all([
    getInfoPercentage(visita),
    getEstadoPruebasPorGrupo(visitaId),
  ]);

  const totalGeneral = Object.values(estadoPorGrupo).reduce((acc, g) => acc + g.total, 0);
  const pendientesGeneral = Object.values(estadoPorGrupo).reduce((acc, g) => acc + g.pendientes, 0);
  const preInformePct =
    totalGeneral === 0
      ? 0 // fail-safe (#6): sin pruebas → sin iniciar, no completo
      : Math.round(((totalGeneral - pendientesGeneral) / totalGeneral) * 100);

  return {
    info: toProgress(infoPct),
    "grupo-a": toProgress(pctResueltas(estadoPorGrupo["A"])),
    "grupo-b": toProgress(pctResueltas(estadoPorGrupo["B"])),
    "grupo-c": toProgress(pctResueltas(estadoPorGrupo["C"])),
    "grupo-d": toProgress(pctResueltas(estadoPorGrupo["D"])),
    "grupo-e": toProgress(pctResueltas(estadoPorGrupo["E"])),
    "pre-informe": toProgress(preInformePct),
  };
}

// ─── Visit completeness ───

export async function getVisitCompleteness(visitaId: string): Promise<VisitCompleteness> {
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
  visitaIds: string[]
): Promise<Map<string, VisitCompleteness>> {
  if (visitaIds.length === 0) return new Map();

  const result = new Map<string, VisitCompleteness>();

  // Para el listado usamos una versión ligera — no computa cada grupo en detalle
  for (const vid of visitaIds) {
    const completeness = await getVisitCompleteness(vid);
    result.set(vid, completeness);
  }

  return result;
}
