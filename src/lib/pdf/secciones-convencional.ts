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
  /** Imagen del plano radiométrico (2.1) como dataURL, si existe */
  planoRadiometrico?: { dataUrl: string; width: number; height: number };
  /** Fotografías de la 2.2 (equipo, consola, avisos, elementos) para la sección 2.2.8 */
  fotos22?: { label: string; dataUrl: string; width: number; height: number }[];
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
  const [secciones, setup, mediciones, inspeccion, elementos, resultadosArr, evidencias] =
    await Promise.all([
      db.conv_informe_secciones.where("visita_id").equals(visitaId).sortBy("orden"),
      db.conv_levantamiento_setup.where("visita_id").equals(visitaId).first(),
      db.conv_mediciones.where("visita_id").equals(visitaId).sortBy("punto_numero"),
      db.conv_inspeccion_items.where("visita_id").equals(visitaId).toArray(),
      db.conv_elementos_proteccion.where("visita_id").equals(visitaId).toArray(),
      db.conv_resultados_prueba.where("visita_id").equals(visitaId).toArray(),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
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

  return {
    secciones: seccionesEfectivas,
    setup,
    mediciones,
    inspeccion,
    elementos,
    resultados: new Map(resultadosArr.map((r) => [r.prueba_codigo, r])),
    planoRadiometrico: await cargarImagen(planoEv),
    fotos22,
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
    default:
      return renderGenerico(ctx, codigo, conv);
  }
}
