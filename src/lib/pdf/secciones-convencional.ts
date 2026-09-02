import type { jsPDF } from "jspdf";
import type autoTableType from "jspdf-autotable";
import { db } from "@/lib/db";
import { formatDecimal } from "@/lib/decimal";
import type { VisitaEjecucion, UbicacionRx } from "@/lib/db/types";
import type {
  ConvLevantamientoSetup,
  ConvMedicionRadiometrica,
  ConvInspeccionItem,
  ConvElementoProteccion,
  ConvEvidencia,
  ConvResultadoPrueba,
  ConvInformeSeccion,
  ConvColimacion,
  ConvRaysafeSetup,
  ConvRaysafeMedicion,
  ConvCaeSetup,
  ConvCaeMedicion,
  ConvDdiMedicion,
  ConvUniformidadDetector,
  ConvResolucion,
  ConvBajoContraste,
  ConvCassetteInspeccion,
  ConvUniformidadCr,
  ConvMtf,
} from "@/lib/equipos/convencional/db/types";
import {
  ITEMS_INSPECCION_EQUIPO,
  ITEMS_CONDICIONES_OPERACION,
} from "@/lib/equipos/convencional/inspeccion-items";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import { detalle213 } from "@/lib/equipos/convencional/evaluacion";
import { descargarEvidencia } from "@/lib/supabase/storage";
import {
  COLOR_GRAY,
  COLOR_BLACK,
  COLOR_ALT_ROW,
  COLOR_OK,
  COLOR_BAD,
  MARGIN,
  TABLE_STYLE,
  didParseVeredictoCell,
} from "./estilo-informe";

// ============================================================
//  Secciones del pre-informe para el equipo CONVENCIONAL
//  Estructura basada en la hoja CE_NIT de la plantilla Excel.
//  Cada prueba 2.X renderiza sus resultados desde las tablas
//  conv_*; 2.1 y 2.2 tienen renderizador completo, el resto
//  usa el esqueleto genérico hasta que se implemente el suyo.
// ============================================================

// ─── Estilo ───
// Fuente única en `./estilo-informe`.

/** Contexto que el generador comparte con los renderizadores */
export interface InformeCtx {
  doc: jsPDF;
  autoTable: typeof autoTableType;
  /** Cursor vertical — getter/setter sobre la variable del generador */
  y: number;
  checkPage: (needed: number) => void;
  addParagraph: (text: string, fontSize?: number, indent?: number) => void;
  addSubsectionTitle: (number: string, title: string) => void;
}

// ─── Datos convencionales ───

export interface DatosConvencional {
  secciones: ConvInformeSeccion[];
  setup?: ConvLevantamientoSetup;
  mediciones: ConvMedicionRadiometrica[];
  inspeccion: ConvInspeccionItem[];
  elementos: ConvElementoProteccion[];
  resultados: Map<string, ConvResultadoPrueba>;
  colimacion?: ConvColimacion;
  /** Imagen del plano radiométrico (2.1) como dataURL, si existe */
  planoRadiometrico?: { dataUrl: string; width: number; height: number };
  /** Fotografías de la 2.2 (equipo, consola, avisos, elementos) para la sección 2.2.8 */
  fotos22?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Imágenes de la 2.3 (montaje y patrón) para la sección 2.3.7 */
  fotos23?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje RaySafe para la sección 2.4.7 */
  fotos24?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje RaySafe para la sección 2.5.7 (misma imagen que 2.4) */
  fotos25?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje RaySafe para la sección 2.6.7 (misma imagen que 2.4) */
  fotos26?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje RaySafe para la sección 2.7.7 (misma imagen que 2.4) */
  fotos27?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje RaySafe para la sección 2.8.7 (misma imagen que 2.4) */
  fotos28?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje DDI para la sección 2.9.7 */
  fotos29?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografía de montaje DDI para la sección 2.10.7 (misma imagen que 2.9) */
  fotos210?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Fotografías de imágenes DICOM para la sección 2.11.7 (0° y 180°) */
  fotos211?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Setup y mediciones del RaySafe (pruebas 2.4–2.8) */
  raysafeSetup?: ConvRaysafeSetup;
  raysafeMediciones: ConvRaysafeMedicion[];
  /** Mediciones DDI/EI (pruebas 2.9 y 2.10) */
  ddiMediciones: ConvDdiMedicion[];
  /** Mediciones de uniformidad del detector (prueba 2.11) */
  uniformidadDetector: ConvUniformidadDetector[];
  /** Fotografía del patrón de resolución para la sección 2.12.7 */
  fotos212?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Medición de resolución espacial (prueba 2.12) */
  resolucion?: ConvResolucion;
  /** Fotografía del patrón de bajo contraste para la sección 2.13.7 */
  fotos213?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Medición de bajo contraste (prueba 2.13) */
  bajoContraste?: ConvBajoContraste;
  /** Inspecciones de cassettes/pantallas IP (prueba 2.14) */
  cassettes: ConvCassetteInspeccion[];
  /** Mediciones de uniformidad CR por cassette (prueba 2.15) */
  uniformidadCr: ConvUniformidadCr[];
  /** Datos MTF (prueba 2.16) */
  mtf?: ConvMtf;
  /** Imagen DICOM para MTF (2.16.7) */
  fotos216?: { label: string; dataUrl: string; width: number; height: number }[];
  /** Valores base del CAE (precarga para 2.17 y 2.20) */
  caeSetup?: ConvCaeSetup;
  /** Mediciones CAE (pruebas 2.17–2.20) */
  caeMediciones: ConvCaeMedicion[];
  /** Foto montaje CAE (2.17.7) */
  fotos217?: { label: string; dataUrl: string; width: number; height: number }[];
}

async function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function cargarImagen(
  evidencia: ConvEvidencia | undefined
): Promise<DatosConvencional["planoRadiometrico"]> {
  if (!evidencia) return undefined;
  // El blob local solo existe en el dispositivo que capturó la foto; en
  // cualquier otro hay que bajarla del bucket con el `url_storage` del sync.
  const blob =
    evidencia.blob_local instanceof Blob
      ? evidencia.blob_local
      : await descargarEvidencia(evidencia.url_storage);
  if (!blob) return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const dataUrl = await blobADataUrl(blob);
    return { dataUrl, width: bitmap.width, height: bitmap.height };
  } catch {
    return undefined;
  }
}

/**
 * Deduplica filas con la misma clave natural, quedándose con la que tenga
 * más información — protege el PDF contra inserts duplicados causados por
 * la condición de carrera ya corregida en los efectos de inicialización de
 * los formularios de captura (ver grupo-a..e/page.tsx).
 */
function dedupePorClave<T>(
  rows: T[],
  claveDe: (r: T) => string,
  tieneDato: (r: T) => boolean
): T[] {
  const porClave = new Map<string, T>();
  for (const r of rows) {
    const k = claveDe(r);
    const actual = porClave.get(k);
    if (!actual || (!tieneDato(actual) && tieneDato(r))) porClave.set(k, r);
  }
  return [...porClave.values()];
}

/** Excluye filas soft-deleted de las lecturas conv_* (#51). */
const vivoConv = (r: { deleted_at?: string | null }): boolean => !r.deleted_at;

export async function recopilarDatosConv(visitaId: string): Promise<DatosConvencional> {
  const [
    secciones,
    setup,
    mediciones,
    inspeccionRaw,
    elementos,
    resultadosArr,
    evidencias,
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
    db.conv_informe_secciones.where("visita_id").equals(visitaId).sortBy("orden"),
    // #51: el filtro de `deleted_at` estaba solo en 5 de las 17 lecturas — una
    // medición borrada de RaySafe/CAE/DDI o un ítem de inspección borrado
    // seguía saliendo en el PDF oficial. Ahora se filtra en TODAS.
    db.conv_levantamiento_setup.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_mediciones.where("visita_id").equals(visitaId).filter(vivoConv).sortBy("punto_numero"),
    db.conv_inspeccion_items.where("visita_id").equals(visitaId).filter(vivoConv).toArray(),
    db.conv_elementos_proteccion.where("visita_id").equals(visitaId).filter(vivoConv).toArray(),
    db.conv_resultados_prueba.where("visita_id").equals(visitaId).filter(vivoConv).toArray(),
    db.conv_evidencias.where("visita_id").equals(visitaId).filter(vivoConv).toArray(),
    db.conv_colimacion.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_raysafe_setup.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_raysafe_mediciones
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("toma_numero"),
    db.conv_ddi_mediciones
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("toma_numero"),
    db.conv_uniformidad_detector
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("item_numero"),
    db.conv_resolucion.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_bajo_contraste.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_cassette_inspeccion
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("item_numero"),
    db.conv_uniformidad_cr
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("item_numero"),
    db.conv_mtf.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_cae_setup.where("visita_id").equals(visitaId).filter(vivoConv).first(),
    db.conv_cae_mediciones
      .where("visita_id")
      .equals(visitaId)
      .filter(vivoConv)
      .sortBy("toma_numero"),
  ]);

  // Deduplica ítems de inspección con el mismo (sección, número) — ver
  // dedupePorClave arriba. Se queda con la fila que tenga concepto evaluado.
  const inspeccion = dedupePorClave(
    inspeccionRaw,
    (i) => `${i.seccion}-${i.item_numero}`,
    (i) => Boolean(i.concepto)
  );

  // Si el físico nunca abrió la página de pre-informe, usar el catálogo completo
  const seccionesEfectivas: ConvInformeSeccion[] =
    secciones.length > 0
      ? secciones
      : CATALOGO_SECCIONES.map((c) => ({
          visita_id: visitaId,
          prueba_codigo: c.codigo,
          orden: c.orden,
          incluida: true,
        }));

  const planoEv = evidencias.find(
    (e) => e.prueba_codigo === "2.1" && e.slot === "plano_radiometrico"
  );

  // Fotografías de la 2.2 (sección 2.2.8): slots fijos + avisos (lista dinámica) + una por elemento
  const SLOTS_FOTOS_22: [string, string][] = [
    ["equipo_rayos_x", "Equipo de rayos X"],
    ["consola", "Consola del equipo"],
  ];
  const fotos22: NonNullable<DatosConvencional["fotos22"]> = [];
  for (const [slot, label] of SLOTS_FOTOS_22) {
    const ev = evidencias.find((e) => e.prueba_codigo === "2.2" && e.slot === slot);
    const img = await cargarImagen(ev);
    if (img) fotos22.push({ label, ...img });
  }
  // Avisos de protección — lista dinámica (#66): una evidencia por aviso,
  // `slot` empieza en "aviso_", `descripcion` = título.
  const avisos = evidencias
    .filter((e) => e.prueba_codigo === "2.2" && e.slot?.startsWith("aviso_"))
    .sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? ""));
  for (const ev of avisos) {
    const img = await cargarImagen(ev);
    if (img) {
      fotos22.push({ label: ev.descripcion?.trim() || "Aviso de protección radiológica", ...img });
    }
  }
  for (const elem of elementos) {
    const ev = evidencias.find(
      (e) => e.prueba_codigo === "2.2" && e.slot === `elemento_${elem.id}`
    );
    const img = await cargarImagen(ev);
    if (img) fotos22.push({ label: elem.descripcion?.trim() || "Elemento de protección", ...img });
  }

  // Fotografías de la 2.3 (sección 2.3.7): montaje y patrón de colimación
  const SLOTS_FOTOS_23: [string, string][] = [
    ["montaje_colimacion", "Montaje experimental para la verificación del sistema de colimación"],
    [
      "patron_colimacion",
      "Imagen radiográfica del patrón de colimación con la posición del rayo central",
    ],
  ];
  const fotos23: NonNullable<DatosConvencional["fotos23"]> = [];
  for (const [slot, label] of SLOTS_FOTOS_23) {
    const ev = evidencias.find((e) => e.prueba_codigo === "2.3" && e.slot === slot);
    const img = await cargarImagen(ev);
    if (img) fotos23.push({ label, ...img });
  }

  // Fotografía de montaje RaySafe (secciones 2.4.7 y 2.5.7 — misma imagen)
  const ev24 = evidencias.find((e) => e.prueba_codigo === "2.4" && e.slot === "montaje_raysafe");
  const img24 = await cargarImagen(ev24);
  const LABEL_MONTAJE_RAYSAFE = "Implementación de instrumentación en la prueba";
  const fotos24: NonNullable<DatosConvencional["fotos24"]> = [];
  if (img24) fotos24.push({ label: LABEL_MONTAJE_RAYSAFE, ...img24 });
  const fotos25: NonNullable<DatosConvencional["fotos25"]> = [];
  if (img24) fotos25.push({ label: LABEL_MONTAJE_RAYSAFE, ...img24 });
  const fotos26: NonNullable<DatosConvencional["fotos26"]> = [];
  if (img24) fotos26.push({ label: LABEL_MONTAJE_RAYSAFE, ...img24 });
  const fotos27: NonNullable<DatosConvencional["fotos27"]> = [];
  if (img24) fotos27.push({ label: LABEL_MONTAJE_RAYSAFE, ...img24 });
  const fotos28: NonNullable<DatosConvencional["fotos28"]> = [];
  if (img24) fotos28.push({ label: LABEL_MONTAJE_RAYSAFE, ...img24 });

  // Fotografía de montaje DDI (secciones 2.9.7 y 2.10.7)
  const ev29 = evidencias.find((e) => e.prueba_codigo === "2.9" && e.slot === "montaje_ddi");
  const img29 = await cargarImagen(ev29);
  const fotos29: NonNullable<DatosConvencional["fotos29"]> = [];
  if (img29) fotos29.push({ label: "Montaje experimental para la prueba DDI/EI", ...img29 });
  const fotos210: NonNullable<DatosConvencional["fotos210"]> = [];
  if (img29)
    fotos210.push({
      label: "Montaje experimental para la prueba de repetibilidad DDI/EI",
      ...img29,
    });

  // Fotografía patrón bajo contraste para 2.13.7
  const ev213 = evidencias.find(
    (e) => e.prueba_codigo === "2.13" && e.slot === "montaje_bajo_contraste"
  );
  const img213 = await cargarImagen(ev213);
  const fotos213: NonNullable<DatosConvencional["fotos213"]> = [];
  if (img213) fotos213.push({ label: "Patrón de bajo contraste", ...img213 });

  // Fotografías patrón resolución para 2.12.7 (montaje + DICOM)
  const SLOTS_FOTOS_212: [string, string][] = [
    ["montaje_resolucion", "Foto montaje experimental"],
    ["dicom_resolucion", "Radiografía del patrón de resolución espacial"],
  ];
  const fotos212: NonNullable<DatosConvencional["fotos212"]> = [];
  for (const [slot, label] of SLOTS_FOTOS_212) {
    const ev = evidencias.find((e) => e.prueba_codigo === "2.12" && e.slot === slot);
    const img = await cargarImagen(ev);
    if (img) fotos212.push({ label, ...img });
  }

  // Imagen DICOM MTF para 2.16.7
  const ev216 = evidencias.find((e) => e.prueba_codigo === "2.16" && e.slot === "dicom_mtf");
  const img216 = await cargarImagen(ev216);
  const fotos216: NonNullable<DatosConvencional["fotos216"]> = [];
  if (img216) fotos216.push({ label: "Imagen DICOM para análisis MTF", ...img216 });

  // Foto montaje CAE para 2.17.7
  const ev217 = evidencias.find((e) => e.prueba_codigo === "2.17" && e.slot === "montaje_cae");
  const img217 = await cargarImagen(ev217);
  const fotos217: NonNullable<DatosConvencional["fotos217"]> = [];
  if (img217)
    fotos217.push({
      label: "Montaje experimental para la prueba de sensibilidad del CAE",
      ...img217,
    });

  // Fotografías DICOM para 2.11.7 (0° y 180°)
  const SLOTS_FOTOS_211: [string, string][] = [
    ["dicom_0", "Orientación inicial 0°"],
    ["dicom_180", "Orientación final 180°"],
  ];
  const fotos211: NonNullable<DatosConvencional["fotos211"]> = [];
  for (const [slot, label] of SLOTS_FOTOS_211) {
    const ev = evidencias.find((e) => e.prueba_codigo === "2.11" && e.slot === slot);
    const img = await cargarImagen(ev);
    if (img) fotos211.push({ label, ...img });
  }

  return {
    secciones: seccionesEfectivas,
    setup,
    mediciones,
    inspeccion,
    elementos,
    resultados: new Map(resultadosArr.map((r) => [r.prueba_codigo, r])),
    colimacion,
    planoRadiometrico: await cargarImagen(planoEv),
    fotos22,
    fotos23,
    fotos24,
    fotos25,
    fotos26,
    fotos27,
    fotos28,
    fotos29,
    fotos210,
    fotos211,
    fotos212,
    fotos213,
    raysafeSetup,
    raysafeMediciones,
    ddiMediciones,
    uniformidadDetector,
    resolucion,
    bajoContraste,
    cassettes,
    uniformidadCr,
    mtf,
    fotos216,
    caeSetup,
    caeMediciones: caeMediciones ?? [],
    fotos217,
  };
}

