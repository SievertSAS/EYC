// ============================================================
//  Tipos del dominio — Estudios y Controles
//  Mapeados desde el DBML actualizado
// ============================================================

/** Estado de sincronización para registros offline */
export type SyncStatus = "pending" | "synced" | "conflict" | "error";

/** Campos comunes de sincronización */
export interface SyncFields {
  sync_status: SyncStatus;
  last_modified: string; // ISO timestamp
}

// ─── Tipos de equipo ───
export const TIPOS_EQUIPO = [
  "CONVENCIONAL",
  "CT",
  "CT_DENTAL",
  "MAMOGRAFO",
  "PANORAMICO",
  "PERIAPICAL",
  "PERIAPICAL_PORTATIL",
  "RX_PORTATIL",
  "ARCOENC",
  "FLUOROSCOPIOS",
  "DENSITOMETRO",
  "ANGIOGRAFO",
  "INDUSTRIAL",
  "VETERINARIO",
  "MULTIPROPOSITO",
  "LITOTRIPTOR",
  "VARIOS_RX",
] as const;
export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

// ─── Núcleo ───

export interface Cliente extends Partial<SyncFields> {
  id?: number;
  nombre_cliente: string;
  nombre_prestador?: string;
  nit: string;
  digito_verificacion?: string;
  naturaleza?: "privado" | "publico" | "mixto";
  direccion?: string;
  telefono?: string;
  email?: string;
  nombre_representante_legal?: string;
  creado_en?: string;
}

export interface Contacto extends Partial<SyncFields> {
  id?: number;
  cliente_id: number;
  nombre: string;
  cargo?:
    | "medico_responsable"
    | "tecnologo"
    | "opr"
    | "representante"
    | "responsable_visita"
    | "otro";
  cedula?: string;
  telefono?: string;
  email?: string;
  para_programar: boolean;
  creado_en?: string;
}

export interface Sede extends Partial<SyncFields> {
  id?: number;
  cliente_id: number;
  nombre_sede: string;
  direccion_sede?: string;
  ciudad?: string;
  departamento?: string;
  creado_en?: string;
}

export interface UbicacionRx extends Partial<SyncFields> {
  id?: number;
  sede_id: number;
  nombre_servicio: string;
  licencia?: string;
  fecha_expiracion_licencia?: string;
  codigo_habilitacion?: string;
  horas_x_dia?: number;
  creado_en?: string;
}

export interface Equipo extends Partial<SyncFields> {
  id?: number;
  ubicacion_id: number;
  tipo_equipo?: TipoEquipo;
  planilla_espacial: boolean;
  sistema_adquisicion?: string;
  distancia_foco_paciente?: number;
  bucky?: "Si" | "No" | "No_aplica";
  // Generador
  gen_marca?: string;
  gen_modelo?: string;
  gen_numero_serie?: string;
  gen_fecha_fabricacion?: string;
  gen_fase?: "monofasico" | "trifasico" | "alta_frecuencia";
  gen_energia_fotones_mev?: string;
  // Filtracion
  filtracion_inherente_mmal?: number;
  filtracion_anadida_mmal?: number;
  creado_en?: string;
}

export interface EquipoMovimiento {
  id?: number;
  equipo_id: number;
  ubicacion_anterior_id?: number;
  ubicacion_nueva_id: number;
  fecha_movimiento: string;
  motivo?: string;
  registrado_por_id?: number;
  creado_en?: string;
}

export interface Tubo extends Partial<SyncFields> {
  id?: number;
  equipo_id: number;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  tipo?: string;
  mas_max?: number;
  kv_max?: number;
  ma_max?: number;
  tiempo_s?: number;
  foco_fino_mm?: number;
  foco_grueso_mm?: number;
  creado_en?: string;
}

export interface Colimador extends Partial<SyncFields> {
  id?: number;
  equipo_id: number;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  creado_en?: string;
}

export interface Gantry extends Partial<SyncFields> {
  id?: number;
  equipo_id: number;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  tipo_detector?: string;
  creado_en?: string;
}

export interface SalaDimensiones {
  id?: number;
  ubicacion_id: number;
  ancho_m?: number;
  largo_m?: number;
  alto_m?: number;
  area_m2?: number;
  zona_a_desc?: string;
  zona_b_desc?: string;
  zona_c_desc?: string;
  zona_d_desc?: string;
  plano_url?: string;
  creado_en?: string;
}

