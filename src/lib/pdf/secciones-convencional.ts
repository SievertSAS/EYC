import type { jsPDF } from "jspdf";
import type autoTableType from "jspdf-autotable";
import { db } from "@/lib/db";
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
} from "@/lib/equipos/convencional/db/types";
import {
  ITEMS_INSPECCION_EQUIPO,
  ITEMS_CONDICIONES_OPERACION,
} from "@/lib/equipos/convencional/inspeccion-items";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";

// ============================================================
//  Secciones del pre-informe para el equipo CONVENCIONAL
//  Estructura basada en la hoja CE_NIT de la plantilla Excel.
//  Cada prueba 2.X renderiza sus resultados desde las tablas
//  conv_*; 2.1 y 2.2 tienen renderizador completo, el resto
//  usa el esqueleto genérico hasta que se implemente el suyo.
// ============================================================

// ─── Estilo (espejo de generar-pre-informe.ts) ───

const COLOR_PRIMARY: [number, number, number] = [51, 65, 85];
const COLOR_GRAY: [number, number, number] = [100, 116, 139];
const COLOR_BLACK: [number, number, number] = [30, 30, 30];
const COLOR_ALT_ROW: [number, number, number] = [248, 250, 252];
const MARGIN = 20;

const TABLE_STYLE = {
  theme: "grid" as const,
  headStyles: {
    fillColor: COLOR_PRIMARY,
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    fontSize: 7,
  },
  bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
  alternateRowStyles: { fillColor: COLOR_ALT_ROW },
  margin: { left: MARGIN, right: MARGIN },
};

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
  /** Setup y mediciones del RaySafe (pruebas 2.4–2.8) */
  raysafeSetup?: ConvRaysafeSetup;
  raysafeMediciones: ConvRaysafeMedicion[];
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
  if (!evidencia?.blob_local) return undefined;
  try {
    const bitmap = await createImageBitmap(evidencia.blob_local);
    const dataUrl = await blobADataUrl(evidencia.blob_local);
    return { dataUrl, width: bitmap.width, height: bitmap.height };
  } catch {
    return undefined;
  }
}

export async function recopilarDatosConv(visitaId: number): Promise<DatosConvencional> {
  const [secciones, setup, mediciones, inspeccion, elementos, resultadosArr, evidencias, colimacion, raysafeSetup, raysafeMediciones] =
    await Promise.all([
      db.conv_informe_secciones.where("visita_id").equals(visitaId).sortBy("orden"),
      db.conv_levantamiento_setup.where("visita_id").equals(visitaId).first(),
      db.conv_mediciones.where("visita_id").equals(visitaId).sortBy("punto_numero"),
      db.conv_inspeccion_items.where("visita_id").equals(visitaId).toArray(),
      db.conv_elementos_proteccion.where("visita_id").equals(visitaId).toArray(),
      db.conv_resultados_prueba.where("visita_id").equals(visitaId).toArray(),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
      db.conv_colimacion.where("visita_id").equals(visitaId).first(),
      db.conv_raysafe_setup.where("visita_id").equals(visitaId).first(),
      db.conv_raysafe_mediciones.where("visita_id").equals(visitaId).sortBy("toma_numero"),
    ]);

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

  // Fotografías de la 2.2 (sección 2.2.8): orden fijo + una por elemento
  const SLOTS_FOTOS_22: [string, string][] = [
    ["equipo_rayos_x", "Equipo de rayos X"],
    ["consola", "Consola del equipo"],
    ["aviso_proteccion_1", "Aviso de protección radiológica"],
    ["aviso_proteccion_2", "Aviso de protección radiológica"],
    ["aviso_proteccion_3", "Aviso de protección radiológica"],
  ];
  const fotos22: NonNullable<DatosConvencional["fotos22"]> = [];
  for (const [slot, label] of SLOTS_FOTOS_22) {
    const ev = evidencias.find((e) => e.prueba_codigo === "2.2" && e.slot === slot);
    const img = await cargarImagen(ev);
    if (img) fotos22.push({ label, ...img });
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
    ["montaje_colimacion", "Fig. 2.3.1. Montaje experimental para la verificación del sistema de colimación"],
    ["patron_colimacion", "Fig. 2.3.2. Imagen radiográfica del patrón de colimación con la posición del rayo central"],
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
  const fotos24: NonNullable<DatosConvencional["fotos24"]> = [];
  if (img24) fotos24.push({ label: "Fig. Implementación de instrumentación en la prueba", ...img24 });
  const fotos25: NonNullable<DatosConvencional["fotos25"]> = [];
  if (img24) fotos25.push({ label: "Fig 2.5.1. Implementación de instrumentación en la prueba", ...img24 });
  const fotos26: NonNullable<DatosConvencional["fotos26"]> = [];
  if (img24) fotos26.push({ label: "Fig 2.6.1 Implementación de instrumentación en la prueba", ...img24 });

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
    raysafeSetup,
    raysafeMediciones,
  };
}

