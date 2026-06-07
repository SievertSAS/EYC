// ============================================================
//  Tablas dedicadas del equipo Convencional (Rayos X)
//  Cada tipo de equipo define sus propias tablas — 0 dependencia
//  con otros equipos.
// ============================================================

import type { SyncFields } from "@/lib/db/types";

// ─── Grupo A: Levantamiento Radiométrico ───

/** Setup de la prueba 2.1 — 1 registro por visita */
export interface ConvLevantamientoSetup {
  id?: number;
  visita_id: number;
  fondo_natural_usv_h?: number;
  distancia_tubo_operario_m?: number;
  tecnica_kv?: number;
  tecnica_ma?: number;
  tecnica_tiempo_s?: number;
  tecnica_mas?: number;
  w_estimada?: number;
  w_estandar?: number;
  factor_uso_u?: number;
  semanas_laborales?: number;
  creado_en?: string;
}

/** Punto de medición radiométrica — N por visita */
export interface ConvMedicionRadiometrica extends Partial<SyncFields> {
  id?: number;
  visita_id: number;
  punto_numero: number;
  ubicacion_descripcion: string;
  /** Lectura cruda del detector (μSv/h) — entrada del físico */
  tasa_dosis_usv_h?: number;
  /** Conversión automática (= usv_h / 1000) */
  tasa_dosis_msv_h?: number;
  /** Factor de ocupación T — entrada del físico por punto */
  factor_ocupacion_t?: number;
  /** Factor de uso U — copiado del setup al guardar */
  factor_uso_u?: number;
  /** Carga de trabajo W usada — max(estimada, estándar), copiado del setup */
  carga_trabajo_w?: number;
  /** Corriente de prueba I (mA) — copiada del setup */
  corriente_prueba_i?: number;
  tipo_area?: "controlada" | "supervisada";
  /** H*(10) calculado (mSv/año) — persistido al guardar */
  dosis_anual_msv?: number;
  /** Concepto auto-evaluado — persistido al guardar */
  concepto?: "Conforme" | "No_conforme";
  observacion?: string;
  creado_en?: string;
}

// ─── Grupo A: Inspección Visual (prueba 2.2) ───

/** Item de checklist de inspección — N por visita */
export interface ConvInspeccionItem {
  id?: number;
  visita_id: number;
  /** "equipo" | "condiciones_operacion" */
  seccion: "equipo" | "condiciones_operacion";
  item_numero: number;
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  observacion?: string;
  creado_en?: string;
}

/** Elemento de protección radiológica — N por visita */
export interface ConvElementoProteccion {
  id?: number;
  visita_id: number;
  descripcion: string;
  cantidad?: number;
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  observacion?: string;
  creado_en?: string;
}

// ─── Grupo B: RaySafe ───

/** Setup del grupo B — 1 registro por visita */
export interface ConvRaysafeSetup {
  id?: number;
  visita_id: number;
  /** Distancia foco-sensor en cm (default 100) */
  distancia_foco_sensor_cm?: number;
  /** Distancia foco-sensor para mediciones sin rejilla d1 (cm) */
  distancia_foco_sensor_d1_cm?: number;
  /** Distancia foco-detector de imagen d2 (cm) */
  distancia_foco_detector_d2_cm?: number;
  /** Archivo RaySafe importado (blob) */
  archivo_raysafe_blob?: Blob;
  archivo_raysafe_nombre?: string;
  creado_en?: string;
}

/** Disparo individual (valor nominal + valor medido por RaySafe) — N por visita */
export interface ConvRaysafeMedicion {
  id?: number;
  visita_id: number;
  /**
   * Tipo de medición:
   * - "principal": disparos principales sin rejilla (grupos 1-8)
   * - "con_rejilla": programas clínicos con rejilla
   * - "sin_rejilla": programas clínicos sin rejilla
   * - "kerma": mediciones de kerma en aire (prueba 2.8)
   */
  tipo_medicion: "principal" | "con_rejilla" | "sin_rejilla" | "kerma";
  /** Número de grupo (1-8 para principales, null para otros) */
  grupo_numero?: number;
  /** Número secuencial de la toma */
  toma_numero: number;
  /** Nombre del programa clínico (para con/sin rejilla: "Extremidad", "Tórax AP", etc.) */
  programa_clinico?: string;
  // ── Valores nominales (configurados en el equipo) ──
  kv_nominal?: number;
  ma_nominal?: number;
  tiempo_nominal_s?: number;
  mas_nominal?: number;
  // ── Valores medidos por el sensor RaySafe ──
  kv_medido?: number;
  tiempo_medido_s?: number;
  dosis_medida_mgy?: number;
  /** Capa hemirreductora medida (mm Al) */
  chr_medido_mmal?: number;
  /** Producto dosis-área medido */
  dap_medido?: number;
  // ── Para prueba 2.8 (PKA) ──
  dap_nominal?: number;
  ancho_irradiacion_cm?: number;
  largo_irradiacion_cm?: number;
  creado_en?: string;
}