export interface ParteEquipo {
  id?: number;
  equipo_id: number;
  parte_nombre: string;
  estado?: "bueno" | "regular" | "malo" | "no_aplica";
  observacion?: string;
  creado_en?: string;
}

export interface ValoresReferencia {
  id?: number;
  equipo_id: number;
  // Kerma / PKL / PKA
  kerma_aire_incidente?: number;
  pkl_panoramico?: number;
  pkl_ct_dental?: number;
  pka_ref?: number;
  // DDI / EI
  ddi_ref?: number;
  ei_ref?: number;
  // MTF
  mtf50_h_ref?: number;
  mtf50_v_ref?: number;
  mtf20_h_ref?: number;
  mtf20_v_ref?: number;
  // CAE
  cae_sensibilidad_ref?: number;
  cae_comp_60kvp?: number;
  cae_comp_70kvp?: number;
  cae_comp_80kvp?: number;
  cae_comp_1mm_cu?: number;
  cae_comp_2mm_cu?: number;
  cae_comp_3mm_cu?: number;
  // Rendimiento
  rendimiento_ref?: number;
  rendimiento_repetibilidad?: number;
  rendimiento_linealidad?: number;
  // Dosis al receptor
  dosis_receptor_extremidad?: number;
  dosis_receptor_torax?: number;
  dosis_receptor_columna?: number;
  dosis_receptor_abdomen?: number;
  // Bajo contraste
  bajo_contraste_ref?: number;
  valor_base_patron?: string;
  // CHR
  chr_min_mmal?: number;
  creado_en?: string;
}

// ─── Usuarios y roles ───

export type RolUsuario = "coordinador" | "programador" | "tecnico" | "comercial";

export const ROLES_DISPONIBLES: RolUsuario[] = [
  "coordinador",
  "programador",
  "tecnico",
  "comercial",
];

export const ROL_LABELS: Record<RolUsuario, string> = {
  coordinador: "Coordinador",
  programador: "Programador",
  tecnico: "Técnico",
  comercial: "Comercial",
};

export const MODULOS_APP = [
  "dashboard",
  "clientes",
  "solicitudes",
  "visitas",
  "revision",
  "equipos",
  "informes",
  "sync",
  "configuracion",
] as const;
export type ModuloApp = (typeof MODULOS_APP)[number];

export const MODULO_LABELS: Record<ModuloApp, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  solicitudes: "Solicitudes",
  visitas: "Visitas",
  revision: "Revisión",
  equipos: "Equipos",
  informes: "Informes",
  sync: "Sincronización",
  configuracion: "Configuración",
};

export interface Usuario {
  id?: number;
  nombre: string;
  cedula: string;
  cargo: RolUsuario;
  email?: string;
  telefono?: string;
  activo: boolean;
  auth_uid?: string;
  creado_en?: string;
}

// ─── Acciones de permiso por módulo ───

export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar";

export const ACCIONES_PERMISO: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

export const ACCION_LABELS: Record<AccionPermiso, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};