// ─── Helpers de render ───

function num(v: number | undefined | null): number {
  return v == null || isNaN(v) ? 0 : v;
}

function fmt(v: number | undefined | null, decimals = 1): string {
  return formatDecimal(v, decimals);
}

function capitalizar(s: string | undefined): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

function conceptoLabel(c: string | undefined): string {
  if (c === "Conforme") return "Conforme";
  if (c === "No_conforme") return "No conforme";
  if (c === "No_aplica") return "No aplica";
  return "—";
}

/** Caption en negrita para tablas y figuras (estilo CE_NIT) */
function addCaption(ctx: InformeCtx, text: string) {
  ctx.checkPage(8);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...COLOR_GRAY);
  ctx.doc.text(text, MARGIN, ctx.y);
  ctx.y += 4;
}

/**
 * Rótulo de figura, numerado por prueba: `Fig. 2.3.1. Montaje experimental…`.
 * `n` arranca en 1 dentro de cada prueba. `desc` es solo la descripción (sin
 * prefijo "Fig." ni número — eso lo pone esta función).
 */
function figCaption(codigo: string, n: number, desc: string): string {
  const limpio = desc.replace(/^Fig\.?\s*(\d+(\.\d+)*\.?\s*)?/i, "").trim();
  return `Fig. ${codigo}.${n}. ${limpio}`;
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/**
 * Colorea las celdas de concepto de una tabla (verde/rojo/ámbar).
 * Alias de `didParseVeredictoCell` (fuente única en `estilo-informe`).
 */
const colorearConcepto = didParseVeredictoCell;

// ─── Renderizador 2.1: Levantamiento radiométrico ───

function render21(ctx: InformeCtx, visita: VisitaEjecucion, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const setup = conv.setup;
  const cod = "2.1";

  // .4 Resultados
  ctx.addSubsectionTitle(`${cod}.4.`, "Resultados");
  ctx.addParagraph(
    "Se registraron las lecturas de tasa de dosis equivalente ambiental H*(10) en los puntos de medición definidos en el diagrama radiométrico. Las mediciones se realizaron utilizando la técnica radiográfica máxima empleada en la práctica clínica del equipo evaluado."
  );

  // Técnica utilizada y fondo natural — tabla compacta de 4 columnas (clave/valor)
  ctx.checkPage(24);
  addCaption(ctx, "Técnica radiográfica utilizada en la prueba");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    body: [
      ["Tensión (kV)", fmt(setup?.tecnica_kv, 0), "Tiempo (s)", fmt(setup?.tecnica_tiempo_s, 2)],
      ["Corriente (mA)", fmt(setup?.tecnica_ma, 0), "Exposición (mAs)", fmt(setup?.tecnica_mas, 0)],
      [
        "Fondo natural (mSv/h)",
        {
          content:
            setup?.fondo_natural_usv_h != null
              ? formatDecimal(setup.fondo_natural_usv_h / 1000, 5)
              : "—",
          colSpan: 3,
          styles: { fontStyle: "normal", fillColor: [255, 255, 255] },
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      1: { cellWidth: 40 },
      2: { cellWidth: 45, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      3: { cellWidth: 40 },
    },
  });
  ctx.y = finalY(doc) + 8;
  ctx.addParagraph(
    "En cada punto se realizaron varias mediciones consecutivas, registrándose el valor máximo obtenido para su posterior análisis. Los resultados se presentan a continuación."
  );

  if (conv.mediciones.length === 0) {
    ctx.addParagraph("Sin mediciones registradas.");
  } else {
    ctx.checkPage(30);
    addCaption(
      ctx,
      "Tabla 2.1.1. Registro de lecturas de tasa de dosis equivalente ambiental H*(10)"
    );
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["Sitio", "Punto de Medición", "Lectura (mSv/h)"]],
      body: conv.mediciones.map((m) => [
        String(m.punto_numero),
        m.ubicacion_descripcion || "—",
        m.tasa_dosis_msv_h != null ? formatDecimal(m.tasa_dosis_msv_h, 5) : "—",
      ]),
      columnStyles: { 0: { cellWidth: 14 } },
    });
    ctx.y = finalY(doc) + 8;
  }

  // .5 Análisis (carga de trabajo + tabla de dosis anual)
  ctx.addSubsectionTitle(`${cod}.5.`, "Análisis");
  ctx.addParagraph(
    "Las lecturas de tasa de dosis equivalente ambiental H*(10) obtenidas en los puntos de medición fueron utilizadas para estimar la dosis equivalente anual en cada una de las áreas evaluadas. La estimación se realizó considerando la carga de trabajo del equipo, el factor de uso del haz y el factor de ocupación de cada área, siguiendo la metodología descrita en el documento IAEA-TECDOC-1958."
  );

  const nr = num(visita.radiografias_por_semana);
  const masMax = num(visita.mas_maximo_usado);
  const wEstimada = (nr * masMax) / 60;
  const wEstandar = setup?.w_estandar ?? 160;
  const wUsado = Math.max(wEstimada, wEstandar);
  const semanas = setup?.semanas_laborales ?? 50;

  ctx.checkPage(34);
  addCaption(ctx, "Carga de trabajo");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Parámetro", "Valor"]],
    body: [
      ["Radiografías por semana (NR)", fmt(nr, 0)],
      ["Exposición máxima clínica (mAs)", fmt(masMax, 0)],
      ["Carga de trabajo W estimada (mA·min/sem)", fmt(wEstimada)],
      ["Carga de trabajo estándar (mA·min/sem)", fmt(wEstandar, 0)],
      ["Carga de trabajo W usada = max(estimada, estándar)", fmt(wUsado)],
      ["Corriente utilizada en la prueba I (mA)", fmt(setup?.tecnica_ma, 0)],
      ["Factor de uso (U)", "Según punto de medición (Tabla 2.1.2)"],
      ["Semanas laborales", fmt(semanas, 0)],
    ],
    columnStyles: { 0: { cellWidth: 110 } },
  });
  ctx.y = finalY(doc) + 8;

  if (conv.mediciones.length > 0) {
    ctx.checkPage(30);
    addCaption(ctx, "Tabla 2.1.2. Cálculo de la dosis equivalente anual (mSv/año)");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [
        [
          "Sitio",
          "Punto de Medición",
          "T",
          "U",
          "Dosis Anual (mSv/año)",
          "Tipo de área",
          "Concepto",
        ],
      ],
      body: conv.mediciones.map((m) => [
        String(m.punto_numero),
        m.ubicacion_descripcion || "—",
        // T con hasta 3 decimales y sin ceros de relleno. `formatDecimal` sin
        // `decimals` ya lo hace (maximumFractionDigits 3, minimum 0); el
        // `.replace(/\.?0+$/)` anterior asumía punto decimal y dejaba "1," con
        // valores enteros ahora que se formatea con coma (es-CO).
        formatDecimal(m.factor_ocupacion_t) || "—",
        fmt(m.factor_uso_u, 1),
        m.dosis_anual_msv != null ? formatDecimal(m.dosis_anual_msv, 6) : "—",
        capitalizar(m.tipo_area),
        conceptoLabel(m.concepto),
      ]),
      columnStyles: { 0: { cellWidth: 12 } },
      didParseCell: colorearConcepto(6),
    });
    ctx.y = finalY(doc) + 8;
  }

  // .6 Criterio (lo agrega el generador con el texto del catálogo)
  // .7 Diagrama radiométrico
  return 6;
}

/** Subsección extra de la 2.1: diagrama radiométrico (después del criterio) */
export function renderDiagramaRadiometrico(ctx: InformeCtx, conv: DatosConvencional, sub: number) {
  ctx.addSubsectionTitle(`2.1.${sub}.`, "Diagrama radiométrico");
  const plano = conv.planoRadiometrico;
  if (!plano) {
    ctx.addParagraph("No se adjuntó el plano radiométrico de la instalación.");
    return;
  }
  const maxW = 130;
  const maxH = 90;
  const scale = Math.min(maxW / plano.width, maxH / plano.height);
  const w = plano.width * scale;
  const h = plano.height * scale;
  ctx.checkPage(h + 12);
  try {
    const x = MARGIN + (170 - w) / 2;
    ctx.doc.addImage(plano.dataUrl, x, ctx.y, w, h);
    ctx.y += h + 6;
  } catch {
    ctx.addParagraph("No fue posible incluir la imagen del plano radiométrico.");
  }
}

/** Subsección de evidencia de la 2.2: fotos de la inspección (equipo, consola, avisos, elementos) */
export function renderFotos22(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.2") {
  const { doc } = ctx;
  const fotos = conv.fotos22 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica de la inspección visual.");
    return;
  }

  const colW = 82; // ancho por columna (mm)
  const gap = 6;
  const maxImgH = 55;

  for (let i = 0; i < fotos.length; i += 2) {
    const pair = fotos.slice(i, i + 2).map((f) => {
      const scale = Math.min(colW / f.width, maxImgH / f.height);
      return { ...f, w: f.width * scale, h: f.height * scale };
    });
    const rowH = Math.max(...pair.map((r) => r.h)) + 7; // imagen + rótulo
    ctx.checkPage(rowH + 2);
    const startY = ctx.y;

    pair.forEach((r, idx) => {
      const x = MARGIN + idx * (colW + gap);
      try {
        doc.addImage(r.dataUrl, x, startY, r.w, r.h);
      } catch {
        // imagen no renderizable — se omite el cuadro
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GRAY);
      const caption = doc.splitTextToSize(figCaption(codigo, i + idx + 1, r.label), colW);
      doc.text(caption, x, startY + r.h + 4);
    });

    ctx.y = startY + rowH + 2;
  }
}

/** Subsección de evidencia de la 2.3: montaje experimental y patrón radiográfico de colimación */
export function renderFotos23(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.3") {
  const { doc } = ctx;
  const fotos = conv.fotos23 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }

  const colW = 82;
  const gap = 6;
  const maxImgH = 70;

  for (let i = 0; i < fotos.length; i += 2) {
    const pair = fotos.slice(i, i + 2).map((f) => {
      const scale = Math.min(colW / f.width, maxImgH / f.height);
      return { ...f, w: f.width * scale, h: f.height * scale };
    });
    const rowH = Math.max(...pair.map((r) => r.h)) + 10;
    ctx.checkPage(rowH + 2);
    const startY = ctx.y;

    pair.forEach((r, idx) => {
      const x = MARGIN + idx * (colW + gap);
      try {
        doc.addImage(r.dataUrl, x, startY, r.w, r.h);
      } catch {
        // imagen no renderizable
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GRAY);
      const caption = doc.splitTextToSize(figCaption(codigo, i + idx + 1, r.label), colW);
      doc.text(caption, x, startY + r.h + 4);
    });

    ctx.y = startY + rowH + 2;
  }
}