// ─── Helpers de render ───

function num(v: number | undefined | null): number {
  return v == null || isNaN(v) ? 0 : v;
}

function fmt(v: number | undefined | null, decimals = 1): string {
  return v == null ? "—" : v.toFixed(decimals);
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

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Pinta verde/rojo las celdas de concepto de una tabla */
function colorearConcepto(columnIndex: number) {
  return (data: {
    section: string;
    column: { index: number };
    cell: { raw: unknown; styles: { textColor: unknown; fontStyle: string } };
  }) => {
    if (data.section === "body" && data.column.index === columnIndex) {
      const val = String(data.cell.raw);
      if (val === "Conforme") {
        data.cell.styles.textColor = [16, 150, 80];
        data.cell.styles.fontStyle = "bold";
      } else if (val === "No conforme") {
        data.cell.styles.textColor = [220, 50, 50];
        data.cell.styles.fontStyle = "bold";
      }
    }
  };
}

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
              ? (setup.fondo_natural_usv_h / 1000).toFixed(5)
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
  ctx.y = finalY(doc) + 4;
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
        m.tasa_dosis_msv_h != null ? m.tasa_dosis_msv_h.toFixed(5) : "—",
      ]),
      columnStyles: { 0: { cellWidth: 14 } },
    });
    ctx.y = finalY(doc) + 4;
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
  ctx.y = finalY(doc) + 4;

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
        fmt(m.factor_ocupacion_t, 3).replace(/\.?0+$/, "") || "—",
        fmt(m.factor_uso_u, 1),
        m.dosis_anual_msv != null ? m.dosis_anual_msv.toFixed(6) : "—",
        capitalizar(m.tipo_area),
        conceptoLabel(m.concepto),
      ]),
      columnStyles: { 0: { cellWidth: 12 } },
      didParseCell: colorearConcepto(6),
    });
    ctx.y = finalY(doc) + 4;
  }

  // .6 Criterio (lo agrega el generador con el texto del catálogo)
  // .7 Diagrama radiométrico
  return 6;
}

/** Subsección extra de la 2.1: diagrama radiométrico (después del criterio) */
export function renderDiagramaRadiometrico(ctx: InformeCtx, conv: DatosConvencional) {
  ctx.addSubsectionTitle("2.1.7.", "Diagrama radiométrico");
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

/** Subsección 2.2.8: fotografías de la inspección (equipo, consola, avisos, elementos) */
export function renderFotos22(ctx: InformeCtx, conv: DatosConvencional) {
  const { doc } = ctx;
  const fotos = conv.fotos22 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntaron fotografías de la inspección visual.");
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
      doc.text(`Fig. ${r.label}`, x, startY + r.h + 4);
    });

    ctx.y = startY + rowH + 2;
  }
}

/** Subsección 2.3.7: montaje experimental y patrón radiográfico de colimación */
export function renderFotos23(ctx: InformeCtx, conv: DatosConvencional) {
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
      const caption = doc.splitTextToSize(r.label, colW);
      doc.text(caption, x, startY + r.h + 4);
    });

    ctx.y = startY + rowH + 2;
  }
}

