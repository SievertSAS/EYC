import { db } from "@/lib/db";
import type {
  ConvMedicionRadiometrica,
  ConvInspeccionItem,
  ConvElementoProteccion,
  ConvColimacion,
  ConvRaysafeSetup,
  ConvRaysafeMedicion,
  ConvDdiMedicion,
  ConvUniformidadDetector,
  ConvResolucion,
  ConvBajoContraste,
  ConvCassetteInspeccion,
  ConvUniformidadCr,
  ConvMtf,
  ConvCaeSetup,
  ConvCaeMedicion,
} from "@/lib/equipos/convencional/db/types";

// ============================================================
//  Evaluación automática de conformidad — informe convencional
//
//  Fuente única de verdad para el concepto (Conforme / No conforme)
//  de las 21 pruebas 2.1–2.21. La consumen el editor del pre-informe
//  y el generador de PDF, para que nunca diverjan.
//
//  Cada evaluador es PURO y devuelve:
//    - "Conforme" / "No_conforme": veredicto según el criterio.
//    - undefined: pendiente (datos insuficientes para evaluar).
//  La prueba 2.8 (factor PKA) no tiene criterio → siempre undefined
//  (ver tieneCriterio()).
// ============================================================

export type Concepto = "Conforme" | "No_conforme";

/** CHR mínima (mm Al) por kV — tabla de referencia TECDOC (fuente única). */
export const CHR_MIN: Record<number, number> = { 60: 1.8, 70: 2.1, 80: 2.3, 90: 2.5 };

/** Subconjunto de tablas conv_* que necesitan los evaluadores (sin fotos). */
export interface DatosEvalConv {
  mediciones: ConvMedicionRadiometrica[];
  inspeccion: ConvInspeccionItem[];
  elementos: ConvElementoProteccion[];
  colimacion?: ConvColimacion;
  raysafeSetup?: ConvRaysafeSetup;
  raysafeMediciones: ConvRaysafeMedicion[];
  ddiMediciones: ConvDdiMedicion[];
  uniformidadDetector: ConvUniformidadDetector[];
  resolucion?: ConvResolucion;
  bajoContraste?: ConvBajoContraste;
  cassettes: ConvCassetteInspeccion[];
  uniformidadCr: ConvUniformidadCr[];
  mtf?: ConvMtf;
  caeSetup?: ConvCaeSetup;
  caeMediciones: ConvCaeMedicion[];
}

// ─── Helpers estadísticos (n-1, mismos que usa el PDF) ───

