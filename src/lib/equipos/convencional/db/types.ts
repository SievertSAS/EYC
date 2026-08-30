// ============================================================
//  Tablas dedicadas del equipo Convencional (Rayos X)
//  Cada tipo de equipo define sus propias tablas — 0 dependencia
//  con otros equipos.
// ============================================================

import type { SyncFields } from "@/lib/db/types";

// ─── Grupo A: Levantamiento Radiométrico ───

/** Setup de la prueba 2.1 — 1 registro por visita */
export interface ConvLevantamientoSetup extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
  id?: string;
  visita_id: string;
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
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}

// ─── Grupo A: Inspección Visual (prueba 2.2) ───

/** Item de checklist de inspección — N por visita */
export interface ConvInspeccionItem extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  /** "equipo" | "condiciones_operacion" */
  seccion: "equipo" | "condiciones_operacion";
  item_numero: number;
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  observacion?: string;
  creado_en?: string;
}

/** Elemento de protección radiológica — N por visita */
export interface ConvElementoProteccion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  descripcion: string;
  cantidad?: number;
  tipo_paciente?: "adulto" | "pediatrico";
  concepto?: "Conforme" | "No_conforme" | "No_aplica";
  observacion?: string;
  creado_en?: string;
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}

// ─── Grupo B: RaySafe ───

/** Setup del grupo B — 1 registro por visita */
export interface ConvRaysafeSetup extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  /** Distancia foco-sensor en cm (default 100) */
  distancia_foco_sensor_cm?: number;
  /** Distancia foco-sensor para mediciones sin rejilla d1 (cm) */
  distancia_foco_sensor_d1_cm?: number;
  /** Distancia foco-detector de imagen d2 (cm) */
  distancia_foco_detector_d2_cm?: number;
  /** Archivo RaySafe importado (blob) — solo local, no se sincroniza */
  archivo_raysafe_blob?: Blob;
  archivo_raysafe_nombre?: string;
  creado_en?: string;
}

/** Disparo individual (valor nominal + valor medido por RaySafe) — N por visita */
export interface ConvRaysafeMedicion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
  /** Dosis al receptor base (visita anterior) — solo para tipo sin_rejilla en 2.21 */
  dosis_base_mgy?: number;
  // ── Para prueba 2.8 (PKA) ──
  dap_nominal?: number;
  ancho_irradiacion_cm?: number;
  largo_irradiacion_cm?: number;
  distancia_foco_sensor_cm?: number;
  distancia_foco_detector_cm?: number;
  creado_en?: string;
}

// ─── Grupo C: CAE ───

/** Valores base de referencia del CAE (precarga de visita anterior) — 1 por visita */
export interface ConvCaeSetup extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  /** 2.17 Sensibilidad — base 70 kVp, Cu 1mm, Centro */
  mas_base_217?: number;
  ei_base_217?: number;
  di_base_217?: number;
  /** 2.20 Compensación kVp — base por tensión */
  mas_base_60kv?: number;
  ei_base_60kv?: number;
  di_base_60kv?: number;
  mas_base_70kv?: number;
  ei_base_70kv?: number;
  di_base_70kv?: number;
  mas_base_81kv?: number;
  ei_base_81kv?: number;
  di_base_81kv?: number;
  /** 2.20 Compensación espesores — base por Cu mm */
  mas_base_cu1?: number;
  ei_base_cu1?: number;
  di_base_cu1?: number;
  mas_base_cu2?: number;
  ei_base_cu2?: number;
  di_base_cu2?: number;
  mas_base_cu3?: number;
  ei_base_cu3?: number;
  di_base_cu3?: number;
  creado_en?: string;
}

/** Medición CAE — N por visita */
export interface ConvCaeMedicion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvDdiMedicion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
  /** Valor base del EI para comparación 2.9 (precarga de visita anterior) */
  ei_base?: number;
  /** Valor base del D.I. para comparación 2.9 */
  di_base?: number;
  creado_en?: string;
}

/** Inspección de cassette / pantalla IP CR (prueba 2.14) */
export interface ConvCassetteInspeccion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}

/** Medición de uniformidad CR (prueba 2.15) — 1 por cassette por visita */
export interface ConvUniformidadCr extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  item_numero: number;
  serie_cassette?: string;
  carga_mas?: number;
  ei?: number;
  di?: number;
  tei?: number;
  creado_en?: string;
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}

// ─── Grupo E: Colimación, Resolución, Contraste, MTF ───

/** Prueba 2.3 — Colimación y perpendicularidad */
export interface ConvColimacion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvUniformidadDetector extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  item_numero: number;
  serie_detector?: string;
  /** 5 ROIs por orientación: ROIc (centro) + ROI 1-4 */
  roi_0_vmp_ac?: number;
  roi_1_vmp_ac?: number;
  roi_2_vmp_ac?: number;
  roi_3_vmp_ac?: number;
  roi_4_vmp_ac?: number;
  roi_0_desv_ac?: number;
  roi_1_desv_ac?: number;
  roi_2_desv_ac?: number;
  roi_3_desv_ac?: number;
  roi_4_desv_ac?: number;
  roi_0_vmp_ca?: number;
  roi_1_vmp_ca?: number;
  roi_2_vmp_ca?: number;
  roi_3_vmp_ca?: number;
  roi_4_vmp_ca?: number;
  roi_0_desv_ca?: number;
  roi_1_desv_ca?: number;
  roi_2_desv_ca?: number;
  roi_3_desv_ca?: number;
  roi_4_desv_ca?: number;
  /** Tolerancia de uniformidad seleccionada (%, por defecto 15) */
  tolerancia_pct?: number;
  /** Artefactos observados */
  pixeles_defectuosos?: boolean;
  artefactos?: boolean;
  artefactos_descripcion?: string;
  creado_en?: string;
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}

/** Prueba 2.12 — Resolución espacial alto contraste */
export interface ConvResolucion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvBajoContraste extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
  /** Plantilla usada — por defecto "contraste" (compatibilidad con datos existentes) */
  formato?: "contraste" | "masas";
  /** 8 masas (mm): visible sí/no — plantilla alterna, mismo orden que NIVELES_MASAS */
  masa_1?: boolean;
  masa_2?: boolean;
  masa_3?: boolean;
  masa_4?: boolean;
  masa_5?: boolean;
  masa_6?: boolean;
  masa_7?: boolean;
  masa_8?: boolean;
  concepto?: "Conforme" | "No_conforme";
  creado_en?: string;
}

/** Prueba 2.16 — MTF */
export interface ConvMtf extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvInformeSeccion extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvResultadoPrueba extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
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
export interface ConvEvidencia extends Partial<SyncFields> {
  id?: string;
  visita_id: string;
  /** Código TECDOC de la prueba: "2.1", "2.2", etc. */
  prueba_codigo: string;
  /** Identificador del slot dentro de la prueba: "montaje", "plano", "patron_colimacion" */
  slot: string;
  descripcion?: string;
  /** Blob almacenado en IndexedDB — solo local, no se sincroniza */
  blob_local?: Blob | null;
  /** Path en el bucket (post-sync). `null` fuerza re-subida al reemplazar la imagen. */
  url_storage?: string | null;
  fecha_captura?: string;
  creado_en?: string;
  /** Soft-delete: borrado viaja como cambio (UPSERT) para que el pull lo propague */
  deleted_at?: string;
}
