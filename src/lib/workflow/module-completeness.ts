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

// ─── Convencional — completitud por grupo usando tablas conv_* ───

async function getConvGrupoAPercentage(visitaId: string): Promise<number> {
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

// ─── Grupo B: RaySafe (pruebas 2.4–2.8, 2.21) ───

async function getConvGrupoBPercentage(visitaId: string): Promise<number> {
  const [setup, mediciones] = await Promise.all([
    db.conv_raysafe_setup.where("visita_id").equals(visitaId).first(),
    db.conv_raysafe_mediciones.where("visita_id").equals(visitaId).toArray(),
  ]);

  const setupPct = pct([setup?.distancia_foco_sensor_d1_cm, setup?.distancia_foco_detector_d2_cm]);

  const porTipo = (tipo: string) => mediciones.filter((m) => m.tipo_medicion === tipo);
  const filledPct = (rows: typeof mediciones, camposClave: (keyof (typeof mediciones)[0])[]) => {
    if (rows.length === 0) return 0;
    const filled = rows.filter((r) => camposClave.every((c) => notEmpty(r[c]))).length;
    return Math.round((filled / rows.length) * 100);
  };

  const principalesPct = filledPct(porTipo("principal"), [
    "kv_medido",
    "tiempo_medido_s",
    "dosis_medida_mgy",
  ]);
  const conRejillaPct = filledPct(porTipo("con_rejilla"), ["kv_medido", "dosis_medida_mgy"]);
  const sinRejillaPct = filledPct(porTipo("sin_rejilla"), ["kv_medido", "dosis_medida_mgy"]);
  const kermaPct = filledPct(porTipo("kerma"), ["dosis_medida_mgy", "dap_nominal"]);

  // Pesos: setup 5%, principales 45%, con rejilla 15%, sin rejilla 15%, kerma 20%
  return Math.round(
    setupPct * 0.05 +
      principalesPct * 0.45 +
      conRejillaPct * 0.15 +
      sinRejillaPct * 0.15 +
      kermaPct * 0.2
  );
}

// ─── Grupo C: CAE (pruebas 2.17–2.20) ───

async function getConvGrupoCPercentage(visitaId: string): Promise<number> {
  const [setup, mediciones] = await Promise.all([
    db.conv_cae_setup.where("visita_id").equals(visitaId).first(),
    db.conv_cae_mediciones.where("visita_id").equals(visitaId).toArray(),
  ]);

  const setupPct = pct([
    setup?.mas_base_217,
    setup?.mas_base_60kv,
    setup?.mas_base_70kv,
    setup?.mas_base_81kv,
    setup?.mas_base_cu1,
    setup?.mas_base_cu2,
    setup?.mas_base_cu3,
  ]);

  const medFilled = mediciones.filter((m) => notEmpty(m.carga_mas) && notEmpty(m.ei)).length;
  const medPct = mediciones.length ? Math.round((medFilled / mediciones.length) * 100) : 0;

  // Pesos: base de referencia 15%, disparos 85%
  return Math.round(setupPct * 0.15 + medPct * 0.85);
}

// ─── Grupo D: DDI/EI, cassettes, uniformidad CR (pruebas 2.9, 2.10, 2.14, 2.15) ───

async function getConvGrupoDPercentage(visitaId: string): Promise<number> {
  const [ddi, cassettes, uniformidad] = await Promise.all([
    db.conv_ddi_mediciones.where("visita_id").equals(visitaId).toArray(),
    db.conv_cassette_inspeccion.where("visita_id").equals(visitaId).toArray(),
    db.conv_uniformidad_cr.where("visita_id").equals(visitaId).toArray(),
  ]);

  const ddiFilled = ddi.filter((m) => notEmpty(m.ei)).length;
  const ddiPct = ddi.length ? Math.round((ddiFilled / ddi.length) * 100) : 0;

  const cassetteFilled = cassettes.filter((c) => notEmpty(c.concepto)).length;
  const cassettePct =
    cassettes.length > 0 ? Math.round((cassetteFilled / cassettes.length) * 100) : 0;

  const uniformidadFilled = uniformidad.filter((u) => notEmpty(u.ei)).length;
  const uniformidadPct =
    uniformidad.length > 0 ? Math.round((uniformidadFilled / uniformidad.length) * 100) : 0;

  // Pesos: DDI/EI 50%, cassettes 30%, uniformidad CR 20%
  return Math.round(ddiPct * 0.5 + cassettePct * 0.3 + uniformidadPct * 0.2);
}

// ─── Grupo E: colimación, resolución, bajo contraste, MTF (pruebas 2.3, 2.11–2.13, 2.16) ───

async function getConvGrupoEPercentage(visitaId: string): Promise<number> {
  const [colimacion, resolucion, bajoContraste, mtf, uniformidadDetector] = await Promise.all([
    db.conv_colimacion.where("visita_id").equals(visitaId).first(),
    db.conv_resolucion.where("visita_id").equals(visitaId).first(),
    db.conv_bajo_contraste.where("visita_id").equals(visitaId).first(),
    db.conv_mtf.where("visita_id").equals(visitaId).first(),
    db.conv_uniformidad_detector.where("visita_id").equals(visitaId).toArray(),
  ]);

  const colimacionPct = pct([
    colimacion?.anodo_medido,
    colimacion?.catodo_medido,
    colimacion?.izquierda_medido,
    colimacion?.derecha_medido,
    colimacion?.posicion_esfera,
  ]);

  const resolucionPct = pct([resolucion?.pares_lineas_plmm]);

  const bajoContrastePct = pct([
    bajoContraste?.contraste_9_4,
    bajoContraste?.contraste_8_0,
    bajoContraste?.contraste_5_6,
    bajoContraste?.contraste_4_0,
    bajoContraste?.contraste_2_8,
    bajoContraste?.contraste_1_8,
    bajoContraste?.contraste_1_3,
    bajoContraste?.contraste_0_9,
  ]);

  const mtfPct = pct([mtf?.mtf50_horizontal, mtf?.mtf50_vertical]);

  const detectorFilled = uniformidadDetector.filter(
    (d) => notEmpty(d.roi_0_vmp_ac) || notEmpty(d.roi_0_vmp_ca)
  ).length;
  const detectorPct =
    uniformidadDetector.length > 0
      ? Math.round((detectorFilled / uniformidadDetector.length) * 100)
      : 0;

  // Pesos: colimación 25%, uniformidad detector 25%, resolución 15%, bajo contraste 20%, MTF 15%
  return Math.round(
    colimacionPct * 0.25 +
      detectorPct * 0.25 +
      resolucionPct * 0.15 +
      bajoContrastePct * 0.2 +
      mtfPct * 0.15
  );
}

// ─── Main: getModuleStatuses ───

export async function getModuleStatuses(visitaId: string): Promise<Record<string, ModuleProgress>> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return {};

  const [infoPct, grupoAPct, grupoBPct, grupoCPct, grupoDPct, grupoEPct] = await Promise.all([
    getInfoPercentage(visita),
    getConvGrupoAPercentage(visitaId),
    getConvGrupoBPercentage(visitaId),
    getConvGrupoCPercentage(visitaId),
    getConvGrupoDPercentage(visitaId),
    getConvGrupoEPercentage(visitaId),
  ]);

  return {
    info: toProgress(infoPct),
    "grupo-a": toProgress(grupoAPct),
    "grupo-b": toProgress(grupoBPct),
    "grupo-c": toProgress(grupoCPct),
    "grupo-d": toProgress(grupoDPct),
    "grupo-e": toProgress(grupoEPct),
    "pre-informe": toProgress(0),
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