function promedio(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
function desviacion(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = promedio(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
/** Coeficiente de variación en % */
function cvPct(arr: number[]): number {
  const m = promedio(arr);
  return m > 0 ? (desviacion(arr) / m) * 100 : 0;
}

// ─── Evaluadores por prueba ───

/** 2.1 — Levantamiento radiométrico (rollup del concepto por punto). */
function evaluar21(d: DatosEvalConv): Concepto | undefined {
  if (d.mediciones.length === 0) return undefined;
  return d.mediciones.some((m) => m.concepto === "No_conforme") ? "No_conforme" : "Conforme";
}

/** 2.2 — Inspección visual + elementos de protección (rollup). */
function evaluar22(d: DatosEvalConv): Concepto | undefined {
  const iniciada = d.inspeccion.some((i) => i.concepto) || d.elementos.length > 0;
  if (!iniciada) return undefined;
  const noConforme =
    d.inspeccion.some((i) => i.concepto === "No_conforme") ||
    d.elementos.some((e) => e.concepto === "No_conforme");
  return noConforme ? "No_conforme" : "Conforme";
}

/** 2.3 — Colimación (≤2%/borde, ≤4% total) + perpendicularidad. */
function evaluar23(d: DatosEvalConv): Concepto | undefined {
  const col = d.colimacion;
  if (!col) return undefined;
  const sid = col.sid_cm || 100;
  const pares: [number | undefined, number | undefined][] = [
    [col.anodo_nominal, col.anodo_medido],
    [col.catodo_nominal, col.catodo_medido],
    [col.izquierda_nominal, col.izquierda_medido],
    [col.derecha_nominal, col.derecha_medido],
  ];
  const hayMedidos = pares.some(([, med]) => med != null);
  if (!hayMedidos && !col.posicion_esfera) return undefined;
  const varPcts = pares.map(([nom, med]) => (Math.abs((med ?? 0) - (nom ?? 0)) * 100) / sid);
  const totalVar = varPcts.reduce((s, v) => s + v, 0);
  const colimConf = varPcts.every((v) => v < 2) && totalVar < 4;
  const esfera = col.posicion_esfera;
  const perpConf =
    esfera === "Centro" || esfera === "Primer circulo" || esfera === "Segundo circulo";
  return colimConf && perpConf ? "Conforme" : "No_conforme";
}

/** Agrupa disparos principales por un valor nominal y evalúa desv/CV por grupo. */
function evaluarPorGrupoNominal(
  d: DatosEvalConv,
  gruposValidos: Set<number> | null,
  nominalDe: (m: ConvRaysafeMedicion) => number | undefined,
  medidoDe: (m: ConvRaysafeMedicion) => number | undefined,
  maxDesv: number,
  maxCv: number
): Concepto | undefined {
  const principales = d.raysafeMediciones.filter(
    (m) =>
      m.tipo_medicion === "principal" &&
      (gruposValidos == null || gruposValidos.has(m.grupo_numero ?? -1))
  );
  const grupos = new Map<number, ConvRaysafeMedicion[]>();
  for (const m of principales) {
    const nom = nominalDe(m);
    if (nom == null || medidoDe(m) == null) continue;
    if (!grupos.has(nom)) grupos.set(nom, []);
    grupos.get(nom)!.push(m);
  }
  if (grupos.size === 0) return undefined;
  const conformes = [...grupos.entries()].map(([nom, ms]) => {
    const medidos = ms.map((m) => medidoDe(m)!);
    const prom = promedio(medidos);
    const desv = nom > 0 ? (Math.abs(prom - nom) / nom) * 100 : 0;
    return desv <= maxDesv && cvPct(medidos) <= maxCv;
  });
  return conformes.some((ok) => !ok) ? "No_conforme" : "Conforme";
}

/** 2.4 — Exactitud/repetibilidad del tiempo (desv ≤10%, CV ≤10%). */
function evaluar24(d: DatosEvalConv): Concepto | undefined {
  return evaluarPorGrupoNominal(
    d,
    new Set([1, 2, 6]),
    (m) => m.tiempo_nominal_s,
    (m) => m.tiempo_medido_s,
    10,
    10
  );
}

/** 2.5 — Exactitud/repetibilidad del kV (desv ≤10%, CV ≤5%). */
function evaluar25(d: DatosEvalConv): Concepto | undefined {
  return evaluarPorGrupoNominal(
    d,
    new Set([1, 2, 6]),
    (m) => m.kv_nominal,
    (m) => m.kv_medido,
    10,
    5
  );
}

/** 2.6 — Capa hemirreductora (CHR promedio ≥ mínimo por kV). */
function evaluar26(d: DatosEvalConv): Concepto | undefined {
  const principales = d.raysafeMediciones.filter((m) => m.tipo_medicion === "principal");
  const grupos = new Map<number, number[]>();
  for (const m of principales) {
    if (m.kv_nominal == null || m.chr_medido_mmal == null) continue;
    if (!grupos.has(m.kv_nominal)) grupos.set(m.kv_nominal, []);
    grupos.get(m.kv_nominal)!.push(m.chr_medido_mmal);
  }
  if (grupos.size === 0) return undefined;
  const conformes = [...grupos.entries()].map(([kv, chrs]) => promedio(chrs) >= (CHR_MIN[kv] ?? 0));
  return conformes.some((ok) => !ok) ? "No_conforme" : "Conforme";
}

/** 2.7 — Rendimiento: repetibilidad (CV ≤5%) y linealidad (≤10%). */
function evaluar27(d: DatosEvalConv): Concepto | undefined {
  const shots80 = d.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && m.kv_nominal === 80 && m.dosis_medida_mgy != null
  );
  if (shots80.length === 0) return undefined;
  const repShots = shots80.filter((m) => m.grupo_numero === 3);
  const hayRep = repShots.length > 0;
  const cv = hayRep ? cvPct(repShots.map((m) => m.dosis_medida_mgy!)) : 0;

  const gruposMas = new Map<number, ConvRaysafeMedicion[]>();
  for (const m of shots80) {
    if (m.mas_nominal == null) continue;
    if (!gruposMas.has(m.mas_nominal)) gruposMas.set(m.mas_nominal, []);
    gruposMas.get(m.mas_nominal)!.push(m);
  }
  const entradasLin = [...gruposMas.entries()].sort(([a], [b]) => a - b);
  let linMax = 0;
  if (entradasLin.length > 1) {
    const [mas0, ms0] = entradasLin[0];
    const ref = (promedio(ms0.map((m) => m.dosis_medida_mgy!)) / mas0) * 1000;
    for (const [mas, ms] of entradasLin.slice(1)) {
      const r = (promedio(ms.map((m) => m.dosis_medida_mgy!)) / mas) * 1000;
      if (ref > 0) linMax = Math.max(linMax, Math.abs((r - ref) / ref) * 100);
    }
  }
  const conformeRep = !hayRep || cv <= 5;
  const conformeLin = entradasLin.length <= 1 || linMax <= 10;
  return !conformeRep || !conformeLin ? "No_conforme" : "Conforme";
}

/** 2.9 — DDI/EI: desviación vs base ≤ ±20%. */
function evaluar29(d: DatosEvalConv): Concepto | undefined {
  const toma1 = d.ddiMediciones.find((m) => m.grupo === 1 && m.toma_numero === 1);
  const ei = toma1?.ei ?? null;
  const eiBase = toma1?.ei_base ?? null;
  const di = toma1?.di ?? null;
  const diBase = toma1?.di_base ?? null;
  if (ei == null || eiBase == null) return undefined;
  const eiDev = eiBase > 0 ? Math.abs(ei - eiBase) / eiBase : Infinity;
  const diDev =
    di != null && diBase != null && diBase !== 0 ? Math.abs(di - diBase) / Math.abs(diBase) : null;
  const conforme = eiDev <= 0.2 && (diDev == null || diDev <= 0.2);
  return conforme ? "Conforme" : "No_conforme";
}

/** 2.10 — DDI/EI: CV ≤ 20%. */
function evaluar210(d: DatosEvalConv): Concepto | undefined {
  const grupo1 = d.ddiMediciones.filter((m) => m.grupo === 1);
  const eiVals = grupo1.map((m) => m.ei).filter((v): v is number => v != null);
  if (eiVals.length < 2) return undefined;
  const eiAvg = promedio(eiVals);
  const eiCv = eiAvg > 0 ? desviacion(eiVals) / eiAvg : Infinity;
  return eiCv <= 0.2 ? "Conforme" : "No_conforme";
}

/** 2.11 — Uniformidad y artefactos del detector. */
function evaluar211(d: DatosEvalConv): Concepto | undefined {
  const dets = d.uniformidadDetector ?? [];
  if (dets.length === 0) return undefined;
  const allConforme = dets.every((det) => {
    const tolPct = det.tolerancia_pct ?? 15;
    let maxG = 0;
    for (const orient of ["ac", "ca"] as const) {
      const center = det[`roi_0_vmp_${orient}` as keyof typeof det] as number | undefined;
      if (center == null) continue;
      for (let i = 1; i <= 4; i++) {
        const vmp = det[`roi_${i}_vmp_${orient}` as keyof typeof det] as number | undefined;
        if (vmp != null && center !== 0)
          maxG = Math.max(maxG, Math.abs((vmp - center) / center) * 100);
      }
    }
    const tieneVmp = det.roi_0_vmp_ac != null || det.roi_0_vmp_ca != null;
    return tieneVmp && maxG <= tolPct && !det.pixeles_defectuosos && !det.artefactos;
  });
  return allConforme ? "Conforme" : "No_conforme";
}

/** 2.12 — Resolución espacial ≥ 2.4 pl/mm. */
function evaluar212(d: DatosEvalConv): Concepto | undefined {
  const plmm = d.resolucion?.pares_lineas_plmm;
  if (plmm == null) return undefined;
  return plmm >= 2.4 ? "Conforme" : "No_conforme";
}

/** 2.13 — Umbral de bajo contraste (>3 masas visibles o alcanza umbral bajo). */
function evaluar213(d: DatosEvalConv): Concepto | undefined {
  const bc = d.bajoContraste;
  if (!bc) return undefined;
  const KEYS_BC = [
    "contraste_9_4",
    "contraste_8_0",
    "contraste_5_6",
    "contraste_4_0",
    "contraste_2_8",
    "contraste_1_8",
    "contraste_1_3",
    "contraste_0_9",
  ] as const;
  const visibles = KEYS_BC.filter((k) => bc[k]).length;
  const bajoUmb = bc.contraste_2_8 || bc.contraste_1_8 || bc.contraste_1_3 || bc.contraste_0_9;
  return visibles > 3 || !!bajoUmb ? "Conforme" : "No_conforme";
}

/** 2.14 — Inspección de cassettes/pantallas IP (rollup). */
function evaluar214(d: DatosEvalConv): Concepto | undefined {
  const cassettes = d.cassettes ?? [];
  const conConcepto = cassettes.filter((c) => c.concepto);
  if (conConcepto.length === 0) return undefined;
  return conConcepto.some((c) => c.concepto === "No_conforme") ? "No_conforme" : "Conforme";
}

/** 2.15 — Uniformidad de sensibilidad IP CR: CV(EI) ≤ 10%. */
function evaluar215(d: DatosEvalConv): Concepto | undefined {
  const eiVals = (d.uniformidadCr ?? []).map((u) => u.ei ?? 0).filter((v) => v > 0);
  if (eiVals.length < 2) return undefined;
  return cvPct(eiVals) <= 10 ? "Conforme" : "No_conforme";
}

/** 2.16 — MTF: variación ≤10% vs base (o establece base). */
function evaluar216(d: DatosEvalConv): Concepto | undefined {
  const m = d.mtf;
  if (!m || (m.mtf50_horizontal == null && m.mtf50_vertical == null)) return undefined;
  const tieneBase = m.mtf50_base_horizontal != null || m.mtf50_base_vertical != null;
  if (!tieneBase) return "Conforme"; // primera medición = línea base
  const desv50H =
    m.mtf50_horizontal != null && m.mtf50_base_horizontal != null && m.mtf50_base_horizontal !== 0
      ? Math.abs((m.mtf50_horizontal - m.mtf50_base_horizontal) / m.mtf50_base_horizontal) * 100
      : null;
  const desv50V =
    m.mtf50_vertical != null && m.mtf50_base_vertical != null && m.mtf50_base_vertical !== 0
      ? Math.abs((m.mtf50_vertical - m.mtf50_base_vertical) / m.mtf50_base_vertical) * 100
      : null;
  const vals = [desv50H, desv50V].filter((v): v is number => v != null);
  const maxDesv = vals.length > 0 ? Math.max(...vals) : null;
  const conforme = maxDesv != null ? maxDesv <= 10 : true;
  return conforme ? "Conforme" : "No_conforme";
}

/** Variación relativa |medido - base| / |base|. */
function varRel(medido: number | undefined, base: number | undefined): number | null {
  if (!medido || !base) return null;
  return Math.abs(medido - base) / Math.abs(base);
}

/** 2.17 — Sensibilidad CAE: variación ≤ 50% vs base. */
function evaluar217(d: DatosEvalConv): Concepto | undefined {
  const s = d.caeSetup;
  const t9 = d.caeMediciones.find((m) => m.toma_numero === 9);
  const hayBase = s?.mas_base_217 != null || s?.ei_base_217 != null;
  if (!t9 || !hayBase) return undefined;
  const vals = [
    varRel(t9.carga_mas, s?.mas_base_217),
    varRel(t9.ei, s?.ei_base_217),
    varRel(t9.di, s?.di_base_217),
  ].filter((v): v is number => v != null);
  const maxVar = vals.length > 0 ? Math.max(...vals) : null;
  return (maxVar != null ? maxVar <= 0.5 : true) ? "Conforme" : "No_conforme";
}

/** 2.18 — Consistencia de sensores CAE: rango ≤ 30%. */
function evaluar218(d: DatosEvalConv): Concepto | undefined {
  const tomas = d.caeMediciones.filter((m) => m.toma_numero >= 2 && m.toma_numero <= 8);
  if (tomas.length === 0) return undefined;
  const masVals = tomas.map((m) => m.carga_mas).filter((v): v is number => v != null && v > 0);
  const eiVals = tomas.map((m) => m.ei).filter((v): v is number => v != null && v > 0);
  const rangeVar = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const m = promedio(arr);
    return m ? (Math.max(...arr) - Math.min(...arr)) / m : null;
  };
  const vals = [rangeVar(masVals), rangeVar(eiVals)].filter((v): v is number => v != null);
  const maxVar = vals.length > 0 ? Math.max(...vals) : null;
  return (maxVar != null ? maxVar <= 0.3 : true) ? "Conforme" : "No_conforme";
}

/** 2.19 — Repetibilidad CAE: CV ≤ 10%. */
function evaluar219(d: DatosEvalConv): Concepto | undefined {
  const tomas = d.caeMediciones.filter(
    (m) => m.toma_numero === 3 || (m.toma_numero >= 9 && m.toma_numero <= 12)
  );
  if (tomas.length < 2) return undefined;
  const masVals = tomas.map((m) => m.carga_mas).filter((v): v is number => v != null && v > 0);
  const eiVals = tomas.map((m) => m.ei).filter((v): v is number => v != null && v > 0);
  const cvFrac = (arr: number[]): number | null => {
    if (arr.length < 2) return null;
    const m = promedio(arr);
    return m ? desviacion(arr) / m : null;
  };
  const vals = [cvFrac(masVals), cvFrac(eiVals)].filter((v): v is number => v != null);
  const maxCv = vals.length > 0 ? Math.max(...vals) : null;
  return (maxCv != null ? maxCv <= 0.1 : true) ? "Conforme" : "No_conforme";
}

/** 2.20 — Compensación CAE (kVp/espesores): variación ≤ 30% vs base. */
function evaluar220(d: DatosEvalConv): Concepto | undefined {
  const s = d.caeSetup;
  const hayBase =
    s != null && (s.mas_base_60kv != null || s.mas_base_70kv != null || s.mas_base_81kv != null);
  if (!hayBase) return undefined;
  const byToma = new Map(d.caeMediciones.map((m) => [m.toma_numero, m]));
  const vals = [
    varRel(byToma.get(1)?.carga_mas, s?.mas_base_60kv),
    varRel(byToma.get(1)?.ei, s?.ei_base_60kv),
    varRel(byToma.get(12)?.carga_mas, s?.mas_base_70kv),
    varRel(byToma.get(12)?.ei, s?.ei_base_70kv),
    varRel(byToma.get(13)?.carga_mas, s?.mas_base_81kv),
    varRel(byToma.get(13)?.ei, s?.ei_base_81kv),
    varRel(byToma.get(13)?.carga_mas, s?.mas_base_cu1),
    varRel(byToma.get(13)?.ei, s?.ei_base_cu1),
    varRel(byToma.get(14)?.carga_mas, s?.mas_base_cu2),
    varRel(byToma.get(14)?.ei, s?.ei_base_cu2),
    varRel(byToma.get(15)?.carga_mas, s?.mas_base_cu3),
    varRel(byToma.get(15)?.ei, s?.ei_base_cu3),
  ].filter((v): v is number => v != null);
  const maxVar = vals.length > 0 ? Math.max(...vals) : null;
  return (maxVar != null ? maxVar <= 0.3 : true) ? "Conforme" : "No_conforme";
}

/** 2.21 — Dosis al receptor: |dosis·corrGeom - base| < 0.01 mGy. */
function evaluar221(d: DatosEvalConv): Concepto | undefined {
  const setup = d.raysafeSetup;
  const d1 = setup?.distancia_foco_sensor_d1_cm ?? 100;
  const d2 = setup?.distancia_foco_detector_d2_cm ?? 100;
  const corrGeom = (d2 / d1) ** 2;
  const sinRejilla = d.raysafeMediciones.filter((m) => m.tipo_medicion === "sin_rejilla");
  const hayBase = sinRejilla.some((m) => m.dosis_base_mgy != null);
  if (!hayBase) return undefined; // sin referencia previa → se establece base
  const diffs = sinRejilla
    .map((m) =>
      m.dosis_medida_mgy == null || m.dosis_base_mgy == null
        ? null
        : Math.abs(m.dosis_medida_mgy * corrGeom - m.dosis_base_mgy)
    )
    .filter((v): v is number => v != null);
  const maxDiff = diffs.length > 0 ? Math.max(...diffs) : null;
  return (maxDiff != null ? maxDiff < 0.01 : true) ? "Conforme" : "No_conforme";
}

const EVALUADORES: Record<string, (d: DatosEvalConv) => Concepto | undefined> = {
  "2.1": evaluar21,
  "2.2": evaluar22,
  "2.3": evaluar23,
  "2.4": evaluar24,
  "2.5": evaluar25,
  "2.6": evaluar26,
  "2.7": evaluar27,
  // 2.8 no tiene criterio (ver tieneCriterio)
  "2.9": evaluar29,
  "2.10": evaluar210,
  "2.11": evaluar211,
  "2.12": evaluar212,
  "2.13": evaluar213,
  "2.14": evaluar214,
  "2.15": evaluar215,
  "2.16": evaluar216,
  "2.17": evaluar217,
  "2.18": evaluar218,
  "2.19": evaluar219,
  "2.20": evaluar220,
  "2.21": evaluar221,
};

/** ¿La prueba define un criterio de aceptación evaluable? (false solo para 2.8) */
export function tieneCriterio(codigo: string): boolean {
  return codigo !== "2.8" && codigo in EVALUADORES;
}

/**
 * Concepto automático de una prueba a partir de los datos capturados.
 * Devuelve undefined si está pendiente (sin datos) o no aplica criterio (2.8).
 */
export function evaluarConceptoPrueba(codigo: string, d: DatosEvalConv): Concepto | undefined {
  return EVALUADORES[codigo]?.(d);
}

/** Carga todas las tablas conv_* necesarias para evaluar (sin fotos). */
export async function cargarTablasConv(visitaId: string): Promise<DatosEvalConv> {
  const [
    mediciones,
    inspeccion,
    elementos,
    colimacion,
    raysafeSetup,
    raysafeMediciones,
    ddiMediciones,
    uniformidadDetector,
    resolucion,
    bajoContraste,
    cassettes,
    uniformidadCr,
    mtf,
    caeSetup,
    caeMediciones,
  ] = await Promise.all([
    db.conv_mediciones.where("visita_id").equals(visitaId).toArray(),
    db.conv_inspeccion_items.where("visita_id").equals(visitaId).toArray(),
    db.conv_elementos_proteccion.where("visita_id").equals(visitaId).toArray(),
    db.conv_colimacion.where("visita_id").equals(visitaId).first(),
    db.conv_raysafe_setup.where("visita_id").equals(visitaId).first(),
    db.conv_raysafe_mediciones.where("visita_id").equals(visitaId).toArray(),
    db.conv_ddi_mediciones.where("visita_id").equals(visitaId).toArray(),
    db.conv_uniformidad_detector.where("visita_id").equals(visitaId).toArray(),
    db.conv_resolucion.where("visita_id").equals(visitaId).first(),
    db.conv_bajo_contraste.where("visita_id").equals(visitaId).first(),
    db.conv_cassette_inspeccion.where("visita_id").equals(visitaId).toArray(),
    db.conv_uniformidad_cr.where("visita_id").equals(visitaId).toArray(),
    db.conv_mtf.where("visita_id").equals(visitaId).first(),
    db.conv_cae_setup.where("visita_id").equals(visitaId).first(),
    db.conv_cae_mediciones.where("visita_id").equals(visitaId).toArray(),
  ]);

  return {
    mediciones,
    inspeccion,
    elementos,
    colimacion,
    raysafeSetup,
    raysafeMediciones,
    ddiMediciones,
    uniformidadDetector,
    resolucion,
    bajoContraste,
    cassettes,
    uniformidadCr,
    mtf,
    caeSetup,
    caeMediciones,
  };
}