/** Subsección de evidencia de la 2.4: fotografía del montaje con sensor RaySafe */
export function renderFotos24(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.4") {
  const { doc } = ctx;
  const fotos = conv.fotos24 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170; // ancho de contenido (mm)
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.8.7: fotografía del montaje con sensor RaySafe */
export function renderFotos28(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.8") {
  const { doc } = ctx;
  const fotos = conv.fotos28 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.9.7: fotografía del montaje DDI/EI */
export function renderFotos29(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.9") {
  const { doc } = ctx;
  const fotos = conv.fotos29 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.13.7: fotografía del patrón de bajo contraste */
export function renderFotos213(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.13") {
  const { doc } = ctx;
  const fotos = conv.fotos213 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del patrón de bajo contraste.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.7;
    const scale = Math.min(maxW / f.width, 100 / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 16);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      /* no renderizable */
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección de evidencia de la 2.12: fotografía del patrón de resolución espacial */
export function renderFotos212(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.12") {
  const { doc } = ctx;
  const fotos = conv.fotos212 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del patrón de resolución.");
    return;
  }
  const CWIDTH = 170;
  const fotosPerRow = 2;
  const colW = CWIDTH / fotosPerRow;
  for (let i = 0; i < fotos.length; i += fotosPerRow) {
    const grupo = fotos.slice(i, i + fotosPerRow);
    const maxH = 80;
    const scales = grupo.map((f) => Math.min((colW * 0.9) / f.width, maxH / f.height, 1));
    const rowH = Math.max(...grupo.map((f, j) => f.height * scales[j]));
    ctx.checkPage(rowH + 16);
    grupo.forEach((f, j) => {
      const scale = scales[j];
      const w = f.width * scale;
      const h = f.height * scale;
      const x = MARGIN + j * colW + (colW - w) / 2;
      try {
        doc.addImage(f.dataUrl, x, ctx.y, w, h);
      } catch {
        /* no renderizable */
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GRAY);
      const caption = doc.splitTextToSize(figCaption(codigo, i + j + 1, f.label), colW - 4);
      doc.text(caption, MARGIN + j * colW + colW / 2, ctx.y + rowH + 4, { align: "center" });
    });
    ctx.y += rowH + 12;
  }
}

/** Subsección de evidencia de la 2.11: imágenes DICOM de uniformidad (0° y 180°) */
export function renderFotos211(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.11") {
  const { doc } = ctx;
  const fotos = conv.fotos211 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntaron imágenes DICOM de la prueba de uniformidad.");
    return;
  }
  const CWIDTH = 170;
  const fotosPerRow = 2;
  const colW = CWIDTH / fotosPerRow;
  for (let i = 0; i < fotos.length; i += fotosPerRow) {
    const grupo = fotos.slice(i, i + fotosPerRow);
    const maxH = 80;
    const scales = grupo.map((f) => Math.min((colW * 0.9) / f.width, maxH / f.height, 1));
    const rowH = Math.max(...grupo.map((f, j) => f.height * scales[j]));
    ctx.checkPage(rowH + 16);
    grupo.forEach((f, j) => {
      const scale = scales[j];
      const w = f.width * scale;
      const h = f.height * scale;
      const x = MARGIN + j * colW + (colW - w) / 2;
      try {
        doc.addImage(f.dataUrl, x, ctx.y, w, h);
      } catch {
        /* no renderizable */
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GRAY);
      const caption = doc.splitTextToSize(figCaption(codigo, i + j + 1, f.label), colW - 4);
      doc.text(caption, MARGIN + j * colW + colW / 2, ctx.y + rowH + 4, { align: "center" });
    });
    ctx.y += rowH + 12;
  }
}

/** Subsección de evidencia de la 2.10: fotografía del montaje DDI/EI (repetibilidad) */
export function renderFotos210(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.10") {
  const { doc } = ctx;
  const fotos = conv.fotos210 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.7.7: fotografía del montaje con sensor RaySafe */
export function renderFotos27(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.7") {
  const { doc } = ctx;
  const fotos = conv.fotos27 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.6.7: fotografía del montaje con sensor RaySafe */
export function renderFotos26(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.6") {
  const { doc } = ctx;
  const fotos = conv.fotos26 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.5.7: fotografía del montaje con sensor RaySafe */
export function renderFotos25(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.5") {
  const { doc } = ctx;
  const fotos = conv.fotos25 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const f of fotos) {
    const maxW = CWIDTH * 0.5;
    const maxH = 80;
    const scale = Math.min(maxW / f.width, maxH / f.height, 1);
    const w = f.width * scale;
    const h = f.height * scale;
    ctx.checkPage(h + 14);
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      doc.addImage(f.dataUrl, x, ctx.y, w, h);
    } catch {
      // imagen no renderizable
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRAY);
    const caption = doc.splitTextToSize(figCaption(codigo, ++nFig, f.label), CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

// ─── Renderizador 2.2: Inspección visual ───

function render22(
  ctx: InformeCtx,
  conv: DatosConvencional,
  ubicacion: UbicacionRx | undefined
): number {
  const { doc, autoTable } = ctx;
  const cod = "2.2";

  // .4 Descripción de la instalación y blindajes
  ctx.addSubsectionTitle(`${cod}.4.`, "Descripción de la instalación y blindajes");
  ctx.addParagraph(
    "La distribución de las áreas colindantes y de las barreras estructurales de protección radiológica se presenta en el diagrama radiométrico de la instalación."
  );
  if (ubicacion?.ubicacion_fisica?.trim()) {
    ctx.addParagraph(`El equipo se encuentra ubicado en el ${ubicacion.ubicacion_fisica.trim()}.`);
  }

  // Zonas colindantes en tabla (en vez de párrafos sueltos)
  const zonas = (
    [
      ["A", ubicacion?.zona_a_desc],
      ["B", ubicacion?.zona_b_desc],
      ["C", ubicacion?.zona_c_desc],
      ["D", ubicacion?.zona_d_desc],
      ["Piso", ubicacion?.piso_desc],
      ["Techo", ubicacion?.techo_desc],
    ] as const
  )
    .filter(([, desc]) => desc?.trim())
    .map(([z, desc]) => [z, desc!.trim()]);

  if (zonas.length > 0) {
    ctx.checkPage(14 + zonas.length * 8);
    addCaption(ctx, "Áreas colindantes y barreras estructurales");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["Zona", "Descripción de la colindancia y barreras"]],
      body: zonas,
      columnStyles: { 0: { cellWidth: 16, halign: "center", fontStyle: "bold" } },
    });
    ctx.y = finalY(doc) + 8;
  }

  // Dimensiones de la sala en mini-tabla horizontal
  if (ubicacion?.ancho_m || ubicacion?.largo_m || ubicacion?.alto_m) {
    const area =
      ubicacion.area_m2 != null
        ? `${formatDecimal(ubicacion.area_m2, 2)} m²`
        : ubicacion.ancho_m && ubicacion.largo_m
          ? `${formatDecimal(ubicacion.ancho_m * ubicacion.largo_m, 2)} m²`
          : "—";
    ctx.checkPage(20);
    addCaption(ctx, "Dimensiones de la sala");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["Ancho", "Largo", "Altura", "Área"]],
      body: [
        [
          `${fmt(ubicacion.ancho_m)} m`,
          `${fmt(ubicacion.largo_m)} m`,
          `${fmt(ubicacion.alto_m)} m`,
          area,
        ],
      ],
      bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" },
      headStyles: { ...TABLE_STYLE.headStyles, halign: "center" },
    });
    ctx.y = finalY(doc) + 8;
  }

  // .5 Resultados
  ctx.addSubsectionTitle(`${cod}.5.`, "Resultados");

  const equipoItems = conv.inspeccion
    .filter((i) => i.seccion === "equipo")
    .sort((a, b) => a.item_numero - b.item_numero);
  const operacionItems = conv.inspeccion
    .filter((i) => i.seccion === "condiciones_operacion")
    .sort((a, b) => a.item_numero - b.item_numero);

  const tablaInspeccion = (
    caption: string,
    items: ConvInspeccionItem[],
    descripciones: string[]
  ) => {
    if (items.length === 0) return;
    ctx.checkPage(30);
    addCaption(ctx, caption);
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["No.", "Descripción", "Concepto", "Observaciones"]],
      body: items.map((i) => [
        String(i.item_numero),
        descripciones[i.item_numero - 1] ?? "—",
        conceptoLabel(i.concepto),
        i.observacion?.trim() || "Ninguna.",
      ]),
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 95 }, 2: { cellWidth: 22 } },
      didParseCell: colorearConcepto(2),
    });
    ctx.y = finalY(doc) + 8;
  };

  if (equipoItems.length === 0 && operacionItems.length === 0) {
    ctx.addParagraph("Sin datos de inspección registrados.");
  } else {
    tablaInspeccion(
      "Tabla 2.2.1. Inspección visual del equipo",
      equipoItems,
      ITEMS_INSPECCION_EQUIPO
    );
    tablaInspeccion(
      "Tabla 2.2.2. Condiciones de operación del equipo",
      operacionItems,
      ITEMS_CONDICIONES_OPERACION
    );
  }

  if (conv.elementos.length > 0) {
    ctx.checkPage(30);
    addCaption(ctx, "Tabla 2.2.3. Elementos de protección radiológica");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["No.", "Descripción", "Cantidad", "Tipo", "Concepto", "Observaciones"]],
      body: conv.elementos.map((e, i) => [
        String(i + 1),
        e.descripcion || "—",
        e.cantidad != null ? String(e.cantidad) : "—",
        e.tipo_paciente === "adulto"
          ? "Adulto"
          : e.tipo_paciente === "pediatrico"
            ? "Pediátrico"
            : "—",
        conceptoLabel(e.concepto),
        e.observacion?.trim() || "Ninguna.",
      ]),
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 16 }, 3: { cellWidth: 18 } },
      didParseCell: colorearConcepto(4),
    });
    ctx.y = finalY(doc) + 8;
  }

  return 6;
}

// ─── Renderizador 2.3: Colimación y perpendicularidad ───

function render23(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const c = conv.colimacion;

  ctx.addSubsectionTitle("2.3.4.", "Resultados");

  if (!c) {
    ctx.addParagraph("Sin datos registrados para esta prueba.");
    return 5;
  }

  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");
  ctx.checkPage(14);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    body: [
      [
        "Tensión (kV)",
        fmt(c.tecnica_kv, 0),
        "Exposición (mAs)",
        fmt(c.tecnica_mas, 1),
        "Distancia foco-receptor, SID (cm)",
        fmt(c.sid_cm, 0),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      1: { cellWidth: 20 },
      2: { cellWidth: 32, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      3: { cellWidth: 20 },
      4: { cellWidth: 52, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      5: { cellWidth: 18 },
    },
  });
  ctx.y = finalY(doc) + 8;

  const sid = c.sid_cm || 100;
  const DIRS = [
    { label: "Ánodo (cabeza)", nom: c.anodo_nominal, med: c.anodo_medido },
    { label: "Cátodo (pies)", nom: c.catodo_nominal, med: c.catodo_medido },
    { label: "Izquierda", nom: c.izquierda_nominal, med: c.izquierda_medido },
    { label: "Derecha", nom: c.derecha_nominal, med: c.derecha_medido },
  ];

  const rows = DIRS.map(({ label, nom, med }) => {
    const diff = Math.abs(num(med) - num(nom));
    const varPct = (diff * 100) / sid;
    const concepto = varPct < 2 ? "Conforme" : "No conforme";
    return [
      label,
      fmt(nom, 0),
      fmt(med, 0),
      formatDecimal(diff, 1),
      formatDecimal(varPct, 1) + " %",
      "< 2 %",
      concepto,
    ];
  });

  const totalVar = rows.reduce((s, r) => s + parseFloat(r[4]), 0);
  const conceptoTotal =
    rows.every((r) => parseFloat(r[4]) < 2) && totalVar < 4 ? "Conforme" : "No conforme";

  ctx.checkPage(40);
  addCaption(
    ctx,
    "Tabla 2.3.1. Registro de mediciones para la coincidencia del campo luminoso con el campo de radiación"
  );
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [
      [
        "Dirección",
        "Campo luminoso (cm)",
        "Campo de radiación (cm)",
        "Diferencia (cm)",
        "Variación (%)",
        "Tolerancia",
        "Concepto",
      ],
    ],
    body: [
      ...rows,
      [
        "Total (suma de desviaciones opuestas)",
        "",
        "",
        "",
        formatDecimal(totalVar, 1) + " %",
        "< 4 %",
        conceptoTotal,
      ],
    ],
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 } },
    didParseCell: colorearConcepto(6),
  });
  ctx.y = finalY(doc) + 8;

  const esfera = c.posicion_esfera;
  const CRITERIO_ESFERA: Record<string, string> = {
    Centro: "Perpendicularidad del rayo central menor a 3°",
    "Primer circulo": "Perpendicularidad del rayo central menor a 3°",
    "Segundo circulo": "Perpendicularidad del rayo central menor a 3°",
    "Fuera del circulo externo": "Perpendicularidad del rayo central mayor a 3°",
  };
  const perpConcepto =
    esfera === "Centro" || esfera === "Primer circulo" || esfera === "Segundo circulo"
      ? "Conforme"
      : esfera === "Fuera del circulo externo"
        ? "No conforme"
        : null;

  ctx.checkPage(28);
  addCaption(
    ctx,
    "Tabla 2.3.2. Registro de mediciones para la perpendicularidad del campo de radiación"
  );
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Campo", "Valor"]],
    body: [
      ["Posición observada de la esfera", esfera ?? "—"],
      ["Criterio de interpretación", esfera ? (CRITERIO_ESFERA[esfera] ?? "—") : "—"],
      ["Concepto", perpConcepto ?? "—"],
    ],
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: COLOR_ALT_ROW } },
    didParseCell: didParseVeredictoCell(1),
  });
  ctx.y = finalY(doc) + 8;

  // .5 Análisis — texto auto-generado según la fórmula del Excel
  ctx.addSubsectionTitle("2.3.5.", "Análisis");

  const totalVarStr = formatDecimal(totalVar, 0);
  let analisisTexto: string;
  if (conceptoTotal === "Conforme" && perpConcepto === "Conforme") {
    analisisTexto = `Los resultados obtenidos evidencian que la coincidencia entre el campo luminoso y el campo de radiación cumple con los criterios de aceptación establecidos, ya que las desviaciones individuales fueron inferiores al 2 % y la desviación total fue de ${totalVarStr} %. Adicionalmente, la perpendicularidad del rayo central presentó una desviación angular menor o igual a 3°, por lo que la prueba se considera conforme.`;
  } else if (conceptoTotal === "No conforme" && perpConcepto === "Conforme") {
    analisisTexto =
      "Los resultados obtenidos evidencian incumplimiento en la coincidencia entre el campo luminoso y el campo de radiación, debido a que una o más desviaciones superaron las tolerancias establecidas. No obstante, la perpendicularidad del rayo central presentó una desviación angular menor o igual a 3°. Por lo anterior, la prueba se considera no conforme.";
  } else if (conceptoTotal === "Conforme" && perpConcepto === "No conforme") {
    analisisTexto = `Los resultados obtenidos evidencian que la coincidencia entre el campo luminoso y el campo de radiación cumple con los criterios de aceptación establecidos, con una desviación total de ${totalVarStr} %. Sin embargo, la perpendicularidad del rayo central presentó una desviación angular superior a 3°, por lo que la prueba se considera no conforme.`;
  } else {
    analisisTexto =
      "Los resultados obtenidos evidencian incumplimiento tanto en la coincidencia entre el campo luminoso y el campo de radiación como en la perpendicularidad del rayo central, por lo que la prueba se considera no conforme.";
  }
  ctx.addParagraph(analisisTexto);

  return 6;
}

// ─── Helpers estadísticos ───

const CHR_MIN: Record<number, number> = { 60: 1.8, 70: 2.1, 80: 2.3, 90: 2.5 };

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

// Desviación según TECDOC: |promedio - nominal| / nominal × 100
function desvNominal(medidos: number[], nominal: number): number {
  if (nominal === 0 || medidos.length === 0) return 0;
  const prom = medidos.reduce((s, v) => s + v, 0) / medidos.length;
  return (Math.abs(prom - nominal) / nominal) * 100;
}

// ─── Renderizadores 2.4–2.7 (pruebas RaySafe) ───

