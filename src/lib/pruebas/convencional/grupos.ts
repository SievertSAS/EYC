// ============================================================
//  Definiciones de los 7 grupos de pruebas para CONVENCIONAL
//  Basado en plantilla TECDOC 1958 / Resolución 1811
// ============================================================

import type { GrupoPruebaDefinition } from "../types";
import { TEXTOS } from "./textos";

// ─── Grupo A: Levantamiento radiométrico + Inspección visual ───

const GRUPO_A: GrupoPruebaDefinition = {
  codigo: "CONV_A",
  nombre: "Levantamiento radiométrico e inspección visual",
  orden: 1,
  schema_mediciones: {
    columnas: [
      { key: "punto", label: "Punto", type: "number", required: true },
      { key: "ubicacion", label: "Ubicación / descripción", type: "text", required: true },
      { key: "tasa_dosis", label: "Tasa dosis", type: "number", unit: "mSv/h", decimal_places: 4, required: true },
      { key: "factor_ocupacion", label: "Factor T", type: "select", opciones: ["1", "1/4", "1/16", "1/20", "1/40"], required: true },
      { key: "tipo_area", label: "Tipo área", type: "select", opciones: ["controlada", "supervisada"], required: true },
      { key: "horas_anio", label: "Horas/año", type: "number", placeholder: "2000" },
    ],
  },
  slots_imagen: [
    { key: "plano_radiometrico", label: "Plano de levantamiento radiométrico", obligatorio: true, max_imagenes: 1 },
  ],
  pruebas: [
    {
      codigo: "LEV_CONV",
      numero_tecdoc: "2.1",
      nombre: "Evaluación de condiciones ambientales / Levantamiento radiométrico",
      descripcion: "Medir tasa de dosis en puntos representativos para verificar protección radiológica",
      orden_en_grupo: 1,
      orden_global: 1,
      formulas: [
        {
          campo_resultado: "dosis_anual_msv",
          label: "Dosis anual",
          unit: "mSv",
          expresion: "row.tasa_dosis * (row.factor_ocupacion === '1' ? 1 : row.factor_ocupacion === '1/4' ? 0.25 : row.factor_ocupacion === '1/16' ? 0.0625 : row.factor_ocupacion === '1/20' ? 0.05 : 0.025) * (row.horas_anio || 2000)",
          dependencias: ["tasa_dosis", "factor_ocupacion", "horas_anio"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "dosis_anual_msv",
          operador: "lte",
          valor: 5,
          unidad: "mSv",
          descripcion: "Dosis anual ≤ 5 mSv en áreas controladas",
          referencia_normativa: "Resolución 1811 de 2025",
        },
      ],
      textos_informe: TEXTOS["2.1"],
      slots_imagen: [],
    },
    {
      codigo: "INS_CONV",
      numero_tecdoc: "2.2",
      nombre: "Inspección visual, descripción de la instalación y blindajes",
      descripcion: "Verificar estado físico del equipo y elementos de protección",
      orden_en_grupo: 2,
      orden_global: 2,
      formulas: [],
      criterios_aceptacion: [],
      textos_informe: TEXTOS["2.2"],
      slots_imagen: [
        { key: "foto_equipo", label: "Fotografía del equipo", obligatorio: false, max_imagenes: 2 },
        { key: "foto_sala", label: "Fotografía de la sala", obligatorio: false, max_imagenes: 2 },
      ],
    },
  ],
};

// ─── Grupo B: Colimación + Resolución alto/bajo contraste ───

const GRUPO_B: GrupoPruebaDefinition = {
  codigo: "CONV_B",
  nombre: "Colimación y resolución de imagen",
  orden: 2,
  schema_mediciones: {
    columnas: [
      { key: "borde", label: "Borde", type: "select", opciones: ["Superior", "Inferior", "Izquierdo", "Derecho"], required: true },
      { key: "campo_luz_cm", label: "Campo luz", type: "number", unit: "cm", decimal_places: 1 },
      { key: "campo_rx_cm", label: "Campo RX", type: "number", unit: "cm", decimal_places: 1 },
      { key: "desviacion_cm", label: "Desviación", type: "number", unit: "cm", decimal_places: 1 },
      { key: "dfi_cm", label: "DFI", type: "number", unit: "cm", placeholder: "100" },
      { key: "resolucion_lp_mm", label: "Resolución", type: "number", unit: "lp/mm", decimal_places: 1 },
      { key: "bajo_contraste_objetos", label: "Objetos bajo contraste", type: "number" },
    ],
  },
  slots_imagen: [
    { key: "imagen_colimacion", label: "Imagen de colimación", obligatorio: true, max_imagenes: 1 },
    { key: "imagen_resolucion", label: "Imagen de resolución", obligatorio: true, max_imagenes: 1 },
  ],
  pruebas: [
    {
      codigo: "COL_CONV",
      numero_tecdoc: "2.3",
      nombre: "Sistema de colimación del haz y perpendicularidad",
      descripcion: "Evaluar coincidencia campo luminoso/campo de radiación",
      orden_en_grupo: 1,
      orden_global: 3,
      formulas: [
        {
          campo_resultado: "desviacion_total_pct",
          label: "Desviación total",
          unit: "% DFI",
          expresion: "Math.abs(row.desviacion_cm) / (row.dfi_cm || 100) * 100",
          dependencias: ["desviacion_cm", "dfi_cm"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_total_pct",
          operador: "lte",
          valor: 3,
          unidad: "% DFI",
          descripcion: "Desviación total ≤ 3% de la DFI",
          referencia_normativa: "TECDOC 1958, Sec. 2.3",
        },
      ],
      textos_informe: TEXTOS["2.3"],
      slots_imagen: [],
    },
    {
      codigo: "RES_ALTO_CONV",
      numero_tecdoc: "2.12",
      nombre: "Resolución espacial de alto contraste",
      descripcion: "Evaluar resolución espacial del sistema de imagen",
      orden_en_grupo: 2,
      orden_global: 12,
      formulas: [],
      criterios_aceptacion: [
        {
          campo: "resolucion_lp_mm",
          operador: "gte",
          valor: 2.0,
          unidad: "lp/mm",
          descripcion: "Resolución ≥ valor de referencia del sistema",
          referencia_normativa: "TECDOC 1958, Sec. 2.12",
        },
      ],
      textos_informe: TEXTOS["2.12"],
      slots_imagen: [],
    },
    {
      codigo: "RES_BAJO_CONV",
      numero_tecdoc: "2.13",
      nombre: "Resolución de bajo contraste",
      descripcion: "Evaluar la resolución de bajo contraste del sistema",
      orden_en_grupo: 3,
      orden_global: 13,
      formulas: [],
      criterios_aceptacion: [],
      textos_informe: TEXTOS["2.13"],
      slots_imagen: [],
    },
  ],
};

// ─── Grupo C: Mediciones RaySafe (tiempo, kVp, CHR, rendimiento, repetibilidad, dosis) ───

const GRUPO_C: GrupoPruebaDefinition = {
  codigo: "CONV_C",
  nombre: "Mediciones RaySafe — Parámetros del generador",
  orden: 3,
  schema_mediciones: {
    columnas: [
      { key: "kvp_set", label: "kVp nominal", type: "number", required: true },
      { key: "kvp_med", label: "kVp medido", type: "number", decimal_places: 1 },
      { key: "mas_set", label: "mAs nominal", type: "number" },
      { key: "mas_med", label: "mAs medido", type: "number", decimal_places: 2 },
      { key: "tiempo_set", label: "Tiempo nom. (s)", type: "number", decimal_places: 3 },
      { key: "tiempo_med", label: "Tiempo med. (s)", type: "number", decimal_places: 3 },
      { key: "dosis_ugy", label: "Dosis (µGy)", type: "number", decimal_places: 1 },
      { key: "hvl_mmal", label: "HVL (mmAl)", type: "number", decimal_places: 2 },
    ],
  },
  slots_imagen: [
    { key: "montaje_raysafe", label: "Montaje de medición RaySafe", obligatorio: false, max_imagenes: 1 },
  ],
  pruebas: [
    {
      codigo: "TIE_CONV",
      numero_tecdoc: "2.4",
      nombre: "Exactitud y repetibilidad del tiempo de exposición",
      descripcion: "Evaluar exactitud y repetibilidad del indicador de tiempo",
      orden_en_grupo: 1,
      orden_global: 4,
      formulas: [
        {
          campo_resultado: "desviacion_tiempo_pct",
          label: "Desviación tiempo",
          unit: "%",
          expresion: "row.tiempo_set > 0 ? Math.abs(row.tiempo_med - row.tiempo_set) / row.tiempo_set * 100 : 0",
          dependencias: ["tiempo_set", "tiempo_med"],
        },
        {
          campo_resultado: "cv_tiempo_pct",
          label: "CV% tiempo",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.tiempo_set === row.tiempo_set && r.tiempo_med != null).map(r => r.tiempo_med))",
          dependencias: ["tiempo_set", "tiempo_med"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_tiempo_pct",
          operador: "lte",
          valor: 20,
          unidad: "%",
          descripcion: "Desviación ≤ ±20% (tiempos ≥ 100 ms)",
          referencia_normativa: "TECDOC 1958, Sec. 2.4",
        },
        {
          campo: "cv_tiempo_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "CV% ≤ 10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.4",
        },
      ],
      textos_informe: TEXTOS["2.4"],
      slots_imagen: [],
    },
    {
      codigo: "KVP_CONV",
      numero_tecdoc: "2.5",
      nombre: "Exactitud y repetibilidad de la tensión del tubo (kVp)",
      descripcion: "Evaluar exactitud y repetibilidad del kVp del generador",
      orden_en_grupo: 2,
      orden_global: 5,
      formulas: [
        {
          campo_resultado: "desviacion_kvp_pct",
          label: "Desviación kVp",
          unit: "%",
          expresion: "row.kvp_set > 0 ? Math.abs(row.kvp_med - row.kvp_set) / row.kvp_set * 100 : 0",
          dependencias: ["kvp_set", "kvp_med"],
        },
        {
          campo_resultado: "cv_kvp_pct",
          label: "CV% kVp",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.kvp_set === row.kvp_set && r.kvp_med != null).map(r => r.kvp_med))",
          dependencias: ["kvp_set", "kvp_med"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_kvp_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "Desviación ≤ ±10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.5",
        },
        {
          campo: "cv_kvp_pct",
          operador: "lte",
          valor: 5,
          unidad: "%",
          descripcion: "CV% ≤ 5%",
          referencia_normativa: "TECDOC 1958, Sec. 2.5",
        },
      ],
      textos_informe: TEXTOS["2.5"],
      slots_imagen: [],
    },
    {
      codigo: "CHR_CONV",
      numero_tecdoc: "2.6",
      nombre: "Capa hemirreductora (CHR / HVL)",
      descripcion: "Determinar la CHR del haz para verificar filtración",
      orden_en_grupo: 3,
      orden_global: 6,
      formulas: [
        {
          campo_resultado: "hvl_promedio",
          label: "HVL promedio",
          unit: "mmAl",
          expresion: "stats.mean(rows.filter(r => r.hvl_mmal != null && r.hvl_mmal > 0).map(r => r.hvl_mmal))",
          dependencias: ["hvl_mmal"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "hvl_promedio",
          operador: "gte",
          valor: 2.5,
          unidad: "mmAl",
          descripcion: "CHR ≥ valor mínimo para el kVp de operación",
          referencia_normativa: "TECDOC 1958, Sec. 2.6",
        },
      ],
      textos_informe: TEXTOS["2.6"],
      slots_imagen: [],
    },
    {
      codigo: "REN_CONV",
      numero_tecdoc: "2.7",
      nombre: "Rendimiento del tubo de rayos X",
      descripcion: "Evaluar el rendimiento (µGy/mAs) y linealidad",
      orden_en_grupo: 4,
      orden_global: 7,
      formulas: [
        {
          campo_resultado: "rendimiento",
          label: "Rendimiento",
          unit: "µGy/mAs",
          expresion: "row.mas_med > 0 ? row.dosis_ugy / row.mas_med : 0",
          dependencias: ["dosis_ugy", "mas_med"],
        },
        {
          campo_resultado: "cv_rendimiento_pct",
          label: "CV% rendimiento",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.mas_med > 0 && r.dosis_ugy > 0).map(r => r.dosis_ugy / r.mas_med))",
          dependencias: ["dosis_ugy", "mas_med"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "cv_rendimiento_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "CV% rendimiento ≤ 10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.7",
        },
      ],
      textos_informe: TEXTOS["2.7"],
      slots_imagen: [],
    },
    {
      codigo: "REP_CONV",
      numero_tecdoc: "2.8",
      nombre: "Repetibilidad y reproducibilidad de la dosis",
      descripcion: "Evaluar repetibilidad de la dosis de salida",
      orden_en_grupo: 5,
      orden_global: 8,
      formulas: [
        {
          campo_resultado: "cv_dosis_pct",
          label: "CV% dosis",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.dosis_ugy > 0).map(r => r.dosis_ugy))",
          dependencias: ["dosis_ugy"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "cv_dosis_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "CV% dosis ≤ 10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.8",
        },
      ],
      textos_informe: TEXTOS["2.8"],
      slots_imagen: [],
    },
    {
      codigo: "DOS_CONV",
      numero_tecdoc: "2.21",
      nombre: "Estimación de dosis al paciente",
      descripcion: "Estimar kerma en aire incidente para proyecciones clínicas",
      orden_en_grupo: 6,
      orden_global: 21,
      formulas: [
        {
          campo_resultado: "kerma_aire_ugy",
          label: "Kerma en aire",
          unit: "µGy",
          expresion: "row.dosis_ugy || 0",
          dependencias: ["dosis_ugy"],
        },
      ],
      criterios_aceptacion: [],
      textos_informe: TEXTOS["2.21"],
      slots_imagen: [],
    },
  ],
};