// ─── Grupo C: CAE ───

/** Medición CAE — N por visita */
export interface ConvCaeMedicion {
  id?: number;
  visita_id: number;
  toma_numero: number;
  kv_nominal?: number;
  /** Espesor del atenuador de Cu (mm) */
  espesor_cu_mm?: number;
  /** Posición del sensor CAE: Centro, Izquierda, Derecha, combinaciones */
  posicion_sensor?: string;
  /** Carga medida (mAs) — el CAE determina este valor */
  carga_mas?: number;
  /** Índice de exposición */
  ei?: number;
  /** Deviation Index */
  di?: number;
  /** Target Exposure Index */
  tei?: number;
  /** Producto dosis-área */
  dap?: number;
  creado_en?: string;
}

// ─── Grupo D: DDI/EI + Cassettes CR ───

/** Medición DDI/EI (pruebas 2.9 y 2.10) — N por visita */
export interface ConvDdiMedicion {
  id?: number;
  visita_id: number;
  /** Grupo de disparo (1 = grupo principal para 2.9, 2-4 = adicionales) */
  grupo: number;
  toma_numero: number;
  /** Serie del detector CR o DR */
  serie_detector?: string;
  kv_nominal?: number;
  carga_mas?: number;
  ei?: number;
  di?: number;
  tei?: number;
  creado_en?: string;
}

/** Inspección de cassette / pantalla IP CR (prueba 2.14) */
export interface ConvCassetteInspeccion {
  id?: number;
  visita_id: number;
  item_numero: number;
  serie_detector?: string;
  integridad_externa?: "Conforme" | "No_conforme";
  estado_interno?: "Conforme" | "No_conforme";
  polvo_suciedad?: "Conforme" | "No_conforme";
  rayones_defectos?: "Conforme" | "No_conforme";
  limpieza_realizada?: "Conforme" | "No_conforme";
  concepto?: "Conforme" | "No_conforme";
  observacion?: string;
  creado_en?: string;
}

/** Medición de uniformidad CR (prueba 2.15) — 1 por cassette por visita */
export interface ConvUniformidadCr {
  id?: number;
  visita_id: number;
  item_numero: number;
  serie_cassette?: string;
  carga_mas?: number;
  ei?: number;
  di?: number;
  tei?: number;
  creado_en?: string;
}

// ─── Grupo E: Colimación, Resolución, Contraste, MTF ───

/** Prueba 2.3 — Colimación y perpendicularidad */
export interface ConvColimacion {
  id?: number;
  visita_id: number;
  /** Distancia foco-receptor SID (cm) */
  sid_cm?: number;
  tecnica_kv?: number;
  tecnica_ma?: number;
  tecnica_tiempo_s?: number;
  tecnica_mas?: number;
  /** Campos nominal/medido por dirección (cm) */
  anodo_nominal?: number;
  anodo_medido?: number;
  catodo_nominal?: number;
  catodo_medido?: number;
  izquierda_nominal?: number;
  izquierda_medido?: number;
  derecha_nominal?: number;
  derecha_medido?: number;
  /** Perpendicularidad */
  posicion_esfera?: "Centro" | "Primer circulo" | "Segundo circulo" | "Fuera del circulo externo";
  creado_en?: string;
}

/** Prueba 2.11 — Uniformidad y artefactos del detector (1 bloque por chasis/DR) */
export interface ConvUniformidadDetector {
  id?: number;
  visita_id: number;
  item_numero: number;
  serie_detector?: string;
  /** 5 ROIs por orientación: ROIc (centro) + ROI 1-4 */
  roi_0_vmp_ac?: number;
  roi_1_vmp_ac?: number;
  roi_2_vmp_ac?: number;
  roi_3_vmp_ac?: number;
  roi_4_vmp_ac?: number;
  roi_0_vmp_ca?: number;
  roi_1_vmp_ca?: number;
  roi_2_vmp_ca?: number;
  roi_3_vmp_ca?: number;
  roi_4_vmp_ca?: number;
  /** Artefactos observados */
  pixeles_defectuosos?: boolean;
  artefactos?: boolean;
  artefactos_descripcion?: string;
  creado_en?: string;
}