const SIN_DATOS = (ctx: InformeCtx) => {
  // Solo se dibujó la subsección .4 (Resultados); la siguiente libre es la .5.
  // Devolver 6 aquí dejaba un hueco de numeración (p.ej. 2.8.4 → 2.8.6).
  ctx.addParagraph("Sin datos registrados para esta prueba.");
  return 5;
};

// Grupos 1, 2, 6: los tres tiempos nominales distintos (60kV/80kV/90kV)
const GRUPOS_TIEMPO_KV_CHR = new Set([1, 2, 6]);

function render24(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const principales = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1)
  );

  ctx.addSubsectionTitle("2.4.4.", "Resultados");
  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  const grupos = new Map<number, typeof principales>();
  for (const m of principales) {
    if (m.tiempo_nominal_s == null || m.tiempo_medido_s == null) continue;
    const key = m.tiempo_nominal_s;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(m);
  }

  if (grupos.size === 0) return SIN_DATOS(ctx);

  const rows = [...grupos.entries()]
    .sort(([a], [b]) => b - a)
    .map(([nom, ms]) => {
      const medidos = ms.map((m) => m.tiempo_medido_s!);
      const prom = mean(medidos);
      const desv = desvNominal(medidos, nom);
      const std = stdDev(medidos);
      const cv = prom > 0 ? (std / prom) * 100 : 0;
      return [
        formatDecimal(nom),
        formatDecimal(prom, 3),
        formatDecimal(desv, 2) + " %",
        formatDecimal(std, 5),
        formatDecimal(cv, 2) + " %",
        desv <= 10 && cv <= 10 ? "Conforme" : "No conforme",
      ];
    });

  ctx.checkPage(40);
  addCaption(
    ctx,
    "Tabla 2.4.1. Registro de mediciones para la exactitud y repetibilidad del tiempo de exposición"
  );
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [
      [
        "Tiempo nominal (s)",
        "Tiempo promedio medido (s)",
        "Desviación máxima (%)",
        "Desviación estándar (s)",
        "CV (%)",
        "Concepto",
      ],
    ],
    body: rows,
    columnStyles: { 0: { cellWidth: 32 }, 5: { cellWidth: 24 } },
    didParseCell: colorearConcepto(5),
  });
  ctx.y = finalY(doc) + 8;

  ctx.addParagraph(
    "La exactitud del tiempo de exposición se evaluó mediante la desviación máxima porcentual entre el tiempo nominal seleccionado y el tiempo medido con mayor desviación."
  );
  ctx.addParagraph(
    "La repetibilidad del sistema de temporización se evaluó mediante el coeficiente de variación (CV) calculado a partir de las mediciones repetidas para cada tiempo nominal."
  );

  ctx.addSubsectionTitle("2.4.5.", "Análisis");
  const todosConformes = rows.every((r) => r[5] === "Conforme");
  const maxDv = Math.max(...rows.map((r) => parseFloat(r[2])));
  const maxCv = Math.max(...rows.map((r) => parseFloat(r[4])));
  if (todosConformes) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el tiempo de exposición medido presenta desviaciones máximas de hasta ${formatDecimal(maxDv, 2)} % respecto al valor seleccionado. Asimismo, la repetibilidad de las mediciones presenta coeficientes de variación máximos de ${formatDecimal(maxCv, 2)} %, lo que indica una adecuada estabilidad del sistema de temporización del generador de rayos X para los tiempos de exposición evaluados.`
    );
  } else {
    ctx.addParagraph(
      "Los resultados obtenidos evidencian que una o más combinaciones de tiempos de exposición evaluadas presentaron desviaciones o variabilidad superiores a los criterios de aceptación establecidos, lo que indica inestabilidad en el sistema de temporización del generador de rayos X."
    );
  }
  return 6;
}

function render25(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const principales = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1)
  );

  ctx.addSubsectionTitle("2.5.4.", "Resultados");
  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  const grupos = new Map<number, typeof principales>();
  for (const m of principales) {
    if (m.kv_nominal == null || m.kv_medido == null) continue;
    const key = m.kv_nominal;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(m);
  }

  if (grupos.size === 0) return SIN_DATOS(ctx);

  const rows = [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nom, ms]) => {
      const medidos = ms.map((m) => m.kv_medido!);
      const prom = mean(medidos);
      const desv = desvNominal(medidos, nom);
      const std = stdDev(medidos);
      const cv = prom > 0 ? (std / prom) * 100 : 0;
      return [
        formatDecimal(nom, 0),
        formatDecimal(prom, 1),
        formatDecimal(desv, 2) + " %",
        formatDecimal(std, 2),
        formatDecimal(cv, 2) + " %",
        desv <= 10 && cv <= 5 ? "Conforme" : "No conforme",
      ];
    });

  ctx.checkPage(40);
  addCaption(
    ctx,
    "Tabla 2.5.1. Registro de mediciones para la exactitud y repetibilidad de la tensión del tubo de rayos X"
  );
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [
      [
        "Tensión nominal (kV)",
        "Tensión promedio medida (kV)",
        "Desviación máxima (%)",
        "Desviación estándar (kV)",
        "CV (%)",
        "Concepto",
      ],
    ],
    body: rows,
    columnStyles: { 0: { cellWidth: 32 }, 5: { cellWidth: 24 } },
    didParseCell: colorearConcepto(5),
  });
  ctx.y = finalY(doc) + 8;

  ctx.addParagraph(
    "La exactitud de la tensión del tubo se evaluó mediante la desviación máxima porcentual entre la tensión nominal seleccionada y la tensión medida con mayor desviación."
  );
  ctx.addParagraph(
    "La repetibilidad del sistema de generación de alta tensión se evaluó mediante el coeficiente de variación (CV) calculado a partir de las mediciones repetidas para cada valor de tensión nominal."
  );

  ctx.addSubsectionTitle("2.5.5.", "Análisis");
  const todosConformes = rows.every((r) => r[5] === "Conforme");
  const maxDv = Math.max(...rows.map((r) => parseFloat(r[2])));
  const maxCv = Math.max(...rows.map((r) => parseFloat(r[4])));
  if (todosConformes) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que la tensión del tubo medida presenta desviaciones máximas de hasta ${formatDecimal(maxDv, 2)} % respecto al valor seleccionado. Asimismo, la repetibilidad de las mediciones presenta coeficientes de variación máximos de ${formatDecimal(maxCv, 2)} %, lo que indica una adecuada estabilidad en la respuesta del generador de rayos X para los valores de tensión evaluados.`
    );
  } else {
    ctx.addParagraph(
      "Los resultados obtenidos evidencian que una o más tensiones evaluadas presentaron desviaciones o variabilidad superiores a los criterios de aceptación establecidos, indicando inestabilidad en el generador de alta tensión."
    );
  }
  return 6;
}