// ─── Grupo D: DDI/EI + Repetibilidad DDI ───

const GRUPO_D: GrupoPruebaDefinition = {
  codigo: "CONV_D",
  nombre: "Indicadores de dosis al detector (DDI/EI)",
  orden: 4,
  schema_mediciones: {
    columnas: [
      { key: "mas_set", label: "mAs nominal", type: "number", required: true },
      { key: "kvp_set", label: "kVp", type: "number", required: true },
      { key: "ddi_valor", label: "DDI / EI medido", type: "number", decimal_places: 1 },
      { key: "ddi_ref", label: "DDI / EI referencia", type: "number", decimal_places: 1 },
      { key: "dosis_ugy", label: "Dosis (µGy)", type: "number", decimal_places: 1 },
    ],
  },
  slots_imagen: [
    { key: "captura_ddi", label: "Captura de pantalla DDI/EI", obligatorio: false, max_imagenes: 2 },
  ],
  pruebas: [
    {
      codigo: "DDI_CONV",
      numero_tecdoc: "2.9",
      nombre: "Indicador de dosis al detector (DDI/EI/S)",
      descripcion: "Verificar calibración del DDI/EI del sistema digital",
      orden_en_grupo: 1,
      orden_global: 9,
      formulas: [
        {
          campo_resultado: "desviacion_ddi_pct",
          label: "Desviación DDI",
          unit: "%",
          expresion: "row.ddi_ref > 0 ? Math.abs(row.ddi_valor - row.ddi_ref) / row.ddi_ref * 100 : 0",
          dependencias: ["ddi_valor", "ddi_ref"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_ddi_pct",
          operador: "lte",
          valor: 20,
          unidad: "%",
          descripcion: "Desviación DDI ≤ ±20%",
          referencia_normativa: "TECDOC 1958, Sec. 2.9",
        },
      ],
      textos_informe: TEXTOS["2.9"],
      slots_imagen: [],
    },
    {
      codigo: "DDI_REP_CONV",
      numero_tecdoc: "2.10",
      nombre: "Repetibilidad del DDI/EI",
      descripcion: "Evaluar repetibilidad del indicador de dosis al detector",
      orden_en_grupo: 2,
      orden_global: 10,
      formulas: [
        {
          campo_resultado: "cv_ddi_pct",
          label: "CV% DDI",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.ddi_valor > 0).map(r => r.ddi_valor))",
          dependencias: ["ddi_valor"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "cv_ddi_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "CV% DDI ≤ 10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.10",
        },
      ],
      textos_informe: TEXTOS["2.10"],
      slots_imagen: [],
    },
  ],
};