/** Subsección 2.4.7: fotografía del montaje con sensor RaySafe */
export function renderFotos24(ctx: InformeCtx, conv: DatosConvencional) {
  const { doc } = ctx;
  const fotos = conv.fotos24 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170; // ancho de contenido (mm)
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
    const caption = doc.splitTextToSize(f.label, CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.6.7: fotografía del montaje con sensor RaySafe */
export function renderFotos26(ctx: InformeCtx, conv: DatosConvencional) {
  const { doc } = ctx;
  const fotos = conv.fotos26 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
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
    const caption = doc.splitTextToSize(f.label, CWIDTH);
    doc.text(caption, MARGIN + CWIDTH / 2, ctx.y + h + 4, { align: "center" });
    ctx.y += h + 12;
  }
}

/** Subsección 2.5.7: fotografía del montaje con sensor RaySafe */
export function renderFotos25(ctx: InformeCtx, conv: DatosConvencional) {
  const { doc } = ctx;
  const fotos = conv.fotos25 ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  const CWIDTH = 170;
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
    const caption = doc.splitTextToSize(f.label, CWIDTH);
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
    ctx.y = finalY(doc) + 4;
  }

  // Dimensiones de la sala en mini-tabla horizontal
  if (ubicacion?.ancho_m || ubicacion?.largo_m || ubicacion?.alto_m) {
    const area =
      ubicacion.area_m2 != null
        ? `${ubicacion.area_m2.toFixed(2)} m²`
        : ubicacion.ancho_m && ubicacion.largo_m
          ? `${(ubicacion.ancho_m * ubicacion.largo_m).toFixed(2)} m²`
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
    ctx.y = finalY(doc) + 4;
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
    ctx.y = finalY(doc) + 4;
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
    ctx.y = finalY(doc) + 4;
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
      ["Tensión (kV)", fmt(c.tecnica_kv, 0), "Exposición (mAs)", fmt(c.tecnica_mas, 1), "Distancia foco-receptor, SID (cm)", fmt(c.sid_cm, 0)],
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
  ctx.y = finalY(doc) + 4;

  const sid = c.sid_cm || 100;
  const DIRS = [
    { label: "Ánodo (cabeza)", nom: c.anodo_nominal, med: c.anodo_medido },
    { label: "Cátodo (pies)", nom: c.catodo_nominal, med: c.catodo_medido },
    { label: "Izquierda",     nom: c.izquierda_nominal, med: c.izquierda_medido },
    { label: "Derecha",       nom: c.derecha_nominal,   med: c.derecha_medido },
  ];

  const rows = DIRS.map(({ label, nom, med }) => {
    const diff = Math.abs(num(med) - num(nom));
    const varPct = (diff * 100) / sid;
    const concepto = varPct < 2 ? "Conforme" : "No conforme";
    return [label, fmt(nom, 0), fmt(med, 0), diff.toFixed(1), varPct.toFixed(1) + " %", "< 2 %", concepto];
  });

  const totalVar = rows.reduce((s, r) => s + parseFloat(r[4]), 0);
  const conceptoTotal = rows.every((r) => parseFloat(r[4]) < 2) && totalVar < 4 ? "Conforme" : "No conforme";

  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.3.1. Registro de mediciones para la coincidencia del campo luminoso con el campo de radiación");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Dirección", "Campo luminoso (cm)", "Campo de radiación (cm)", "Diferencia (cm)", "Variación (%)", "Tolerancia", "Concepto"]],
    body: [
      ...rows,
      ["Total (suma de desviaciones opuestas)", "", "", "", totalVar.toFixed(1) + " %", "< 4 %", conceptoTotal],
    ],
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 } },
    didParseCell: colorearConcepto(6),
  });
  ctx.y = finalY(doc) + 4;

  const esfera = c.posicion_esfera;
  const CRITERIO_ESFERA: Record<string, string> = {
    "Centro": "Perpendicularidad del rayo central menor a 3°",
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
  addCaption(ctx, "Tabla 2.3.2: Registro de mediciones para la perpendicularidad del campo de radiación");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Campo", "Valor"]],
    body: [
      ["Posición observada de la esfera", esfera ?? "—"],
      ["Criterio de interpretación", esfera ? CRITERIO_ESFERA[esfera] ?? "—" : "—"],
      ["Concepto", perpConcepto ?? "—"],
    ],
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: COLOR_ALT_ROW } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2 && data.column.index === 1) {
        const val = String(data.cell.raw);
        if (val === "Conforme") { data.cell.styles.textColor = [16, 150, 80]; data.cell.styles.fontStyle = "bold"; }
        else if (val === "No conforme") { data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold"; }
      }
    },
  });
  ctx.y = finalY(doc) + 4;

  // .5 Análisis — texto auto-generado según la fórmula del Excel
  ctx.addSubsectionTitle("2.3.5.", "Análisis");

  const totalVarStr = totalVar.toFixed(0);
  let analisisTexto: string;
  if (conceptoTotal === "Conforme" && perpConcepto === "Conforme") {
    analisisTexto =
      `Los resultados obtenidos evidencian que la coincidencia entre el campo luminoso y el campo de radiación cumple con los criterios de aceptación establecidos, ya que las desviaciones individuales fueron inferiores al 2 % y la desviación total fue de ${totalVarStr} %. Adicionalmente, la perpendicularidad del rayo central presentó una desviación angular menor o igual a 3°, por lo que la prueba se considera conforme.`;
  } else if (conceptoTotal === "No conforme" && perpConcepto === "Conforme") {
    analisisTexto =
      "Los resultados obtenidos evidencian incumplimiento en la coincidencia entre el campo luminoso y el campo de radiación, debido a que una o más desviaciones superaron las tolerancias establecidas. No obstante, la perpendicularidad del rayo central presentó una desviación angular menor o igual a 3°. Por lo anterior, la prueba se considera no conforme.";
  } else if (conceptoTotal === "Conforme" && perpConcepto === "No conforme") {
    analisisTexto =
      `Los resultados obtenidos evidencian que la coincidencia entre el campo luminoso y el campo de radiación cumple con los criterios de aceptación establecidos, con una desviación total de ${totalVarStr} %. Sin embargo, la perpendicularidad del rayo central presentó una desviación angular superior a 3°, por lo que la prueba se considera no conforme.`;
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
  ctx.addParagraph("Sin datos registrados para esta prueba.");
  return 6;
};