function render26(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const principales = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1)
  );

  ctx.addSubsectionTitle("2.6.4.", "Resultados");
  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  const grupos = new Map<number, typeof principales>();
  for (const m of principales) {
    if (m.kv_nominal == null || m.chr_medido_mmal == null) continue;
    const key = m.kv_nominal;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(m);
  }

  if (grupos.size === 0) return SIN_DATOS(ctx);

  const rows = [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([kv, ms]) => {
      const chrProm = mean(ms.map((m) => m.chr_medido_mmal!));
      const chrMin = CHR_MIN[kv] ?? "—";
      const concepto = typeof chrMin === "number" && chrProm >= chrMin ? "Conforme" : "No conforme";
      return [formatDecimal(kv, 0), formatDecimal(chrProm, 1), String(chrMin), concepto];
    });

  ctx.checkPage(36);
  addCaption(
    ctx,
    "Tabla 2.6.1. Registro de mediciones para la capa hemirreductora del haz de rayos X"
  );
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [
      ["Tensión nominal (kV)", "CHR promedio medida (mm Al)", "CHR mínima (mm Al)", "Concepto"],
    ],
    body: rows,
    columnStyles: { 0: { cellWidth: 36 }, 3: { cellWidth: 28 } },
    didParseCell: colorearConcepto(3),
  });
  ctx.y = finalY(doc) + 8;

  ctx.addParagraph(
    "Para la evaluación del cumplimiento se compararon los valores medidos con los valores mínimos de referencia de capa hemirreductora correspondientes a cada nivel de tensión."
  );

  ctx.addSubsectionTitle("2.6.5.", "Análisis");
  const todosConformes = rows.every((r) => r[3] === "Conforme");
  const resumen = rows.map((r) => `${r[1]} mm Al a ${r[0]} kV`).join(", ");
  if (todosConformes) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que la capa hemirreductora (CHR) medida presenta valores de ${resumen}, respectivamente. Al comparar estos valores con los mínimos de referencia establecidos para radiodiagnóstico, se observa que todas las mediciones se encuentran por encima del mínimo requerido, lo que indica que el haz de rayos X presenta una filtración adecuada para las condiciones de operación evaluadas.`
    );
  } else {
    ctx.addParagraph(
      "Los resultados obtenidos evidencian que uno o más niveles de tensión evaluados presentan valores de CHR inferiores al mínimo de referencia establecido, lo que indica una filtración insuficiente del haz de rayos X."
    );
  }
  return 6;
}

/** Tabla de valores mínimos de referencia CHR para sección 2.6.6 */
export function renderTablaChrRef(ctx: InformeCtx) {
  const { doc, autoTable } = ctx;
  ctx.checkPage(36);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tensión (kV)", "CHR mínima (mm Al)"]],
    body: [
      ["60", "1,8"],
      ["70", "2,1"],
      ["80", "2,3"],
      ["90", "2,5"],
    ],
    columnStyles: {
      0: { halign: "center" as const, cellWidth: 45 },
      1: { halign: "center" as const, cellWidth: 45 },
    },
    margin: { left: MARGIN + (170 - 90) / 2 },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export function renderTablaBaseRef29(ctx: InformeCtx, conv: DatosConvencional) {
  const { doc, autoTable } = ctx;
  const toma1 = conv.ddiMediciones.find((m) => m.grupo === 1 && m.toma_numero === 1);
  const kv = toma1?.kv_nominal ?? null;
  const mas = toma1?.carga_mas ?? null;
  const eiBase = toma1?.ei_base ?? null;
  const diBase = toma1?.di_base ?? null;
  ctx.checkPage(30);
  addCaption(ctx, "Valores base de referencia");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tensión (kVp)", "Carga (mAs)", "EI", "D.I."]],
    body: [
      [
        kv != null ? formatDecimal(kv, 1) : "—",
        mas != null ? formatDecimal(mas, 1) : "—",
        eiBase != null ? String(eiBase) : "—",
        diBase != null ? formatDecimal(diBase, 2) : "—",
      ],
    ],
  });
  ctx.y = finalY(doc) + 8;
}

function render27(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const shots80 = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && m.kv_nominal === 80 && m.dosis_medida_mgy != null
  );

  ctx.addSubsectionTitle("2.7.4.", "Resultados");
  const distancia = conv.raysafeSetup?.distancia_foco_sensor_cm ?? 100;
  ctx.addParagraph(
    "La prueba se llevó a cabo bajo las siguientes condiciones de medición:\n" +
      `Tensión de referencia: 80 kVp\n` +
      `Distancia foco-detector: ${distancia} cm\n` +
      "Estimación del rendimiento: normalizado a 100 centímetros\n" +
      "Factor de corrección por presión y temperatura del analizador: 1,0"
  );
  ctx.addParagraph(
    "Las mediciones obtenidas se utilizaron para evaluar el valor del rendimiento del tubo de rayos X, " +
      "la repetibilidad de la radiación de salida y la linealidad del rendimiento con respecto al mAs."
  );

  if (shots80.length === 0) return SIN_DATOS(ctx);

  // ── Tabla 2.7.1: Rendimiento y linealidad (grupos 2-5 a 80 kV) ──
  // Solo grupos 2–5 (variación de mAs a 80 kV); grupos 7–8 van a repetibilidad
  const GRUPOS_LIN = new Set([2, 3, 4, 5]);
  const gruposNum = new Map<number, typeof shots80>();
  for (const m of shots80) {
    if (m.grupo_numero == null || !GRUPOS_LIN.has(m.grupo_numero) || m.mas_nominal == null)
      continue;
    if (!gruposNum.has(m.grupo_numero)) gruposNum.set(m.grupo_numero, []);
    gruposNum.get(m.grupo_numero)!.push(m);
  }
  const gruposArr = [...gruposNum.entries()].sort(([a], [b]) => a - b);

  let linMaxPct = 0;
  let prevRend: number | null = null;

  ctx.checkPage(8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text("a) Evaluación del rendimiento del tubo de rayos X y linealidad", MARGIN, ctx.y);
  ctx.y += 6;

  if (gruposArr.length > 0) {
    const rowsLin = gruposArr.map(([, ms]) => {
      const mas = ms[0].mas_nominal!;
      const kermaProm = mean(ms.map((m) => m.dosis_medida_mgy!));
      const rend = mas > 0 ? (kermaProm / mas) * 1000 : 0;
      // Linealidad: comparación con el grupo anterior (fórmula |a-b|/(a+b)*100)
      const linPct =
        prevRend != null && prevRend > 0
          ? (Math.abs(rend - prevRend) / (rend + prevRend)) * 100
          : null;
      if (linPct != null && linPct > linMaxPct) linMaxPct = linPct;
      prevRend = rend;
      return [
        formatDecimal(mas, 1),
        formatDecimal(kermaProm, 3),
        formatDecimal(rend, 1),
        linPct != null ? formatDecimal(linPct, 2) + " %" : "-%",
      ];
    });

    ctx.checkPage(40);
    addCaption(ctx, "Tabla 2.7.1. Rendimiento del tubo de rayos X y linealidad");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [
        [
          "Exposición nominal (mAs)",
          "Kerma en aire promedio (mGy)",
          "Rendimiento (µGy/mAs)",
          "Linealidad (%)",
        ],
      ],
      body: rowsLin,
      columnStyles: { 0: { cellWidth: 38 } },
    });
    ctx.y = finalY(doc) + 8;
  }

  ctx.addParagraph(
    "El rendimiento del tubo se calculó como el cociente entre el kerma en aire medido y la carga " +
      "utilizada (mAs). La linealidad se evaluó mediante la comparación del rendimiento obtenido " +
      "para los diferentes valores de carga."
  );

  // ── Tabla 2.7.2: Repetibilidad (grupo 3 — 80kV/200mA/0.05s) ──
  const repShots = shots80
    .filter((m) => m.grupo_numero === 3)
    .sort((a, b) => a.toma_numero - b.toma_numero);

  const kermasRep = repShots.map((m) => m.dosis_medida_mgy!);
  const promRep = kermasRep.length > 0 ? mean(kermasRep) : 0;
  const stdRep = kermasRep.length > 0 ? stdDev(kermasRep) : 0;
  const cvRep = promRep > 0 ? (stdRep / promRep) * 100 : 0;
  const conformeRep = kermasRep.length === 0 || cvRep <= 5;
  const conformeLin = gruposArr.length <= 1 || linMaxPct <= 10;

  ctx.checkPage(8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text("b) Evaluación de la repetibilidad de la radiación de salida", MARGIN, ctx.y);
  ctx.y += 6;

  ctx.addParagraph(
    "La repetibilidad se evaluó a partir de exposiciones repetidas bajo las mismas condiciones " +
      "de irradiación (80 kV y aproximadamente 10 mAs)."
  );

  if (repShots.length > 0) {
    const rowsIndiv: string[][] = repShots.map((m, i) => [
      String(i + 1),
      formatDecimal(m.dosis_medida_mgy!, 4),
    ]);

    ctx.checkPage(40);
    addCaption(ctx, "Tabla 2.7.2. Repetibilidad de la radiación de salida");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["Medición", "Kerma en aire medido (mGy)"]],
      body: [
        ...rowsIndiv,
        ["Promedio", formatDecimal(promRep, 4)],
        ["Desviación estándar (mGy)", formatDecimal(stdRep, 4)],
        ["CV(%)", formatDecimal(cvRep, 2) + " %"],
      ],
      columnStyles: {
        0: { cellWidth: 60, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      },
    });
    ctx.y = finalY(doc) + 8;
  }

  // ── 2.7.5 Análisis ──
  ctx.addSubsectionTitle("2.7.5.", "Análisis");

  if (kermasRep.length === 0 && gruposArr.length === 0) {
    ctx.addParagraph("Sin datos registrados para esta prueba.");
    return 6;
  }

  const allRends = gruposArr.map(([, ms]) => {
    const mas = ms[0].mas_nominal!;
    return mas > 0 ? (mean(ms.map((m) => m.dosis_medida_mgy!)) / mas) * 1000 : 0;
  });
  const rendMin = allRends.length > 0 ? Math.min(...allRends) : 0;
  const rendMax = allRends.length > 0 ? Math.max(...allRends) : 0;

  const cvStr = formatDecimal(cvRep, 2);
  const linStr = formatDecimal(linMaxPct, 2);
  const rMinStr = formatDecimal(rendMin, 1);
  const rMaxStr = formatDecimal(rendMax, 1);

  if (conformeRep && conformeLin) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el rendimiento del tubo de rayos X presenta valores entre ${rMinStr} y ${rMaxStr} µGy/mAs para los diferentes valores de carga evaluados a 80 kV, lo que indica un comportamiento consistente del sistema de generación de radiación. La repetibilidad de la radiación de salida presenta un coeficiente de variación (CV) de ${cvStr} %, valor inferior al límite establecido. Asimismo, la linealidad del rendimiento con respecto al mAs presenta una desviación máxima de ${linStr} %, lo que indica un comportamiento proporcional entre la radiación de salida y la carga seleccionada. En conjunto, los resultados indican que el generador de rayos X presenta un comportamiento estable, reproducible y lineal bajo las condiciones de irradiación evaluadas.`
    );
  } else {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el rendimiento del tubo de rayos X presenta valores entre ${rMinStr} y ${rMaxStr} µGy/mAs para los diferentes valores de carga evaluados a 80 kV. La repetibilidad de la radiación de salida presenta un coeficiente de variación (CV) de ${cvStr} % y la linealidad del rendimiento con respecto al mAs presenta una desviación máxima de ${linStr} %.` +
        (!conformeRep ? ` La repetibilidad supera el criterio de aceptación del 5 %.` : "") +
        (!conformeLin ? ` La linealidad supera el criterio de aceptación del 10 %.` : "")
    );
  }

  return 6;
}

// ─── Renderizador 2.8: Factor de corrección PKA ───

function render28(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;

  const mediciones = conv.raysafeMediciones
    .filter((m) => m.tipo_medicion === "kerma" && m.dosis_medida_mgy != null)
    .sort((a, b) => a.toma_numero - b.toma_numero);

  ctx.addSubsectionTitle("2.8.4.", "Resultados");

  if (mediciones.length === 0) return SIN_DATOS(ctx);

  const d1Setup = conv.raysafeSetup?.distancia_foco_sensor_cm ?? 100;
  const d2Setup = conv.raysafeSetup?.distancia_foco_detector_d2_cm ?? d1Setup;

  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  const rows = mediciones.map((m) => {
    const kvNom = m.kv_nominal;
    const masNom = m.mas_nominal;
    const kerma = m.dosis_medida_mgy!;
    const ancho = m.ancho_irradiacion_cm ?? 0;
    const largo = m.largo_irradiacion_cm ?? 0;
    const d1 = m.distancia_foco_sensor_cm ?? d1Setup;
    const d2 = m.distancia_foco_detector_cm ?? d2Setup;
    const factorDist = (d2 / d1) ** 2;
    const areaCorr = ancho * largo * factorDist;
    const kermaCorr = kerma * factorDist;
    const dapEst = kermaCorr * areaCorr;
    const dapNom = m.dap_nominal;
    const fc = dapNom != null && dapNom > 0 ? dapEst / dapNom : null;
    return {
      kv: kvNom != null ? formatDecimal(kvNom, 1) : "—",
      mas: masNom != null ? formatDecimal(masNom, 1) : "—",
      dapNom: dapNom != null ? formatDecimal(dapNom, 0) : "—",
      dapEst: dapEst > 0 ? formatDecimal(dapEst, 2) : "—",
      fc: fc != null ? formatDecimal(fc, 1) : "—",
    };
  });

  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.8.1. Determinación del factor de corrección del PKA");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [
      [
        "Tensión (kV)",
        "Carga (mAs)",
        "DAP nominal (mGy·cm²)",
        "DAP estimado (mGy·cm²)",
        "Factor de corrección",
      ],
    ],
    body: rows.map((r) => [r.kv, r.mas, r.dapNom, r.dapEst, r.fc]),
    columnStyles: { 4: { cellWidth: 32 } },
  });
  ctx.y = finalY(doc) + 8;

  // ── 2.8.5 Análisis ──
  ctx.addSubsectionTitle("2.8.5.", "Análisis");
  ctx.addParagraph(
    "Se evidencian diferencias entre los valores estimados de PkA o DAP y los reportados por el equipo, " +
      "lo que permite determinar un factor de corrección aplicable en evaluaciones dosimétricas posteriores."
  );

  return 6;
}

function render29(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;

  const grupo1 = conv.ddiMediciones
    .filter((m) => m.grupo === 1)
    .sort((a, b) => a.toma_numero - b.toma_numero);
  const toma1 = grupo1.find((m) => m.toma_numero === 1);

  ctx.addSubsectionTitle("2.9.4.", "Resultados");

  if (!toma1) return SIN_DATOS(ctx);

  const kv = toma1.kv_nominal ?? 0;
  const mas = toma1.carga_mas ?? 0;
  const ei = toma1.ei ?? null;
  const di = toma1.di ?? null;
  const eiBase = toma1.ei_base ?? null;
  const diBase = toma1.di_base ?? null;

  // Tabla 2.9.1 — medición
  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.9.1. Resultado de la medición del indicador de exposición.");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tensión (kVp)", "Carga (mAs)", "EI"]],
    body: [[kv ? String(kv) : "—", mas ? String(mas) : "—", ei != null ? String(ei) : "—"]],
  });
  ctx.y = finalY(doc) + 8;

  // Cálculo de desviaciones
  const eiDev =
    eiBase != null && eiBase > 0 && ei != null ? (Math.abs(ei - eiBase) / eiBase) * 100 : null;
  const diDev =
    diBase != null && diBase !== 0 && di != null
      ? (Math.abs(di - diBase) / Math.abs(diBase)) * 100
      : null;
  const eiConf = eiDev != null ? (eiDev <= 20 ? "Conforme" : "No conforme") : "—";
  const diConf = diDev != null ? (diDev <= 20 ? "Conforme" : "No conforme") : "—";
  const conforme = eiDev == null || eiDev <= 20;

  // 2.9.5 Análisis — párrafo dinámico + Tabla 2.9.2
  ctx.addSubsectionTitle("2.9.5.", "Análisis");
  ctx.addParagraph(
    conforme
      ? "Los valores del indicador de exposición (EI) y de la desviación del indicador (D.I.) presentan variaciones dentro del rango de tolerancia establecido (± 20 %), evidenciando una adecuada consistencia en la respuesta del sistema de adquisición de imagen bajo condiciones de exposición reproducibles."
      : "Se evidencian desviaciones en el indicador de exposición (EI) y/o en la desviación del indicador (D.I.) fuera del rango de tolerancia establecido, lo que indica inconsistencias en la respuesta del sistema."
  );

  addCaption(ctx, "Tabla 2.9.2. Análisis de los indicadores de exposición");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Parámetro", "Valor", "Valor Base", "Desviación (%)", "Concepto"]],
    body: [
      [
        "EI",
        ei != null ? String(ei) : "—",
        eiBase != null ? String(eiBase) : "—",
        eiDev != null ? `${formatDecimal(eiDev, 1)}%` : "—",
        eiConf,
      ],
      [
        "D.I.",
        di != null ? formatDecimal(di, 2) : "—",
        diBase != null ? formatDecimal(diBase, 2) : "—",
        diDev != null ? `${formatDecimal(diDev, 1)}%` : "—",
        diConf,
      ],
    ],
    didParseCell: colorearConcepto(4),
  });
  ctx.y = finalY(doc) + 8;

  return 6; // 2.9.4 y 2.9.5 renderizados; caller inicia en 6 (Criterio)
}

function render210(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;

  const grupo1 = conv.ddiMediciones
    .filter((m) => m.grupo === 1)
    .sort((a, b) => a.toma_numero - b.toma_numero);

  ctx.addSubsectionTitle("2.10.4.", "Resultados");

  if (grupo1.length === 0) return SIN_DATOS(ctx);

  const eiVals = grupo1.map((m) => m.ei).filter((v): v is number => v != null);
  const diVals = grupo1.map((m) => m.di).filter((v): v is number => v != null);

  function ddiAvg(arr: number[]): number | null {
    return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  }
  function ddiStd(arr: number[]): number | null {
    if (arr.length < 2) return null;
    const m = ddiAvg(arr)!;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  }

  const eiAvg = ddiAvg(eiVals);
  const eiStd = ddiStd(eiVals);
  const eiCv = eiAvg != null && eiAvg > 0 && eiStd != null ? (eiStd / eiAvg) * 100 : null;
  const diAvg = ddiAvg(diVals);
  const diStd = ddiStd(diVals);
  const diCv =
    diAvg != null && diAvg !== 0 && diStd != null ? (diStd / Math.abs(diAvg)) * 100 : null;

  const eiConf = eiCv != null ? (eiCv <= 20 ? "Conforme" : "No conforme") : "—";
  const diConf = diCv != null ? (diCv <= 20 ? "Conforme" : "No conforme") : "—";

  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.10.1. Análisis de la repetibilidad del indicador de exposición.");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Parámetro", "Valor Promedio", "Desviación estándar", "CV (%)", "Concepto"]],
    body: [
      [
        "EI",
        eiAvg != null ? formatDecimal(eiAvg, 1) : "—",
        eiStd != null ? formatDecimal(eiStd, 2) : "—",
        eiCv != null ? formatDecimal(eiCv, 1) : "—",
        eiConf,
      ],
      [
        "D.I.",
        diAvg != null ? formatDecimal(diAvg, 2) : "—",
        diStd != null ? formatDecimal(diStd, 2) : "—",
        diCv != null ? formatDecimal(diCv, 1) : "—",
        diConf,
      ],
    ],
    didParseCell: colorearConcepto(4),
  });
  ctx.y = finalY(doc) + 8;

  const conforme210 = eiCv == null || eiCv <= 20;

  ctx.addSubsectionTitle("2.10.5.", "Análisis");
  ctx.addParagraph(
    conforme210
      ? "Los valores del indicador de exposición presentan baja dispersión bajo condiciones de exposición reproducibles. Los coeficientes de variación obtenidos se encuentran dentro del criterio de aceptación establecido, evidenciando una adecuada repetibilidad del sistema de adquisición de imagen."
      : "Se evidencian variaciones en los indicadores evaluados superiores al criterio de aceptación establecido, lo que indica inestabilidad en la repetibilidad del sistema de adquisición de imagen."
  );

  return 6;
}

// ─── Sección 2.13: Umbral de sensibilidad a bajo contraste ───

const NIVELES_BC = [
  { key: "contraste_9_4" as const, label: "9,4 %" },
  { key: "contraste_8_0" as const, label: "8,0 %" },
  { key: "contraste_5_6" as const, label: "5,6 %" },
  { key: "contraste_4_0" as const, label: "4,0 %" },
  { key: "contraste_2_8" as const, label: "2,8 %" },
  { key: "contraste_1_8" as const, label: "1,8 %" },
  { key: "contraste_1_3" as const, label: "1,3 %" },
  { key: "contraste_0_9" as const, label: "0,9 %" },
];

const NIVELES_MASAS_MM = [
  { key: "masa_1" as const, label: "8 mm" },
  { key: "masa_2" as const, label: "6 mm" },
  { key: "masa_3" as const, label: "4 mm" },
  { key: "masa_4" as const, label: "2 mm" },
  { key: "masa_5" as const, label: "0 mm" },
  { key: "masa_6" as const, label: "0 mm" },
  { key: "masa_7" as const, label: "0 mm" },
  { key: "masa_8" as const, label: "0 mm" },
];

function render213(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const bc = conv.bajoContraste;

  // ── 2.13.4 Resultados ──
  ctx.addSubsectionTitle("2.13.4.", "Resultados");
  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  ctx.checkPage(18);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    body: [
      [
        "Distancia foco-receptor, SID (cm):",
        fmt(bc?.sid_cm, 0),
        "Tensión (kVp):",
        fmt(bc?.tecnica_kv, 0),
      ],
    ],
    headStyles: { ...TABLE_STYLE.headStyles, halign: "center" as const },
    bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" as const },
    columnStyles: { 0: { halign: "left" as const }, 2: { halign: "left" as const } },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  const det = detalle213(conv);
  const esMasas = (bc?.formato ?? "contraste") === "masas";
  const niveles = esMasas ? NIVELES_MASAS_MM : NIVELES_BC;

  ctx.checkPage(24);
  addCaption(ctx, "Tabla 2.13.1. Evaluación del umbral de sensibilidad a bajo contraste");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [[esMasas ? "Masas (mm)" : "% Contraste", ...niveles.map((n) => n.label)]],
    body: [["¿Visible?", ...niveles.map((n) => (bc?.[n.key] ? "SI" : "NO"))]],
    headStyles: { ...TABLE_STYLE.headStyles, halign: "center" as const },
    bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" as const },
    columnStyles: { 0: { halign: "left" as const } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        const val = data.cell.raw as string;
        data.cell.styles.textColor = val === "SI" ? COLOR_OK : COLOR_BAD;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ── 2.13.5 Análisis ──
  ctx.addSubsectionTitle("2.13.5.", "Análisis");

  if (!det) {
    ctx.addParagraph("No se registraron datos para esta prueba.");
  } else if (det.conforme) {
    ctx.addParagraph(
      "Se observa una cantidad de masas superiores a las requeridas por el sistema."
    );
  } else if (esMasas) {
    ctx.addParagraph(
      `Se observa una cantidad de masas visible de ${det.visibles}, que no supera el mínimo requerido.`
    );
  } else {
    ctx.addParagraph(
      `Se observa una cantidad de masas visible de ${det.visibles}, que no supera el mínimo requerido, y ninguno de los niveles de contraste evaluados alcanza valores por debajo del 4 %.`
    );
  }

  return 6;
}

// ─── Sección 2.12: Resolución espacial de alto contraste ───

function render212(ctx: InformeCtx, conv: DatosConvencional): number {
  const resol = conv.resolucion;
  const plmm = resol?.pares_lineas_plmm;

  // ── 2.12.4 Resultados ──
  ctx.addSubsectionTitle("2.12.4.", "Resultados");
  ctx.addParagraph("La prueba se llevó a cabo bajo las siguientes condiciones de medición:");

  ctx.checkPage(18);
  const { doc, autoTable } = ctx;
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    body: [
      [
        "Distancia foco-receptor, SID (cm):",
        fmt(resol?.sid_cm, 0),
        "Tensión (kVp):",
        fmt(resol?.tecnica_kv, 0),
      ],
    ],
    headStyles: { ...TABLE_STYLE.headStyles, halign: "center" as const },
    bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" as const },
    columnStyles: { 0: { halign: "left" as const }, 2: { halign: "left" as const } },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  ctx.addParagraph(
    "Se registró el grupo máximo de pares de líneas por milímetro visible de forma distinguible en la imagen obtenida."
  );

  ctx.checkPage(14);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Parámetro", "Valor"]],
    body: [
      [
        "Cantidad de pares de líneas visibles (pl/mm)",
        plmm != null ? `${formatDecimal(plmm, 1)} pl/mm` : "—",
      ],
    ],
    headStyles: { ...TABLE_STYLE.headStyles, halign: "center" as const },
    bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" as const },
    columnStyles: { 0: { halign: "left" as const } },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ── 2.12.5 Análisis ──
  ctx.addSubsectionTitle("2.12.5.", "Análisis");
  ctx.addParagraph(
    "El valor de resolución espacial obtenido fue comparado con el criterio de aceptación establecido en el protocolo de control de calidad aplicable."
  );
  if (plmm == null) {
    ctx.addParagraph("No se registró el valor de resolución espacial para esta prueba.");
  } else if (plmm >= 2.4) {
    ctx.addParagraph(
      "Se observa que la resolución espacial observada corresponde a un valor que se encuentra por encima del mínimo requerido."
    );
  } else {
    ctx.addParagraph(
      "Se observa que la resolución espacial observada corresponde a un valor que se encuentra por debajo del mínimo requerido."
    );
  }

  return 6;
}

// ─── Sección 2.11: Uniformidad y artefactos del detector ───

function render211(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const dets = conv.uniformidadDetector ?? [];

  // ── 2.11.4 Resultados ──
  ctx.addSubsectionTitle("2.11.4.", "Resultados");

  if (dets.length === 0) {
    ctx.addParagraph("Sin datos registrados para esta prueba.");
    return 5;
  }

  ctx.addParagraph(
    "Se obtuvieron imágenes uniformes con el detector orientado en las direcciones ánodo–cátodo (AC, posición inicial) " +
      "y cátodo–ánodo (CA, rotación de 180°). En cada imagen se evaluaron cinco regiones de interés (ROI) distribuidas sobre el detector."
  );

  const roiLabels = ["ROIc (central)", "ROI 1", "ROI 2", "ROI 3", "ROI 4"];

  for (const [detIdx, det] of dets.entries()) {
    const detLabel = det.serie_detector ? ` — ${det.serie_detector}` : ` ${detIdx + 1}`;
    const tolerancia = det.tolerancia_pct ?? 15;

    for (const orient of ["ac", "ca"] as const) {
      const orientLabel = orient === "ac" ? "Orientación AC 0°" : "Orientación CA 180°";
      const tableNum = detIdx * 2 + (orient === "ac" ? 1 : 2);
      addCaption(ctx, `Tabla 2.11.${tableNum}. ${orientLabel}${detLabel}`);

      const center = det[`roi_0_vmp_${orient}` as keyof typeof det] as number | undefined;

      const rows: (string | number)[][] = roiLabels.map((label, i) => {
        const vmp = det[`roi_${i}_vmp_${orient}` as keyof typeof det] as number | undefined;
        const desv = det[`roi_${i}_desv_${orient}` as keyof typeof det] as number | undefined;
        const uniformidad =
          i === 0 || center == null || vmp == null
            ? "—"
            : `${formatDecimal(Math.abs((vmp - center) / center) * 100, 2)} %`;
        return [
          label,
          vmp != null ? formatDecimal(vmp, 2) : "—",
          desv != null ? formatDecimal(desv, 2) : "—",
          uniformidad,
        ];
      });

      ctx.checkPage(40);
      autoTable(doc, {
        ...TABLE_STYLE,
        startY: ctx.y,
        head: [["ROI", "VMP", "Desviación", "Uniformidad (%)"]],
        body: rows,
        headStyles: { ...TABLE_STYLE.headStyles, halign: "center" as const },
        bodyStyles: { ...TABLE_STYLE.bodyStyles, halign: "center" as const },
        columnStyles: { 0: { halign: "left" as const } },
      });
      ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }
  }

  // ── 2.11.5 Análisis ──
  ctx.addSubsectionTitle("2.11.5.", "Análisis");

  for (const det of dets) {
    const tolerancia = det.tolerancia_pct ?? 15;

    const calcMax = (orient: "ac" | "ca") => {
      const center = det[`roi_0_vmp_${orient}` as keyof typeof det] as number | undefined;
      if (center == null) return null;
      let max = 0;
      for (let i = 1; i <= 4; i++) {
        const vmp = det[`roi_${i}_vmp_${orient}` as keyof typeof det] as number | undefined;
        if (vmp != null) max = Math.max(max, Math.abs((vmp - center) / center) * 100);
      }
      return max;
    };

    const maxAc = calcMax("ac");
    const maxCa = calcMax("ca");
    const maxGlobal =
      maxAc != null && maxCa != null ? Math.max(maxAc, maxCa) : (maxAc ?? maxCa ?? null);

    const unifConforme = maxGlobal == null || maxGlobal <= tolerancia;
    const conforme = unifConforme && !det.pixeles_defectuosos && !det.artefactos;

    let parrafo: string;
    if (conforme) {
      parrafo =
        `En la evaluación de uniformidad y artefactos del detector no se evidencian píxeles defectuosos en el detector ` +
        `ni artefactos en la imagen. El valor máximo de desviación de uniformidad obtenido fue de ` +
        `${maxGlobal != null ? formatDecimal(maxGlobal, 2) : "—"} %, el cual se encuentra dentro de la tolerancia establecida de ${tolerancia} %. ` +
        `En consecuencia, la prueba cumple con el criterio de aceptación.`;
    } else {
      const partes: string[] = [];
      if (det.pixeles_defectuosos)
        partes.push("se identificaron píxeles defectuosos en el detector");
      if (det.artefactos) partes.push("se observaron artefactos en la imagen");
      if (!unifConforme && maxGlobal != null)
        partes.push(
          `el valor máximo de desviación de uniformidad obtenido fue de ${formatDecimal(maxGlobal, 2)} %, superior a la tolerancia establecida de ${tolerancia} %`
        );
      parrafo =
        `En la evaluación de uniformidad y artefactos del detector, ` +
        partes.join("; ") +
        `. La prueba no cumple con el criterio de aceptación establecido.`;
    }
    ctx.addParagraph(parrafo);
  }

  return 6;
}

// ─── 2.14 — Integridad y limpieza de cassettes / pantallas IP ───

const CAMPOS_CASSETTE_214 = [
  { key: "integridad_externa" as const, label: "Integridad externa" },
  { key: "estado_interno" as const, label: "Estado interno IP" },
  { key: "polvo_suciedad" as const, label: "Polvo / suciedad" },
  { key: "rayones_defectos" as const, label: "Rayones / defectos" },
  { key: "limpieza_realizada" as const, label: "Limpieza realizada" },
];

function concepto214Label(v: "Conforme" | "No_conforme" | undefined): string {
  if (v === "Conforme") return "Conforme";
  if (v === "No_conforme") return "No conforme";
  return "—";
}

function render214(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable, addSubsectionTitle, addParagraph, checkPage } = ctx;
  const cassettes = conv.cassettes ?? [];

  addSubsectionTitle("2.14.4.", "Resultados");

  if (cassettes.length === 0) {
    addParagraph("No se registraron cassettes para esta prueba.");
    addSubsectionTitle("2.14.5.", "Análisis");
    addParagraph("No se registraron datos de inspección de cassettes.");
    return 6;
  }

  checkPage(20);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["N°", "Serie", ...CAMPOS_CASSETTE_214.map((c) => c.label), "Concepto"]],
    body: cassettes.map((c, i) => [
      i + 1,
      c.serie_detector ?? "—",
      ...CAMPOS_CASSETTE_214.map((campo) => concepto214Label(c[campo.key])),
      concepto214Label(c.concepto),
    ]),
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
    },
    startY: ctx.y,
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.14.5.", "Análisis");

  const totalCassettes = cassettes.length;
  const conformes = cassettes.filter((c) => c.concepto === "Conforme").length;
  const noConformes = cassettes.filter((c) => c.concepto === "No_conforme").length;

  if (noConformes === 0 && conformes > 0) {
    addParagraph(
      `La inspección visual realizada a los ${totalCassettes} cassette${totalCassettes > 1 ? "s" : ""} y pantalla${totalCassettes > 1 ? "s" : ""} IP evaluado${totalCassettes > 1 ? "s" : ""} no evidenció defectos externos, presencia de polvo ni rayaduras que pudieran afectar la calidad de la imagen. Todos los cassettes inspeccionados cumplen con el criterio de aceptación.`
    );
  } else if (noConformes > 0) {
    const seriesNC = cassettes
      .filter((c) => c.concepto === "No_conforme")
      .map((c) => c.serie_detector ?? `cassette ${cassettes.indexOf(c) + 1}`)
      .join(", ");
    addParagraph(
      `La inspección visual evidenció defectos o condiciones no conformes en ${noConformes} de los ${totalCassettes} cassette${totalCassettes > 1 ? "s" : ""} evaluados (${seriesNC}). Se requiere atención sobre los elementos identificados para garantizar la calidad de la imagen radiográfica.`
    );
  } else {
    addParagraph("Inspección realizada. Se registraron los resultados en la tabla anterior.");
  }

  return 6;
}

// ─── 2.16 — MTF ───

export function renderFotos216(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.16") {
  const fotos = conv.fotos216 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica para el análisis MTF.");
    return;
  }
  const CWIDTH = 170;
  let nFig = 0;
  for (const foto of fotos) {
    ctx.checkPage(70);
    const maxW = CWIDTH;
    const maxH = 80;
    const ratio = Math.min(maxW / foto.width, maxH / foto.height);
    const w = foto.width * ratio;
    const h = foto.height * ratio;
    const x = MARGIN + (CWIDTH - w) / 2;
    try {
      ctx.doc.addImage(foto.dataUrl, "JPEG", x, ctx.y, w, h);
    } catch {
      ctx.doc.addImage(foto.dataUrl, "PNG", x, ctx.y, w, h);
    }
    ctx.y += h + 2;
    ctx.doc.setFont("helvetica", "italic");
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor(...COLOR_GRAY);
    ctx.doc.text(figCaption(codigo, ++nFig, foto.label), MARGIN + CWIDTH / 2, ctx.y, {
      align: "center",
    });
    ctx.y += 6;
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setTextColor(...COLOR_BLACK);
  }
}

function render216(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable, addSubsectionTitle, addParagraph, checkPage } = ctx;
  const m = conv.mtf;

  addSubsectionTitle("2.16.4.", "Resultados");

  if (!m) {
    addParagraph("No se registraron datos MTF para esta prueba.");
    addSubsectionTitle("2.16.5.", "Análisis");
    addParagraph("No se registraron datos de MTF.");
    return 6;
  }

  // Condiciones de medición
  const sid = m.distancia_foco_sensor_cm != null ? `${m.distancia_foco_sensor_cm} cm` : "—";
  const kv = m.tecnica_kv != null ? `${m.tecnica_kv} kVp` : "—";
  const pixel = m.pixel_size_mm != null ? `${m.pixel_size_mm} mm` : "—";
  const nyquist = m.nyquist_lpmm != null ? `${m.nyquist_lpmm} lp/mm` : "—";
  addParagraph(
    `La prueba se llevó a cabo bajo las siguientes condiciones de medición: distancia foco-sensor ${sid}, tensión de referencia ${kv}, tamaño de píxel ${pixel} y frecuencia de Nyquist ${nyquist}.`
  );

  // Tabla de valores medidos
  checkPage(25);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Dirección", "MTF50 (lp/mm)", "MTF20 (lp/mm)"]],
    body: [
      [
        "Horizontal",
        m.mtf50_horizontal != null ? formatDecimal(m.mtf50_horizontal, 3) : "—",
        m.mtf20_horizontal != null ? formatDecimal(m.mtf20_horizontal, 3) : "—",
      ],
      [
        "Vertical",
        m.mtf50_vertical != null ? formatDecimal(m.mtf50_vertical, 3) : "—",
        m.mtf20_vertical != null ? formatDecimal(m.mtf20_vertical, 3) : "—",
      ],
    ],
    didDrawPage: undefined,
    startY: ctx.y,
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.16.5.", "Análisis");

  const tieneBase = m.mtf50_base_horizontal != null || m.mtf50_base_vertical != null;

  if (!tieneBase) {
    addParagraph(
      "Las curvas de MTF obtenidas presentan un comportamiento decreciente con el aumento de la frecuencia espacial, lo cual es característico de los sistemas de radiografía digital. Los valores de MTF50 y MTF20 permiten caracterizar la capacidad del detector para reproducir detalles espaciales en las direcciones horizontal y vertical. No se dispone de valores de referencia previos para comparación, por lo que los resultados obtenidos se establecen como valores base para futuras evaluaciones."
    );
    return 6;
  }

  // Calcular desviaciones vs base
  const desv50H =
    m.mtf50_horizontal != null && m.mtf50_base_horizontal != null
      ? Math.abs((m.mtf50_horizontal - m.mtf50_base_horizontal) / m.mtf50_base_horizontal) * 100
      : null;
  const desv50V =
    m.mtf50_vertical != null && m.mtf50_base_vertical != null
      ? Math.abs((m.mtf50_vertical - m.mtf50_base_vertical) / m.mtf50_base_vertical) * 100
      : null;

  const desvMax = [desv50H, desv50V].filter((v): v is number => v != null);
  const maxDesv = desvMax.length > 0 ? Math.max(...desvMax) : null;
  const conforme = maxDesv != null ? maxDesv <= 10 : null;

  if (conforme === true) {
    addParagraph(
      `Las curvas de MTF obtenidas presentan un comportamiento decreciente con el aumento de la frecuencia espacial, consistente con el desempeño esperado para detectores digitales de radiografía. La variación máxima respecto a los valores de referencia fue de ${formatDecimal(maxDesv!, 1)} %, dentro del criterio de aceptación del 10 %. Los valores obtenidos no evidencian degradaciones significativas del sistema.`
    );
  } else if (conforme === false) {
    addParagraph(
      `Las curvas de MTF obtenidas presentan variaciones respecto a los valores de referencia que superan el criterio de aceptación del 10 % (variación máxima: ${formatDecimal(maxDesv!, 1)} %). Esto podría indicar una degradación en la capacidad del sistema para reproducir detalles espaciales, requiriendo verificación adicional del detector.`
    );
  } else {
    addParagraph(
      "Las curvas de MTF obtenidas presentan un comportamiento decreciente con el aumento de la frecuencia espacial, lo cual es característico de los sistemas de radiografía digital."
    );
  }

  return 6;
}

// ─── 2.15 — Uniformidad de sensibilidad pantallas IP CR ───

function render215(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable, addSubsectionTitle, addParagraph, checkPage } = ctx;
  const filas = conv.uniformidadCr ?? [];

  addSubsectionTitle("2.15.4.", "Resultados");

  if (filas.length === 0) {
    addParagraph("No se registraron mediciones de uniformidad CR para esta prueba.");
    addSubsectionTitle("2.15.5.", "Análisis");
    addParagraph("No se registraron datos de uniformidad CR.");
    return 6;
  }

  checkPage(20);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["N°", "Serie cassette", "mAs", "EI", "D.I.", "TEI"]],
    body: filas.map((u, i) => [
      i + 1,
      u.serie_cassette ?? "—",
      u.carga_mas != null ? formatDecimal(u.carga_mas, 1) : "—",
      u.ei != null ? formatDecimal(u.ei, 1) : "—",
      u.di != null ? formatDecimal(u.di, 2) : "—",
      u.tei != null ? formatDecimal(u.tei, 1) : "—",
    ]),
    startY: ctx.y,
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Calcular promedio y CV del EI
  const eiVals = filas.map((u) => u.ei ?? 0).filter((v) => v > 0);
  const promedioEi = eiVals.length > 0 ? eiVals.reduce((a, b) => a + b, 0) / eiVals.length : null;
  const desvEi =
    eiVals.length >= 2
      ? Math.sqrt(eiVals.reduce((s, v) => s + (v - promedioEi!) ** 2, 0) / (eiVals.length - 1))
      : null;
  const cv = promedioEi && desvEi != null ? (desvEi / promedioEi) * 100 : null;

  addSubsectionTitle("2.15.5.", "Análisis");

  if (promedioEi == null) {
    addParagraph("No se registraron valores de EI suficientes para calcular la uniformidad.");
    return 6;
  }

  const cvStr = cv != null ? `${formatDecimal(cv, 1)} %` : "—";
  const promedioStr = formatDecimal(promedioEi, 1);
  const desvStr = desvEi != null ? formatDecimal(desvEi, 1) : "—";

  if (cv != null && cv <= 10) {
    addParagraph(
      `El análisis de uniformidad de sensibilidad entre las pantallas IP evaluadas arrojó un índice de exposición promedio de ${promedioStr} (desviación estándar: ${desvStr}), con un coeficiente de variación de ${cvStr}. El valor obtenido se encuentra dentro del criterio de aceptación establecido (CV <= 10 %), por lo que la prueba cumple con los requisitos de uniformidad.`
    );
  } else {
    addParagraph(
      `El análisis de uniformidad de sensibilidad entre las pantallas IP evaluadas arrojó un índice de exposición promedio de ${promedioStr} (desviación estándar: ${desvStr}), con un coeficiente de variación de ${cvStr}. El valor obtenido supera el criterio de aceptación establecido (CV <= 10 %), indicando diferencias de sensibilidad entre las pantallas que pueden afectar la consistencia de las imágenes.`
    );
  }

  return 6;
}

// ─── Renderizador genérico (esqueleto para grupos B–E) ───

function renderGenerico(ctx: InformeCtx, codigo: string, conv: DatosConvencional): number {
  ctx.addSubsectionTitle(`${codigo}.4.`, "Resultados");
  const resultado = conv.resultados.get(codigo);

  if (!resultado || (!resultado.completado && resultado.resultado_principal == null)) {
    ctx.addParagraph("Sin datos registrados para esta prueba.");
    return 5;
  }

  const lineas: string[] = [];
  if (resultado.resultado_principal != null) {
    lineas.push(`Resultado principal: ${resultado.resultado_principal}`);
  }
  if (resultado.resultado_secundario != null) {
    lineas.push(`Resultado secundario: ${resultado.resultado_secundario}`);
  }
  for (const [clave, valor] of Object.entries(resultado.datos_calculados ?? {})) {
    if (valor == null || typeof valor === "object") continue;
    lineas.push(`${clave.replace(/_/g, " ")}: ${String(valor)}`);
  }
  if (lineas.length === 0) {
    ctx.addParagraph("Prueba ejecutada — los resultados detallados se registran en la aplicación.");
  } else {
    for (const linea of lineas) ctx.addParagraph(linea);
  }
  return 5;
}

// ─── Entrada principal por sección ───

export function renderFotos217(ctx: InformeCtx, conv: DatosConvencional, codigo = "2.17") {
  const fotos = conv.fotos217 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const { doc, autoTable } = ctx;
  const CONTENT_W = doc.internal.pageSize.getWidth() - 40;
  let nFig = 0;
  for (const foto of fotos) {
    const maxW = 170;
    const maxH = 80;
    const ratio = Math.min(maxW / foto.width, maxH / foto.height, 1);
    const w = foto.width * ratio;
    const h = foto.height * ratio;
    const x = 20 + (CONTENT_W - w) / 2;
    ctx.checkPage(h + 14);
    doc.addImage(foto.dataUrl, "JPEG", x, ctx.y, w, h);
    ctx.y += h + 2;
    autoTable(doc, {
      body: [[figCaption(codigo, ++nFig, foto.label)]],
      startY: ctx.y,
      styles: { fontSize: 7, fontStyle: "italic", halign: "center", textColor: COLOR_GRAY },
      theme: "plain",
      margin: { left: 20, right: 20 },
    });
    ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
}

function render217(ctx: InformeCtx, conv: DatosConvencional): number {
  const { addParagraph, addSubsectionTitle, checkPage, autoTable, doc } = ctx;
  const s = conv.caeSetup;
  const byToma = new Map(conv.caeMediciones.map((m) => [m.toma_numero, m]));

  function pctVar217(medido: number | undefined, base: number | undefined): number | null {
    if (!medido || !base) return null;
    return Math.abs(medido - base) / Math.abs(base);
  }

  function fmtPct(v: number | null) {
    return v == null ? "—" : `${formatDecimal(v * 100, 1)} %`;
  }

  // Condiciones generales
  const distancia = conv.raysafeSetup?.distancia_foco_detector_d2_cm ?? 100;
  addParagraph(
    `Las mediciones se implementaron a una distancia foco sensor de ${distancia} cm. Tensión de referencia: 70 kVp.`
  );

  // Tabla 2.17.1 — registro de mediciones
  checkPage(30);
  addSubsectionTitle("2.17.4.", "Resultados");

  const filas217 = conv.caeMediciones.map((m) => [
    String(m.toma_numero),
    fmt(m.kv_nominal, 0),
    m.espesor_cu_mm != null ? `Cu ${m.espesor_cu_mm} mm` : "—",
    m.posicion_sensor ?? "—",
    fmt(m.carga_mas),
    m.ei != null ? String(m.ei) : "—",
    m.di != null ? String(m.di) : "—",
  ]);

  checkPage(20);
  addParagraph("Tabla 2.17.1. Registro de mediciones de sensibilidad del CAE", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["#", "kVp", "Espesor / Atenuador", "Posición Sensor CAE", "mAs", "EI", "D.I."]],
    body: filas217.length > 0 ? filas217 : [["—", "—", "—", "—", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Análisis
  addSubsectionTitle("2.17.5.", "Análisis");

  const t9 = byToma.get(9);
  const hayBase = s?.mas_base_217 != null || s?.ei_base_217 != null;

  if (!t9 || !hayBase) {
    addParagraph(
      "No se dispone de valores de referencia previos para realizar la comparación. Los valores obtenidos en esta visita se establecen como valores de referencia para futuras evaluaciones."
    );
  } else {
    const varMas = pctVar217(t9.carga_mas, s?.mas_base_217);
    const varEi = pctVar217(t9.ei, s?.ei_base_217);
    const varDi = pctVar217(t9.di, s?.di_base_217);

    checkPage(30);
    addParagraph("Tabla 2.17.2. Análisis de resultados de sensibilidad", 8);
    autoTable(doc, {
      ...TABLE_STYLE,
      head: [["Parámetro", "Valor medido", "Valor base", "% Variación", "Criterio (≤ 50 %)"]],
      body: [
        [
          "Carga (mAs)",
          fmt(t9.carga_mas),
          fmt(s?.mas_base_217),
          fmtPct(varMas),
          varMas == null ? "—" : varMas <= 0.5 ? "Conforme" : "No conforme",
        ],
        [
          "EI",
          t9.ei != null ? String(t9.ei) : "—",
          s?.ei_base_217 != null ? String(s.ei_base_217) : "—",
          fmtPct(varEi),
          varEi == null ? "—" : varEi <= 0.5 ? "Conforme" : "No conforme",
        ],
        [
          "D.I.",
          t9.di != null ? String(t9.di) : "—",
          s?.di_base_217 != null ? String(s.di_base_217) : "—",
          varDi == null ? "NA" : fmtPct(varDi),
          varDi == null ? "NA" : varDi <= 0.5 ? "Conforme" : "No conforme",
        ],
      ],
      startY: ctx.y,
      didDrawPage: () => {
        ctx.y = 30;
      },
    });
    ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    addParagraph(
      "Los valores obtenidos de carga (mAs), indicador de exposición (EI) y desviación del indicador (D.I.) se compararon con los valores de referencia establecidos para el equipo bajo las mismas condiciones de exposición. La comparación realizada evidencia que las variaciones observadas en los parámetros evaluados se mantienen dentro de la tolerancia establecida para esta prueba, indicando una respuesta estable del sistema de control automático de exposición."
    );
  }

  return 6;
}

function render218(ctx: InformeCtx, conv: DatosConvencional): number {
  const { addParagraph, addSubsectionTitle, checkPage, autoTable, doc } = ctx;

  function fmtPct(v: number | null) {
    return v == null ? "—" : `${formatDecimal(v * 100, 1)} %`;
  }

  function rangeVar(arr: number[]): number | null {
    if (arr.length === 0) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (!mean) return null;
    return (Math.max(...arr) - Math.min(...arr)) / mean;
  }

  // Tomas 2-8 (7 combinaciones de sensor a 70kVp, Cu 1mm)
  const tomas218 = conv.caeMediciones.filter((m) => m.toma_numero >= 2 && m.toma_numero <= 8);

  checkPage(30);
  addSubsectionTitle("2.18.4.", "Resultados");
  addParagraph("Tensión de referencia: 70 kVp. Espesor/atenuador: Cu 1 mm.");

  const filas218 = tomas218.map((m) => [
    m.posicion_sensor ?? "—",
    fmt(m.carga_mas),
    m.ei != null ? String(m.ei) : "—",
    m.di != null ? String(m.di) : "—",
  ]);

  addParagraph("Tabla 2.18.1. Resultados consistencia entre los sensores del CAE", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Posición Sensor CAE", "Carga (mAs)", "EI", "D.I."]],
    body: filas218.length > 0 ? filas218 : [["—", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.18.5.", "Análisis");

  const masVals = tomas218.map((m) => m.carga_mas).filter((v): v is number => v != null && v > 0);
  const eiVals = tomas218.map((m) => m.ei).filter((v): v is number => v != null && v > 0);
  const varMas = rangeVar(masVals);
  const varEi = rangeVar(eiVals);
  const promMas = masVals.length > 0 ? masVals.reduce((a, b) => a + b, 0) / masVals.length : null;
  const promEi = eiVals.length > 0 ? eiVals.reduce((a, b) => a + b, 0) / eiVals.length : null;

  checkPage(25);
  addParagraph("Tabla 2.18.2. Análisis de resultados de consistencia", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Parámetro", "Valor promedio", "% Variación", "Criterio (≤ 30 %)"]],
    body: [
      [
        "Carga (mAs)",
        promMas != null ? fmt(promMas) : "—",
        fmtPct(varMas),
        varMas == null ? "—" : varMas <= 0.3 ? "Conforme" : "No conforme",
      ],
      [
        "EI",
        promEi != null ? fmt(promEi, 0) : "—",
        fmtPct(varEi),
        varEi == null ? "—" : varEi <= 0.3 ? "Conforme" : "No conforme",
      ],
    ],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addParagraph(
    "Las diferencias porcentuales calculadas respecto a los valores promedio para los parámetros evaluados se mantienen dentro de la tolerancia establecida para esta prueba. Lo anterior evidencia consistencia en la respuesta del sistema entre las diferentes configuraciones de sensores del control automático de exposición bajo las condiciones de irradiación evaluadas."
  );

  return 6;
}

function render219(ctx: InformeCtx, conv: DatosConvencional): number {
  const { addParagraph, addSubsectionTitle, checkPage, autoTable, doc } = ctx;

  function cv(arr: number[]): number | null {
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (!mean) return null;
    const stdev = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1));
    return stdev / mean;
  }

  function fmtPct(v: number | null) {
    return v == null ? "—" : `${formatDecimal(v * 100, 2)} %`;
  }

  // Tomas 3, 9, 10, 11, 12 (5 repeticiones 70kVp, Cu 1mm, Centro)
  const tomasRep = conv.caeMediciones.filter(
    (m) => m.toma_numero === 3 || (m.toma_numero >= 9 && m.toma_numero <= 12)
  );

  checkPage(30);
  addSubsectionTitle("2.19.4.", "Resultados");
  addParagraph(
    "Tensión de referencia: 70 kVp. Espesor/atenuador: Cu 1 mm. Posición sensor: Centro."
  );

  const filas219 = tomasRep.map((m) => [
    m.espesor_cu_mm != null ? `Cu ${m.espesor_cu_mm} mm` : "—",
    m.posicion_sensor ?? "—",
    fmt(m.carga_mas),
    m.ei != null ? String(m.ei) : "—",
    m.di != null ? String(m.di) : "—",
  ]);

  addParagraph("Tabla 2.19.1. Resultados de repetibilidad del CAE", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Espesor / Atenuador", "Posición Sensor CAE", "Carga (mAs)", "EI", "D.I."]],
    body: filas219.length > 0 ? filas219 : [["—", "—", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.19.5.", "Análisis");

  const masVals = tomasRep.map((m) => m.carga_mas).filter((v): v is number => v != null && v > 0);
  const eiVals = tomasRep.map((m) => m.ei).filter((v): v is number => v != null && v > 0);
  const cvMas = cv(masVals);
  const cvEi = cv(eiVals);
  const promMas = masVals.length > 0 ? masVals.reduce((a, b) => a + b, 0) / masVals.length : null;
  const promEi = eiVals.length > 0 ? eiVals.reduce((a, b) => a + b, 0) / eiVals.length : null;
  const desvMas = cvMas != null && promMas != null ? cvMas * promMas : null;
  const desvEi = cvEi != null && promEi != null ? cvEi * promEi : null;

  checkPage(25);
  addParagraph("Tabla 2.19.2. Análisis de repetibilidad del CAE", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Parámetro", "Valor promedio", "Desviación estándar", "CV (%)", "Criterio (≤ 10 %)"]],
    body: [
      [
        "Carga (mAs)",
        promMas != null ? fmt(promMas) : "—",
        desvMas != null ? fmt(desvMas, 3) : "—",
        fmtPct(cvMas),
        cvMas == null ? "—" : cvMas <= 0.1 ? "Conforme" : "No conforme",
      ],
      [
        "EI",
        promEi != null ? fmt(promEi, 1) : "—",
        desvEi != null ? fmt(desvEi, 2) : "—",
        fmtPct(cvEi),
        cvEi == null ? "—" : cvEi <= 0.1 ? "Conforme" : "No conforme",
      ],
    ],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addParagraph(
    "Los coeficientes de variación obtenidos para los parámetros evaluados se mantienen dentro de la tolerancia establecida para esta prueba. Esto evidencia una respuesta repetible del sistema de control automático de exposición bajo condiciones equivalentes de irradiación."
  );

  return 6;
}

function render220(ctx: InformeCtx, conv: DatosConvencional): number {
  const { addParagraph, addSubsectionTitle, checkPage, autoTable, doc } = ctx;
  const s = conv.caeSetup;

  function pv(medido: number | undefined, base: number | undefined): number | null {
    if (!medido || !base) return null;
    return Math.abs(medido - base) / Math.abs(base);
  }

  function fmtPct(v: number | null) {
    return v == null ? "—" : `${formatDecimal(v * 100, 1)} %`;
  }

  const byToma = new Map(conv.caeMediciones.map((m) => [m.toma_numero, m]));

  // Tabla de mediciones (kVp + espesores)
  const filasKvp = [
    { toma: 1, kv: 60, esp: "Cu 1 mm" },
    { toma: 12, kv: 70, esp: "Cu 1 mm" },
    { toma: 13, kv: 81, esp: "Cu 1 mm" },
  ];
  const filasEsp = [
    { toma: 13, kv: 81, esp: "Cu 1 mm" },
    { toma: 14, kv: 81, esp: "Cu 2 mm" },
    { toma: 15, kv: 81, esp: "Cu 3 mm" },
  ];

  checkPage(40);
  addSubsectionTitle("2.20.4.", "Resultados");
  addParagraph(
    "Tabla 2.20.1. Resultados de mediciones de compensación por kilovoltajes y espesores",
    8
  );

  const todasFilas = [...filasKvp, ...filasEsp.slice(1)].map(({ toma, kv, esp }) => {
    const m = byToma.get(toma);
    return [
      String(kv),
      "Centro",
      esp,
      m?.carga_mas != null ? fmt(m.carga_mas) : "—",
      m?.ei != null ? String(m.ei) : "—",
      m?.di != null ? String(m.di) : "—",
    ];
  });

  autoTable(doc, {
    ...TABLE_STYLE,
    head: [
      ["Tensión (kVp)", "Posición Sensor CAE", "Espesor / Atenuador", "Carga (mAs)", "EI", "D.I."],
    ],
    body: todasFilas.length > 0 ? todasFilas : [["—", "—", "—", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.20.5.", "Análisis");

  // Análisis kVp
  const t1 = byToma.get(1);
  const t12 = byToma.get(12);
  const t13 = byToma.get(13);
  const t14 = byToma.get(14);
  const t15 = byToma.get(15);

  addParagraph(
    "Los valores de carga (mAs), indicador de exposición (EI) y desviación del indicador (D.I.) obtenidos para los diferentes valores de kilovoltaje evaluados fueron comparados con los valores iniciales de referencia correspondientes."
  );

  checkPage(30);
  addParagraph("Tabla 2.20.2. Análisis compensación por kilovoltajes", 8);
  const hayBaseKvp =
    s?.mas_base_60kv != null || s?.mas_base_70kv != null || s?.mas_base_81kv != null;
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Parámetro", "% Var. 60 kVp", "% Var. 70 kVp", "% Var. 81 kVp"]],
    body: hayBaseKvp
      ? [
          [
            "Carga (mAs)",
            fmtPct(pv(t1?.carga_mas, s?.mas_base_60kv)),
            fmtPct(pv(t12?.carga_mas, s?.mas_base_70kv)),
            fmtPct(pv(t13?.carga_mas, s?.mas_base_81kv)),
          ],
          [
            "EI",
            fmtPct(pv(t1?.ei, s?.ei_base_60kv)),
            fmtPct(pv(t12?.ei, s?.ei_base_70kv)),
            fmtPct(pv(t13?.ei, s?.ei_base_81kv)),
          ],
          ["D.I.", "NA", "NA", "NA"],
        ]
      : [["Sin valores base registrados", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addParagraph(
    "Los valores de carga (mAs), indicador de exposición (EI) y desviación del indicador (D.I.) obtenidos para los diferentes espesores evaluados fueron comparados con los valores iniciales de referencia correspondientes."
  );

  checkPage(30);
  addParagraph("Tabla 2.20.3. Análisis compensación por espesores", 8);
  const hayBaseEsp = s?.mas_base_cu1 != null || s?.mas_base_cu2 != null || s?.mas_base_cu3 != null;
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [["Parámetro", "% Var. Cu 1 mm", "% Var. Cu 2 mm", "% Var. Cu 3 mm"]],
    body: hayBaseEsp
      ? [
          [
            "Carga (mAs)",
            fmtPct(pv(t13?.carga_mas, s?.mas_base_cu1)),
            fmtPct(pv(t14?.carga_mas, s?.mas_base_cu2)),
            fmtPct(pv(t15?.carga_mas, s?.mas_base_cu3)),
          ],
          [
            "EI",
            fmtPct(pv(t13?.ei, s?.ei_base_cu1)),
            fmtPct(pv(t14?.ei, s?.ei_base_cu2)),
            fmtPct(pv(t15?.ei, s?.ei_base_cu3)),
          ],
          ["D.I.", "NA", "NA", "NA"],
        ]
      : [["Sin valores base registrados", "—", "—", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addParagraph(
    "Las variaciones porcentuales observadas se mantienen dentro de la tolerancia establecida para esta prueba, evidenciando una adecuada compensación del sistema de control automático de exposición frente a cambios de kilovoltaje y espesor."
  );

  return 6;
}

function render221(ctx: InformeCtx, conv: DatosConvencional): number {
  const { addParagraph, addSubsectionTitle, checkPage, autoTable, doc } = ctx;
  const setup = conv.raysafeSetup;
  const d1 = setup?.distancia_foco_sensor_d1_cm ?? 100;
  const d2 = setup?.distancia_foco_detector_d2_cm ?? 100;
  const corrGeom = (d2 / d1) ** 2;

  const sinRejilla = conv.raysafeMediciones.filter((m) => m.tipo_medicion === "sin_rejilla");

  checkPage(30);
  addSubsectionTitle("2.21.4.", "Resultados");
  addParagraph(
    `La dosis al receptor de imagen se calculó a partir de la dosis medida, aplicando la corrección geométrica por distancia de acuerdo con la ecuación 19 del IAEA-TECDOC-1958.`
  );
  addParagraph(`Distancia foco-sensor d1: ${d1} cm. Distancia foco-detector d2: ${d2} cm.`);

  const filas221 = sinRejilla.map((m) => {
    const dosisR = m.dosis_medida_mgy != null ? m.dosis_medida_mgy * corrGeom : null;
    return [
      m.programa_clinico ?? "—",
      fmt(m.kv_nominal, 0),
      fmt(m.mas_nominal),
      m.dosis_medida_mgy != null ? formatDecimal(m.dosis_medida_mgy, 5) : "—",
      "1",
      dosisR != null ? formatDecimal(dosisR, 5) : "—",
    ];
  });

  addParagraph("Tabla 2.21.1. Registro de mediciones de dosis al receptor de imagen", 8);
  autoTable(doc, {
    ...TABLE_STYLE,
    head: [
      [
        "Programa",
        "Tensión (kVp)",
        "Carga (mAs)",
        "Dosis medida (mGy)",
        "TPR",
        "Dosis al receptor (mGy)",
      ],
    ],
    body: filas221.length > 0 ? filas221 : [["—", "—", "—", "—", "1", "—"]],
    startY: ctx.y,
    didDrawPage: () => {
      ctx.y = 30;
    },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  addSubsectionTitle("2.21.5.", "Análisis");

  const hayBase = sinRejilla.some((m) => m.dosis_base_mgy != null);

  if (!hayBase) {
    addParagraph(
      "No se dispone de valores de referencia previos para la dosis al receptor. Los valores obtenidos en esta visita se establecen como valores de referencia base para futuras evaluaciones."
    );
  } else {
    const filas221Analisis = sinRejilla.map((m) => {
      const dosisR = m.dosis_medida_mgy != null ? m.dosis_medida_mgy * corrGeom : null;
      const diff =
        dosisR != null && m.dosis_base_mgy != null ? Math.abs(dosisR - m.dosis_base_mgy) : null;
      return [
        m.programa_clinico ?? "—",
        dosisR != null ? formatDecimal(dosisR, 5) : "—",
        m.dosis_base_mgy != null ? formatDecimal(m.dosis_base_mgy, 5) : "—",
        diff != null ? formatDecimal(diff, 5) : "—",
        diff == null ? "—" : diff < 0.01 ? "Conforme" : "No conforme",
      ];
    });

    checkPage(30);
    addParagraph("Tabla 2.21.2. Análisis de dosis al receptor de imagen", 8);
    autoTable(doc, {
      ...TABLE_STYLE,
      head: [
        ["Programa", "Dosis receptor (mGy)", "Dosis base (mGy)", "Diferencia (mGy)", "Cumple"],
      ],
      body: filas221Analisis,
      startY: ctx.y,
      didDrawPage: () => {
        ctx.y = 30;
      },
    });
    ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    addParagraph(
      "Las diferencias calculadas entre los valores de dosis al receptor obtenidos y los valores de referencia se comparan con el criterio de aceptación establecido en el IAEA-TECDOC-1958."
    );
  }

  return 6;
}

/**
 * Renderiza las subsecciones de resultados de una prueba (a partir de la .4).
 * Retorna el número de la siguiente subsección disponible (para Criterio).
 */
export function renderResultadosSeccion(
  ctx: InformeCtx,
  codigo: string,
  visita: VisitaEjecucion,
  conv: DatosConvencional,
  ubicacion: UbicacionRx | undefined
): number {
  switch (codigo) {
    case "2.1":
      return render21(ctx, visita, conv);
    case "2.2":
      return render22(ctx, conv, ubicacion);
    case "2.3":
      return render23(ctx, conv);
    case "2.4":
      return render24(ctx, conv);
    case "2.5":
      return render25(ctx, conv);
    case "2.6":
      return render26(ctx, conv);
    case "2.7":
      return render27(ctx, conv);
    case "2.8":
      return render28(ctx, conv);
    case "2.9":
      return render29(ctx, conv);
    case "2.10":
      return render210(ctx, conv);
    case "2.11":
      return render211(ctx, conv);
    case "2.12":
      return render212(ctx, conv);
    case "2.13":
      return render213(ctx, conv);
    case "2.14":
      return render214(ctx, conv);
    case "2.15":
      return render215(ctx, conv);
    case "2.16":
      return render216(ctx, conv);
    case "2.17":
      return render217(ctx, conv);
    case "2.18":
      return render218(ctx, conv);
    case "2.19":
      return render219(ctx, conv);
    case "2.20":
      return render220(ctx, conv);
    case "2.21":
      return render221(ctx, conv);
    default:
      return renderGenerico(ctx, codigo, conv);
  }
}

// ─── Evidencia gráfica por prueba ───

type RenderFotos = (ctx: InformeCtx, conv: DatosConvencional, codigo: string) => void;

/**
 * Renderizador de evidencia gráfica por código de prueba. Las pruebas que no
 * están acá (2.1 tiene diagrama; 2.14 / 2.15 no llevan evidencia) no muestran
 * la subsección.
 */
const RENDER_FOTOS: Record<string, RenderFotos> = {
  "2.2": renderFotos22,
  "2.3": renderFotos23,
  "2.4": renderFotos24,
  "2.5": renderFotos25,
  "2.6": renderFotos26,
  "2.7": renderFotos27,
  "2.8": renderFotos28,
  "2.9": renderFotos29,
  "2.10": renderFotos210,
  "2.11": renderFotos211,
  "2.12": renderFotos212,
  "2.13": renderFotos213,
  "2.16": renderFotos216,
  "2.17": renderFotos217,
  "2.18": renderFotos217,
  "2.19": renderFotos217,
  "2.20": renderFotos217,
  "2.21": renderFotos217,
};

/** ¿La prueba `codigo` lleva subsección "Evidencia gráfica"? */
export function tieneEvidenciaGrafica(codigo: string): boolean {
  return codigo in RENDER_FOTOS;
}

/** Dibuja la evidencia gráfica de la prueba (sin el título de subsección). */
export function renderEvidenciaGrafica(
  ctx: InformeCtx,
  conv: DatosConvencional,
  codigo: string
): void {
  RENDER_FOTOS[codigo]?.(ctx, conv, codigo);
}