/** Prueba 2.12 — Resolución espacial alto contraste */
export interface ConvResolucion {
  id?: number;
  visita_id: number;
  sid_cm?: number;
  tecnica_kv?: number;
  tecnica_ma?: number;
  tecnica_tiempo_s?: number;
  tecnica_mas?: number;
  /** Pares de líneas visibles (pl/mm) */
  pares_lineas_plmm?: number;
  concepto?: "Conforme" | "No_conforme";
  creado_en?: string;
}

/** Prueba 2.13 — Bajo contraste */
export interface ConvBajoContraste {
  id?: number;
  visita_id: number;
  sid_cm?: number;
  tecnica_kv?: number;
  tecnica_ma?: number;
  tecnica_tiempo_s?: number;
  tecnica_mas?: number;
  /** 8 niveles de contraste: visible sí/no */
  contraste_9_4?: boolean;
  contraste_8_0?: boolean;
  contraste_5_6?: boolean;
  contraste_4_0?: boolean;
  contraste_2_8?: boolean;
  contraste_1_8?: boolean;
  contraste_1_3?: boolean;
  contraste_0_9?: boolean;
  concepto?: "Conforme" | "No_conforme";
  creado_en?: string;
}

/** Prueba 2.16 — MTF */
export interface ConvMtf {
  id?: number;
  visita_id: number;
  distancia_foco_sensor_cm?: number;
  tecnica_kv?: number;
  tecnica_ma?: number;
  tecnica_tiempo_s?: number;
  tecnica_mas?: number;
  pixel_size_mm?: number;
  nyquist_lpmm?: number;
  /** Resultados MTF */
  mtf50_horizontal?: number;
  mtf20_horizontal?: number;
  mtf50_vertical?: number;
  mtf20_vertical?: number;
  /** Valores base */
  mtf50_base_horizontal?: number;
  mtf20_base_horizontal?: number;
  mtf50_base_vertical?: number;
  mtf20_base_vertical?: number;
  concepto?: "Conforme" | "No_conforme";
  creado_en?: string;
}

// ─── Pre-informe: configuración de secciones ───

/** Sección del pre-informe — 1 por prueba por visita */
export interface ConvInformeSeccion {
  id?: number;
  visita_id: number;
  /** Código TECDOC: "2.1", "2.2", ..., "2.21" */
  prueba_codigo: string;
  /** Orden de la sección en el informe (drag & drop) */
  orden: number;
  /** Si la sección está incluida en el informe */
  incluida: boolean;
  /** Concepto: Conforme / No conforme / No aplica */
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  /** Texto de acciones correctivas (editable inline) */
  acciones_correctivas?: string;
  /** Observaciones adicionales del físico */
  observaciones?: string;
  creado_en?: string;
}

// ─── Compartido: Resultados y Evidencias ───

/** Resultado calculado de una prueba individual — 1 por prueba por visita */
export interface ConvResultadoPrueba {
  id?: number;
  visita_id: number;
  /** Código TECDOC: "2.1", "2.4", "2.6", etc. */
  prueba_codigo: string;
  /** Resultado numérico principal (ej: CHR = 2.8) */
  resultado_principal?: number;
  /** Resultado secundario (ej: desviación = 3.2%) */
  resultado_secundario?: number;
  /** Datos adicionales calculados */
  datos_calculados?: Record<string, unknown>;
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  acciones_correctivas?: string;
  completado: boolean;
  fecha_ejecucion?: string;
  creado_en?: string;
}

/** Imagen/evidencia vinculada a una prueba específica */
export interface ConvEvidencia {
  id?: number;
  visita_id: number;
  /** Código TECDOC de la prueba: "2.1", "2.2", etc. */
  prueba_codigo: string;
  /** Identificador del slot dentro de la prueba: "montaje", "plano", "patron_colimacion" */
  slot: string;
  descripcion?: string;
  /** Blob almacenado en IndexedDB */
  blob_local?: Blob;
  /** URL en storage remoto (post-sync) */
  url_storage?: string;
  fecha_captura?: string;
  creado_en?: string;
}