// Grupos 1, 2, 6: los tres tiempos nominales distintos (60kV/80kV/90kV)
const GRUPOS_TIEMPO_KV_CHR = new Set([1, 2, 6]);

function render24(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const principales = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1),
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
        nom.toFixed(5).replace(/\.?0+$/, ""),
        prom.toFixed(3),
        desv.toFixed(2) + " %",
        std.toFixed(5),
        cv.toFixed(2) + " %",
        desv <= 10 && cv <= 10 ? "Conforme" : "No conforme",
      ];
    });

  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.4.1. Registro de mediciones para la exactitud y repetibilidad del tiempo de exposición");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tiempo nominal (s)", "Tiempo promedio medido (s)", "Desviación máxima (%)", "Desviación estándar (s)", "CV (%)", "Concepto"]],
    body: rows,
    columnStyles: { 0: { cellWidth: 32 }, 5: { cellWidth: 24 } },
    didParseCell: colorearConcepto(5),
  });
  ctx.y = finalY(doc) + 4;

  ctx.addParagraph(
    "La exactitud del tiempo de exposición se evaluó mediante la desviación máxima porcentual entre el tiempo nominal seleccionado y el tiempo medido con mayor desviación.",
  );
  ctx.addParagraph(
    "La repetibilidad del sistema de temporización se evaluó mediante el coeficiente de variación (CV) calculado a partir de las mediciones repetidas para cada tiempo nominal.",
  );

  ctx.addSubsectionTitle("2.4.5.", "Análisis");
  const todosConformes = rows.every((r) => r[5] === "Conforme");
  const maxDv = Math.max(...rows.map((r) => parseFloat(r[2])));
  const maxCv = Math.max(...rows.map((r) => parseFloat(r[4])));
  if (todosConformes) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el tiempo de exposición medido presenta desviaciones máximas de hasta ${maxDv.toFixed(2)} % respecto al valor seleccionado. Asimismo, la repetibilidad de las mediciones presenta coeficientes de variación máximos de ${maxCv.toFixed(2)} %, lo que indica una adecuada estabilidad del sistema de temporización del generador de rayos X para los tiempos de exposición evaluados.`
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
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1),
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
        nom.toFixed(0),
        prom.toFixed(1),
        desv.toFixed(2) + " %",
        std.toFixed(2),
        cv.toFixed(2) + " %",
        desv <= 10 && cv <= 5 ? "Conforme" : "No conforme",
      ];
    });

  ctx.checkPage(40);
  addCaption(ctx, "Tabla 2.5.1. Registro de mediciones para la exactitud y repetibilidad de la tensión del tubo de rayos X");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tensión nominal (kV)", "Tensión promedio medida (kV)", "Desviación máxima (%)", "Desviación estándar (kV)", "CV (%)", "Concepto"]],
    body: rows,
    columnStyles: { 0: { cellWidth: 32 }, 5: { cellWidth: 24 } },
    didParseCell: colorearConcepto(5),
  });
  ctx.y = finalY(doc) + 4;

  ctx.addParagraph(
    "La exactitud de la tensión del tubo se evaluó mediante la desviación máxima porcentual entre la tensión nominal seleccionada y la tensión medida con mayor desviación.",
  );
  ctx.addParagraph(
    "La repetibilidad del sistema de generación de alta tensión se evaluó mediante el coeficiente de variación (CV) calculado a partir de las mediciones repetidas para cada valor de tensión nominal.",
  );

  ctx.addSubsectionTitle("2.5.5.", "Análisis");
  const todosConformes = rows.every((r) => r[5] === "Conforme");
  const maxDv = Math.max(...rows.map((r) => parseFloat(r[2])));
  const maxCv = Math.max(...rows.map((r) => parseFloat(r[4])));
  if (todosConformes) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que la tensión del tubo medida presenta desviaciones máximas de hasta ${maxDv.toFixed(2)} % respecto al valor seleccionado. Asimismo, la repetibilidad de las mediciones presenta coeficientes de variación máximos de ${maxCv.toFixed(2)} %, lo que indica una adecuada estabilidad en la respuesta del generador de rayos X para los valores de tensión evaluados.`
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
    (m) => m.tipo_medicion === "principal" && GRUPOS_TIEMPO_KV_CHR.has(m.grupo_numero ?? -1),
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
      return [kv.toFixed(0), chrProm.toFixed(1), String(chrMin), concepto];
    });

  ctx.checkPage(36);
  addCaption(ctx, "Tabla 2.6.1. Registro de mediciones para la capa hemirreductora del haz de rayos X");
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: ctx.y,
    head: [["Tensión nominal (kV)", "CHR promedio medida (mm Al)", "CHR mínima (mm Al)", "Concepto"]],
    body: rows,
    columnStyles: { 0: { cellWidth: 36 }, 3: { cellWidth: 28 } },
    didParseCell: colorearConcepto(3),
  });
  ctx.y = finalY(doc) + 4;

  ctx.addParagraph(
    "Para la evaluación del cumplimiento se compararon los valores medidos con los valores mínimos de referencia de capa hemirreductora correspondientes a cada nivel de tensión.",
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
    body: [["60", "1,8"], ["70", "2,1"], ["80", "2,3"], ["90", "2,5"]],
    columnStyles: { 0: { halign: "center" as const, cellWidth: 45 }, 1: { halign: "center" as const, cellWidth: 45 } },
    margin: { left: MARGIN + (170 - 90) / 2 },
  });
  ctx.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
}