export interface AccionesPermiso {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export interface RolPermiso {
  id?: number;
  rol: RolUsuario;
  modulo: ModuloApp;
  /** Permiso de ver el módulo (nombre legacy, equivale a la acción "ver") */
  activo: boolean;
  /** null/undefined = usar el default del rol (permisoDefault) */
  crear?: boolean | null;
  editar?: boolean | null;
  eliminar?: boolean | null;
  modificado_en?: string;
}

const ACCESO_TOTAL: AccionesPermiso = { ver: true, crear: true, editar: true, eliminar: true };
const SOLO_VER: AccionesPermiso = { ver: true, crear: false, editar: false, eliminar: false };
const SIN_ACCESO: AccionesPermiso = { ver: false, crear: false, editar: false, eliminar: false };
const GESTIONAR: AccionesPermiso = { ver: true, crear: true, editar: true, eliminar: false };
const EJECUTAR: AccionesPermiso = { ver: true, crear: false, editar: true, eliminar: false };

/**
 * Matriz de permisos por defecto. Se usa para sembrar `rol_permisos`
 * y como fallback cuando un registro no tiene definida una acción
 * (datos anteriores a la migración de permisos granulares).
 */
const PERMISOS_DEFAULT_MATRIZ: Record<RolUsuario, Partial<Record<ModuloApp, AccionesPermiso>>> = {
  coordinador: {
    dashboard: ACCESO_TOTAL,
    clientes: ACCESO_TOTAL,
    solicitudes: ACCESO_TOTAL,
    visitas: ACCESO_TOTAL,
    revision: ACCESO_TOTAL,
    equipos: ACCESO_TOTAL,
    informes: ACCESO_TOTAL,
    sync: ACCESO_TOTAL,
    configuracion: ACCESO_TOTAL,
  },
  programador: {
    dashboard: SOLO_VER,
    clientes: SOLO_VER,
    solicitudes: GESTIONAR,
    visitas: GESTIONAR,
    revision: SOLO_VER,
    equipos: SOLO_VER,
    informes: SOLO_VER,
    sync: SOLO_VER,
  },
  tecnico: {
    dashboard: SOLO_VER,
    visitas: EJECUTAR,
    revision: SOLO_VER,
    equipos: EJECUTAR,
    informes: SOLO_VER,
    sync: SOLO_VER,
  },
  comercial: {
    dashboard: SOLO_VER,
    clientes: GESTIONAR,
    solicitudes: GESTIONAR,
  },
};

/** Permisos por defecto de un rol sobre un módulo */
export function permisoDefault(rol: RolUsuario, modulo: ModuloApp): AccionesPermiso {
  return PERMISOS_DEFAULT_MATRIZ[rol][modulo] ?? SIN_ACCESO;
}

/**
 * Estado efectivo de las 4 acciones de un registro de permiso:
 * el valor guardado, o el default del rol cuando la acción no está
 * definida (null/undefined, datos previos a permisos granulares).
 * Nota: no aplica la regla "sin ver no hay acciones" — eso lo hace
 * `resolverPermiso`; aquí se exponen los valores crudos para que la
 * UI de configuración pueda editarlos sin perder overrides.
 */
export function accionesEfectivas(
  permiso: RolPermiso | undefined,
  rol: RolUsuario,
  modulo: ModuloApp
): AccionesPermiso {
  const defaults = permisoDefault(rol, modulo);
  return {
    ver: permiso?.activo ?? false,
    crear: permiso?.crear ?? defaults.crear,
    editar: permiso?.editar ?? defaults.editar,
    eliminar: permiso?.eliminar ?? defaults.eliminar,
  };
}

/**
 * Resuelve si un rol puede realizar una acción sobre un módulo.
 * Sin permiso de ver el módulo, ninguna acción está permitida.
 */
export function resolverPermiso(
  permiso: RolPermiso | undefined,
  rol: RolUsuario,
  modulo: ModuloApp,
  accion: AccionPermiso = "ver"
): boolean {
  const efectivas = accionesEfectivas(permiso, rol, modulo);
  if (!efectivas.ver) return false;
  return efectivas[accion];
}

// ─── Comercial ───

export interface Cotizacion {
  id?: number;
  cliente_id: number;
  valor_total?: number;
  forma_pago?: string;
  fecha_cotizacion?: string;
  fecha_aceptacion?: string;
  estado?: "borrador" | "enviada" | "aceptada" | "rechazada";
  creado_en?: string;
}

export interface Solicitud extends Partial<SyncFields> {
  id?: number;
  cotizacion_id?: number;
  cliente_id: number;
  contacto_programar_id?: number;
  ubicacion_id?: number;
  tecnico_asignado_id?: number;
  suitecrm_id?: string;
  tipo_servicio?: string;
  pipeline_estado?: "solicitudes" | "programacion" | "ejecutado" | "notificado" | "enviado";
  forma_pago?: string;
  pago_recibido: boolean;
  fecha_solicitud?: string;
  fecha_estimada_visita?: string;
  fecha_real_visita?: string;
  fecha_entrega?: string;
  creado_en?: string;
}

// ─── Ejecución de visita ───

export type EstadoVisita =
  | "asignada"
  | "en_progreso"
  | "completada"
  | "pre_informe"
  | "en_revision"
  | "aprobada";

export interface VisitaEjecucion extends SyncFields {
  id?: number;
  solicitud_id: number;
  equipo_id?: number;
  /** Instantánea: ubicación del equipo AL MOMENTO de la visita */
  ubicacion_id?: number;
  tecnico_id?: number;
  estado_visita: EstadoVisita;
  ingeniero_revisor_id?: number;
  // Condiciones de operación
  dias_laborados_semana?: number;
  pacientes_por_semana?: number;
  radiografias_por_semana?: number;
  kv_maximo_usado?: number;
  mas_maximo_usado?: number;
  max_disparos_paciente?: number;
  porcentaje_rechazo?: number;
  // Condiciones ambientales
  temperatura_c?: number;
  presion_hpa?: number;
  observaciones?: string;
  /** Observaciones del ingeniero al devolver la visita */
  observaciones_revision?: string;
  /** Timestamp de la última devolución */
  devuelto_en?: string;
  fecha_visita?: string;
  creado_en?: string;
}

// ─── Schemas de pruebas agrupadas ───

/** Definición de una columna en la tabla de mediciones de un grupo */
export interface ColumnaDef {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  unit?: string;
  opciones?: string[];
  required?: boolean;
  placeholder?: string;
  decimal_places?: number;
}

/** Schema de la tabla de mediciones crudas de un grupo */
export interface MedicionSchema {
  columnas: ColumnaDef[];
}

/** Espacio para imagen embebida dentro de un grupo o prueba */
export interface SlotImagen {
  key: string;
  label: string;
  obligatorio: boolean;
  max_imagenes: number;
}

/** Fórmula auto-calculada para una prueba */
export interface FormulaDefinicion {
  campo_resultado: string;
  label: string;
  unit?: string;
  /** Expresión JS evaluable. Variables: row, rows, stats, equipo, valores_ref */
  expresion: string;
  dependencias: string[];
}

/** Criterio de aceptación con límite numérico */
export interface CriterioAceptacion {
  campo: string;
  operador: "lt" | "lte" | "gt" | "gte" | "between" | "eq";
  valor: number | [number, number];
  unidad?: string;
  descripcion: string;
  referencia_normativa: string;
}

/** Textos TECDOC para el informe PDF */
export interface TextosPrueba {
  objetivo: string;
  instrumentacion: string;
  metodologia: string;
  criterio: string;
}

/** Imagen almacenada como Blob dentro de un grupo o prueba */
export interface ImagenEmbebida {
  slot_key: string;
  blob_local?: Blob;
  url_storage?: string;
  descripcion?: string;
  fecha_captura?: string;
}

/** Evaluación individual de un criterio */
export interface EvaluacionCriterio {
  campo: string;
  valor_obtenido: number;
  criterio_descripcion: string;
  cumple: boolean;
}

// ─── Grupos de pruebas ───

/** Un grupo agrupa pruebas que comparten una sesión de medición */
export interface GrupoPrueba {
  id?: number;
  codigo: string;
  nombre: string;
  tipo_equipo: TipoEquipo;
  orden: number;
  schema_mediciones: MedicionSchema;
  slots_imagen: SlotImagen[];
  activo: boolean;
  creado_en?: string;
}

/** Resultado de captura de un grupo (datos crudos + imágenes) */
export interface GrupoResultado extends SyncFields {
  id?: number;
  visita_id: number;
  grupo_id: number;
  equipo_id: number;
  /** Filas de mediciones crudas capturadas en campo */
  mediciones_json: Record<string, unknown>[];
  /** Imágenes embebidas del grupo */
  imagenes: ImagenEmbebida[];
  completado: boolean;
  fecha_ejecucion?: string;
  creado_en?: string;
}

// ─── Pruebas ───

export interface PruebaDefinicion {
  id?: number;
  codigo: string;
  /** Número TECDOC: "2.4", "2.5", etc. */
  numero_tecdoc?: string;
  nombre: string;
  descripcion?: string;
  /** FK a GrupoPrueba — si existe, la prueba pertenece a un grupo */
  grupo_id?: number;
  tipos_equipo_aplicables: TipoEquipo[];
  /** Orden dentro del grupo */
  orden_en_grupo?: number;
  /** Orden legacy para pruebas sin grupo */
  orden_sugerido?: number;
  /** Fórmulas auto-calculadas desde los datos del grupo */
  formulas?: FormulaDefinicion[];
  /** Criterios de aceptación con límites numéricos */
  criterios_aceptacion?: CriterioAceptacion[];
  /** Textos TECDOC para el informe */
  textos_informe?: TextosPrueba;
  /** Espacios para imágenes específicas de esta prueba */
  slots_imagen?: SlotImagen[];
  plantilla_informe?: string;
  activa: boolean;
  creado_en?: string;
}

export interface PruebaResultado extends SyncFields {
  id?: number;
  visita_id: number;
  prueba_definicion_id: number;
  equipo_id: number;
  /** FK a GrupoResultado — si la prueba pertenece a un grupo */
  grupo_resultado_id?: number;
  concepto?: "FAVORABLE" | "NO_FAVORABLE" | "NO_APLICA";
  acciones_correctivas?: string;
  /** JSONB flexible — cada prueba define su propio schema */
  datos_json?: Record<string, unknown>;
  /** Resultados auto-calculados por las fórmulas */
  resultados_calculados?: Record<string, unknown>;
  /** Evaluación detallada de cada criterio */
  evaluacion_criterios?: EvaluacionCriterio[];
  /** Imágenes embebidas específicas de esta prueba */
  imagenes?: ImagenEmbebida[];
  completado: boolean;
  fecha_ejecucion?: string;
  creado_en?: string;
}

export interface MedicionRadiometrica extends SyncFields {
  id?: number;
  visita_id: number;
  punto_numero: number;
  ubicacion_descripcion: string;
  /** Lectura cruda en μSv/h (entrada del físico) */
  tasa_dosis_usv_h?: number;
  /** Lectura convertida a mSv/h (= usv_h / 1000) */
  tasa_dosis_msv_h?: number;
  /** @deprecated usar factor_ocupacion_t */
  factor_ocupacion?: string;
  /** Factor de ocupación T (numérico) */
  factor_ocupacion_t?: number;
  tipo_area?: "controlada" | "supervisada";
  dosis_anual_msv?: number;
  concepto?: "Conforme" | "No_conforme";
  observacion?: string;
  creado_en?: string;
}

export interface EvidenciaFotografica extends SyncFields {
  id?: number;
  visita_id: number;
  prueba_resultado_id?: number;
  tipo?: string;
  descripcion?: string;
  /** Blob almacenado localmente en IndexedDB */
  blob_local?: Blob;
  url_storage?: string;
  fecha_captura?: string;
  creado_en?: string;
}

export interface ElementoProteccion {
  id?: number;
  visita_id: number;
  descripcion: string;
  cantidad?: number;
  concepto?: "Conforme" | "No_conforme";
  observacion?: string;
  creado_en?: string;
}

// ─── Auditoría de cambios ───

export interface ChangeLog {
  id?: number;
  tabla: string;
  registro_id: number;
  campo: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  modificado_por_id: number;
  fecha: string;
}

// ─── Metadatos de sincronización ───

export interface SyncMeta {
  table_name: string;
  last_pulled_at: string;
}

// ─── Informes con versionamiento ───

export type EstadoInforme =
  | "borrador"
  | "pre_informe"
  | "en_revision"
  | "correccion_fisica"
  | "correccion_cliente"
  | "aprobado"
  | "vigente"
  | "vencido";

export interface Informe {
  id?: number;
  visita_id: number;
  equipo_id: number;
  /** Ubicación al momento del estudio — define el contexto equipo+lugar */
  ubicacion_id: number;
  numero_informe: string;
  plantilla?: string;
  titulo?: string;
  version_actual: number;
  concepto_general?: "FAVORABLE" | "NO_FAVORABLE";
  /** Token UUID único para validación vía QR */
  qr_token: string;
  qr_url?: string;
  fecha_emision: string;
  /** fecha_emision + 2 años (Res. 1811) */
  fecha_vencimiento: string;
  estado: EstadoInforme;
  creado_en?: string;
}

export interface InformeVersion {
  id?: number;
  informe_id: number;
  numero_version: number;
  motivo_cambio?: "emision_inicial" | "correccion_fisico" | "correccion_cliente" | "actualizacion";
  descripcion_cambio?: string;
  generado_por_id?: number;
  revisado_por_id?: number;
  pdf_url?: string;
  fecha_generacion: string;
  fecha_revision?: string;
  fecha_aprobacion?: string;
  estado?: "borrador" | "en_revision" | "aprobado" | "reemplazado";
  creado_en?: string;
}