// ─── Grupo E: Uniformidad/artefactos + MTF ───

const GRUPO_E: GrupoPruebaDefinition = {
  codigo: "CONV_E",
  nombre: "Calidad de imagen — Uniformidad y MTF",
  orden: 5,
  schema_mediciones: {
    columnas: [
      { key: "roi", label: "ROI", type: "select", opciones: ["Centro", "Superior", "Inferior", "Izquierda", "Derecha"], required: true },
      { key: "orientacion", label: "Orientación", type: "select", opciones: ["Horizontal", "Vertical"] },
      { key: "media_pixel", label: "Media pixel", type: "number", decimal_places: 1 },
      { key: "stddev_pixel", label: "Desv. estándar", type: "number", decimal_places: 1 },
      { key: "snr", label: "SNR", type: "number", decimal_places: 1 },
      { key: "mtf50", label: "MTF 50%", type: "number", unit: "lp/mm", decimal_places: 2 },
      { key: "mtf20", label: "MTF 20%", type: "number", unit: "lp/mm", decimal_places: 2 },
    ],
  },
  slots_imagen: [
    { key: "captura_dicom_uniformidad", label: "Captura DICOM uniformidad", obligatorio: true, max_imagenes: 2 },
    { key: "captura_dicom_mtf", label: "Captura DICOM MTF", obligatorio: false, max_imagenes: 2 },
  ],
  pruebas: [
    {
      codigo: "UNI_CONV",
      numero_tecdoc: "2.11",
      nombre: "Uniformidad de la imagen y artefactos",
      descripcion: "Evaluar uniformidad de imagen y detectar artefactos",
      orden_en_grupo: 1,
      orden_global: 11,
      formulas: [
        {
          campo_resultado: "variacion_uniformidad_pct",
          label: "Variación uniformidad",
          unit: "%",
          expresion: "(() => { const centro = rows.find(r => r.roi === 'Centro'); if (!centro || !centro.media_pixel) return 0; return stats.max(rows.filter(r => r.media_pixel > 0).map(r => Math.abs(r.media_pixel - centro.media_pixel) / centro.media_pixel * 100)); })()",
          dependencias: ["roi", "media_pixel"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "variacion_uniformidad_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "Variación entre ROIs ≤ ±10% respecto al centro",
          referencia_normativa: "TECDOC 1958, Sec. 2.11",
        },
      ],
      textos_informe: TEXTOS["2.11"],
      slots_imagen: [],
    },
    {
      codigo: "MTF_CONV",
      numero_tecdoc: "2.16",
      nombre: "Función de transferencia de modulación (MTF)",
      descripcion: "Evaluar MTF del sistema de imagen",
      orden_en_grupo: 2,
      orden_global: 16,
      formulas: [],
      criterios_aceptacion: [
        {
          campo: "mtf50",
          operador: "gte",
          valor: 1.0,
          unidad: "lp/mm",
          descripcion: "MTF 50% ≥ 80% del valor de referencia",
          referencia_normativa: "TECDOC 1958, Sec. 2.16",
        },
      ],
      textos_informe: TEXTOS["2.16"],
      slots_imagen: [],
    },
  ],
};

// ─── Grupo F: Integridad cassette + Sensibilidad IP ───

const GRUPO_F: GrupoPruebaDefinition = {
  codigo: "CONV_F",
  nombre: "Chasis e imagen — Integridad y sensibilidad",
  orden: 6,
  schema_mediciones: {
    columnas: [
      { key: "cassette_id", label: "Identificación chasis/IP", type: "text", required: true },
      { key: "tamano", label: "Tamaño", type: "text", placeholder: "35x43 cm" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Bueno", "Regular", "Malo"] },
      { key: "artefactos", label: "Artefactos", type: "select", opciones: ["Sin artefactos", "Artefactos leves", "Artefactos severos"] },
      { key: "ddi_valor", label: "DDI/EI", type: "number", decimal_places: 1 },
    ],
  },
  slots_imagen: [
    { key: "foto_cassettes", label: "Fotografía de chasis/IPs", obligatorio: false, max_imagenes: 2 },
  ],
  pruebas: [
    {
      codigo: "CAS_CONV",
      numero_tecdoc: "2.14",
      nombre: "Integridad de chasis / placas de imagen (IP)",
      descripcion: "Verificar integridad física y funcional de los chasis",
      orden_en_grupo: 1,
      orden_global: 14,
      formulas: [],
      criterios_aceptacion: [],
      textos_informe: TEXTOS["2.14"],
      slots_imagen: [],
    },
    {
      codigo: "SEN_CONV",
      numero_tecdoc: "2.15",
      nombre: "Uniformidad de sensibilidad entre IPs",
      descripcion: "Evaluar uniformidad de sensibilidad entre placas de imagen",
      orden_en_grupo: 2,
      orden_global: 15,
      formulas: [
        {
          campo_resultado: "variacion_sensibilidad_pct",
          label: "Variación sensibilidad",
          unit: "%",
          expresion: "(() => { const vals = rows.filter(r => r.ddi_valor > 0).map(r => r.ddi_valor); if (vals.length < 2) return 0; const m = stats.mean(vals); return stats.max(vals.map(v => Math.abs(v - m) / m * 100)); })()",
          dependencias: ["ddi_valor"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "variacion_sensibilidad_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "Variación DDI/EI entre IPs ≤ ±10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.15",
        },
      ],
      textos_informe: TEXTOS["2.15"],
      slots_imagen: [],
    },
  ],
};

// ─── Grupo G: CAE (sensibilidad, consistencia, repetibilidad, compensación) ───

const GRUPO_G: GrupoPruebaDefinition = {
  codigo: "CONV_G",
  nombre: "Control automático de exposición (CAE)",
  orden: 7,
  schema_mediciones: {
    columnas: [
      { key: "kvp_set", label: "kVp", type: "number", required: true },
      { key: "espesor_mm", label: "Espesor", type: "number", unit: "mm", placeholder: "Atenuador" },
      { key: "material", label: "Material", type: "select", opciones: ["PMMA", "Cu", "Al"] },
      { key: "mas_med", label: "mAs medido", type: "number", decimal_places: 2 },
      { key: "dosis_ugy", label: "Dosis (µGy)", type: "number", decimal_places: 1 },
      { key: "ddi_valor", label: "DDI/EI", type: "number", decimal_places: 1 },
      { key: "ddi_ref", label: "DDI/EI ref.", type: "number", decimal_places: 1 },
      { key: "tipo_prueba_cae", label: "Tipo prueba", type: "select", opciones: ["sensibilidad", "consistencia", "repetibilidad", "compensacion"] },
    ],
  },
  slots_imagen: [
    { key: "montaje_cae", label: "Montaje prueba CAE", obligatorio: false, max_imagenes: 1 },
  ],
  pruebas: [
    {
      codigo: "CAE_SEN_CONV",
      numero_tecdoc: "2.17",
      nombre: "Sensibilidad del CAE",
      descripcion: "Evaluar sensibilidad del control automático de exposición",
      orden_en_grupo: 1,
      orden_global: 17,
      formulas: [
        {
          campo_resultado: "desviacion_cae_sen_pct",
          label: "Desviación sensibilidad",
          unit: "%",
          expresion: "row.ddi_ref > 0 ? Math.abs(row.ddi_valor - row.ddi_ref) / row.ddi_ref * 100 : 0",
          dependencias: ["ddi_valor", "ddi_ref"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_cae_sen_pct",
          operador: "lte",
          valor: 20,
          unidad: "%",
          descripcion: "Variación DDI/EI ≤ ±20%",
          referencia_normativa: "TECDOC 1958, Sec. 2.17",
        },
      ],
      textos_informe: TEXTOS["2.17"],
      slots_imagen: [],
    },
    {
      codigo: "CAE_CON_CONV",
      numero_tecdoc: "2.18",
      nombre: "Consistencia del CAE a diferentes kVp",
      descripcion: "Evaluar consistencia del CAE a diferentes tensiones",
      orden_en_grupo: 2,
      orden_global: 18,
      formulas: [
        {
          campo_resultado: "variacion_consistencia_pct",
          label: "Variación consistencia",
          unit: "%",
          expresion: "(() => { const vals = rows.filter(r => r.tipo_prueba_cae === 'consistencia' && r.ddi_valor > 0).map(r => r.ddi_valor); if (vals.length < 2) return 0; const m = stats.mean(vals); return stats.max(vals.map(v => Math.abs(v - m) / m * 100)); })()",
          dependencias: ["ddi_valor", "tipo_prueba_cae"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "variacion_consistencia_pct",
          operador: "lte",
          valor: 20,
          unidad: "%",
          descripcion: "Variación DDI/EI entre kVp ≤ ±20%",
          referencia_normativa: "TECDOC 1958, Sec. 2.18",
        },
      ],
      textos_informe: TEXTOS["2.18"],
      slots_imagen: [],
    },
    {
      codigo: "CAE_REP_CONV",
      numero_tecdoc: "2.19",
      nombre: "Repetibilidad del CAE",
      descripcion: "Evaluar repetibilidad del control automático de exposición",
      orden_en_grupo: 3,
      orden_global: 19,
      formulas: [
        {
          campo_resultado: "cv_cae_rep_pct",
          label: "CV% CAE",
          unit: "%",
          expresion: "stats.cv(rows.filter(r => r.tipo_prueba_cae === 'repetibilidad' && r.ddi_valor > 0).map(r => r.ddi_valor))",
          dependencias: ["ddi_valor", "tipo_prueba_cae"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "cv_cae_rep_pct",
          operador: "lte",
          valor: 10,
          unidad: "%",
          descripcion: "CV% DDI/EI ≤ 10%",
          referencia_normativa: "TECDOC 1958, Sec. 2.19",
        },
      ],
      textos_informe: TEXTOS["2.19"],
      slots_imagen: [],
    },
    {
      codigo: "CAE_COM_CONV",
      numero_tecdoc: "2.20",
      nombre: "Compensación del CAE para diferentes espesores",
      descripcion: "Evaluar compensación del CAE para distintos grosores de paciente",
      orden_en_grupo: 4,
      orden_global: 20,
      formulas: [
        {
          campo_resultado: "desviacion_compensacion_pct",
          label: "Desviación compensación",
          unit: "%",
          expresion: "row.ddi_ref > 0 ? Math.abs(row.ddi_valor - row.ddi_ref) / row.ddi_ref * 100 : 0",
          dependencias: ["ddi_valor", "ddi_ref"],
        },
      ],
      criterios_aceptacion: [
        {
          campo: "desviacion_compensacion_pct",
          operador: "lte",
          valor: 20,
          unidad: "%",
          descripcion: "Variación DDI/EI ≤ ±20%",
          referencia_normativa: "TECDOC 1958, Sec. 2.20",
        },
      ],
      textos_informe: TEXTOS["2.20"],
      slots_imagen: [],
    },
  ],
};

// ─── Export ───

export const GRUPOS_CONVENCIONAL: GrupoPruebaDefinition[] = [
  GRUPO_A,
  GRUPO_B,
  GRUPO_C,
  GRUPO_D,
  GRUPO_E,
  GRUPO_F,
  GRUPO_G,
];