function render27(ctx: InformeCtx, conv: DatosConvencional): number {
  const { doc, autoTable } = ctx;
  const shots80 = conv.raysafeMediciones.filter(
    (m) => m.tipo_medicion === "principal" && m.kv_nominal === 80 && m.dosis_medida_mgy != null,
  );

  ctx.addSubsectionTitle("2.7.4.", "Resultados");
  const distancia = conv.raysafeSetup?.distancia_foco_sensor_cm ?? 100;
  ctx.addParagraph(
    "La prueba se llevó a cabo bajo las siguientes condiciones de medición:\n" +
      `Tensión de referencia: 80 kVp\n` +
      `Distancia foco-detector: ${distancia} cm\n` +
      "Estimación del rendimiento: normalizado a 100 centímetros\n" +
      "Factor de corrección por presión y temperatura del analizador: 1,0",
  );
  ctx.addParagraph(
    "Las mediciones obtenidas se utilizaron para evaluar el valor del rendimiento del tubo de rayos X, " +
      "la repetibilidad de la radiación de salida y la linealidad del rendimiento con respecto al mAs.",
  );

  if (shots80.length === 0) return SIN_DATOS(ctx);

  // ── Tabla 2.7.1: Rendimiento y linealidad (grupos 2-5 a 80 kV) ──
  // Solo grupos 2–5 (variación de mAs a 80 kV); grupos 7–8 van a repetibilidad
  const GRUPOS_LIN = new Set([2, 3, 4, 5]);
  const gruposNum = new Map<number, typeof shots80>();
  for (const m of shots80) {
    if (m.grupo_numero == null || !GRUPOS_LIN.has(m.grupo_numero) || m.mas_nominal == null) continue;
    if (!gruposNum.has(m.grupo_numero)) gruposNum.set(m.grupo_numero, []);
    gruposNum.get(m.grupo_numero)!.push(m);
  }
  const gruposArr = [...gruposNum.entries()].sort(([a], [b]) => a - b);

  let linMaxPct = 0;
  let prevRend: number | null = null;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  ctx.checkPage(8);
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
        mas.toFixed(1),
        kermaProm.toFixed(3),
        rend.toFixed(1),
        linPct != null ? linPct.toFixed(2) + " %" : "-%",
      ];
    });

    ctx.checkPage(40);
    addCaption(ctx, "Tabla 2.7.1. Rendimiento del tubo de rayos X y linealidad");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [
        ["Exposición nominal (mAs)", "Kerma en aire promedio (mGy)", "Rendimiento (µGy/mAs)", "Linealidad (%)"],
      ],
      body: rowsLin,
      columnStyles: { 0: { cellWidth: 38 } },
    });
    ctx.y = finalY(doc) + 4;
  }

  ctx.addParagraph(
    "El rendimiento del tubo se calculó como el cociente entre el kerma en aire medido y la carga " +
      "utilizada (mAs). La linealidad se evaluó mediante la comparación del rendimiento obtenido " +
      "para los diferentes valores de carga.",
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  ctx.checkPage(8);
  doc.text("b) Evaluación de la repetibilidad de la radiación de salida", MARGIN, ctx.y);
  ctx.y += 6;

  ctx.addParagraph(
    "La repetibilidad se evaluó a partir de exposiciones repetidas bajo las mismas condiciones " +
      "de irradiación (80 kV y aproximadamente 10 mAs).",
  );

  if (repShots.length > 0) {
    const rowsIndiv: string[][] = repShots.map((m, i) => [String(i + 1), m.dosis_medida_mgy!.toFixed(4)]);

    ctx.checkPage(40);
    addCaption(ctx, "Tabla 2.7.2. Repetibilidad de la radiación de salida");
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: ctx.y,
      head: [["Medición", "Kerma en aire medido (mGy)"]],
      body: [
        ...rowsIndiv,
        ["Promedio", promRep.toFixed(4)],
        ["Desviación estándar (mGy)", stdRep.toFixed(4)],
        ["CV(%)", cvRep.toFixed(2) + " %"],
      ],
      columnStyles: {
        0: { cellWidth: 60, fontStyle: "bold", fillColor: COLOR_ALT_ROW },
      },
    });
    ctx.y = finalY(doc) + 4;
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

  if (conformeRep && conformeLin) {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el rendimiento del tubo de rayos X presenta valores entre ${rendMin.toFixed(1)} y ${rendMax.toFixed(1)} µGy/mAs para los diferentes valores de carga evaluados a 80 kV. La repetibilidad de la radiación de salida presenta un coeficiente de variación (CV) de ${cvRep.toFixed(2)} % y la linealidad del rendimiento presenta una desviación máxima de ${linMaxPct.toFixed(2)} %, ambos dentro de los criterios de aceptación establecidos.`,
    );
  } else {
    ctx.addParagraph(
      `Los resultados obtenidos evidencian que el rendimiento del tubo de rayos X presenta un CV de repetibilidad de ${cvRep.toFixed(2)} % y una linealidad máxima de ${linMaxPct.toFixed(2)} %. ` +
        (!conformeRep ? "La repetibilidad supera el criterio de aceptación del 5 %. " : "") +
        (!conformeLin ? "La linealidad supera el criterio de aceptación del 10 %. " : ""),
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
    default:
      return renderGenerico(ctx, codigo, conv);
  }
}
