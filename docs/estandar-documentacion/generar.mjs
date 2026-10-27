// Genera el PDF "Estándar de documentación de informes técnicos" para clientes.
// Uso: node docs/estandar-documentacion/generar.mjs
// Usa jsPDF y la misma estética del informe técnico (Helvetica, colores, portada con tarjetas).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const require = createRequire(resolve(ROOT, "package.json"));
const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");

const VERSION = "1.0";
const FECHA = "Octubre de 2026";
const SALIDA = resolve(HERE, "Estandar_Documentacion_Informes_Sievert.pdf");
const LOGO =
  "data:image/png;base64," + readFileSync(resolve(ROOT, "public/logo-informe.png")).toString("base64");

// ─── Estilo del informe (colores y fuente sin cambios) ───
const COLOR_PRIMARY = [51, 65, 85];
const COLOR_HEADER_BG = [241, 245, 249];
const COLOR_GRAY = [100, 116, 139];
const COLOR_BLACK = [30, 30, 30];
const COLOR_ALT_ROW = [248, 250, 252];
const COLOR_OK = [16, 150, 80];

// ─── Reglas de formato ───
const PT = 25.4 / 72;
const HELV = 1.149;
const mm = (pt) => pt * PT;
const PAGE_W = 210;
const M = { top: 22.5, bottom: 18, left: 21, right: 20 };
const CW = PAGE_W - M.left - M.right;
const BOTTOM = 297 - M.bottom;
const FONT = {
  coverTitle: 22,
  h1: 13,
  h2: 11,
  h3: 9.5,
  body: 9,
  tableCaption: 8.5,
  table: 8.5,
  figureCaption: 8.5,
  headerFooter: 8,
};
const LINE_H = mm(FONT.body * HELV * 1.12);
const SPACE = {
  h1: [mm(12), mm(6)],
  h2: [mm(9), mm(4)],
  h3: [mm(6), mm(3)],
  body: [0, mm(6)],
  tableCaption: [mm(8), mm(4)],
  table: [0, mm(8)],
  figureCaption: [mm(4), mm(8)],
};
const asc = (size) => size * PT * 0.72;

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const toc = [];
let y = 0;

function header() {
  doc.addImage(LOGO, "PNG", M.left, 8, 35, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT.headerFooter);
  doc.setTextColor(...COLOR_GRAY);
  doc.text("Estándar de documentación de informes técnicos", PAGE_W - M.right, 12, { align: "right" });
  doc.text("Sievert Protección Radiológica S.A.S.", PAGE_W - M.right, 12 + mm(8 * HELV), {
    align: "right",
  });
}
function nuevaPagina() {
  doc.addPage();
  header();
  y = M.top;
}
function checkPage(needed) {
  if (y + needed > BOTTOM) nuevaPagina();
}

function titulo(text, nivel, { registrar = true, after } = {}) {
  const size = nivel === 1 ? FONT.h1 : FONT.h2;
  const [before, afterDef] = nivel === 1 ? SPACE.h1 : SPACE.h2;
  const lineH = mm(size * HELV);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, CW);
  checkPage(before + lines.length * lineH + 20);
  y += before;
  const base = y + asc(size);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(lines, M.left, base, { lineHeightFactor: HELV });
  const ruleY = base + (lines.length - 1) * lineH + 2;
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(nivel === 1 ? 0.5 : 0.3);
  doc.line(M.left, ruleY, M.left + CW, ruleY);
  y = ruleY + (after ?? afterDef);
  if (registrar) toc.push({ text, nivel, pagina: doc.getNumberOfPages() });
}

// keepWith: alto del contenido que debe quedar en la misma página que el título
function titulo3(text, keepWith = 14) {
  const [before, after] = SPACE.h3;
  checkPage(before + keepWith);
  y += before;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT.h3);
  doc.setTextColor(...COLOR_BLACK);
  doc.text(text, M.left, y + asc(FONT.h3));
  y += mm(FONT.h3 * HELV) + after;
}

function parrafo(text, { indent = 0, color = COLOR_BLACK } = {}) {
  const width = CW - indent;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT.body);
  const lines = doc.splitTextToSize(text, width);
  checkPage(lines.length * LINE_H + SPACE.body[1]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT.body);
  doc.setTextColor(...color);
  const x0 = M.left + indent;
  const sp = doc.getTextWidth(" ");
  const y0 = y + asc(FONT.body);
  lines.forEach((line, i) => {
    const ly = y0 + i * LINE_H;
    const words = line.split(" ").filter(Boolean);
    const extra = words.length > 1 ? (width - doc.getTextWidth(line)) / (words.length - 1) : 0;
    if (i === lines.length - 1 || words.length < 3 || extra > sp * 3) {
      doc.text(line, x0, ly);
      return;
    }
    let cx = x0;
    words.forEach((w) => {
      doc.text(w, cx, ly);
      cx += doc.getTextWidth(w) + sp + extra;
    });
  });
  y += lines.length * LINE_H + SPACE.body[1];
}

// Lista numerada con sangría francesa
function lista(items) {
  items.forEach((t, i) => {
    const yAntes = y;
    parrafo(t, { indent: 6 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT.body);
    doc.setTextColor(...COLOR_BLACK);
    // si el ítem saltó de página, el número va arriba de la página nueva
    const yItem = y < yAntes ? M.top : yAntes;
    doc.text(`${i + 1}.`, M.left, yItem + asc(FONT.body));
  });
}

function leyendaTabla(text) {
  const [before, after] = SPACE.tableCaption;
  checkPage(before + 25);
  y += before;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT.tableCaption);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(text, M.left, y + asc(FONT.tableCaption));
  y += mm(FONT.tableCaption * HELV) + after;
}

function tabla(head, body, columnStyles = {}, didParseCell) {
  autoTable(doc, {
    theme: "grid",
    startY: y,
    margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
    head: head ? [head] : undefined,
    body,
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: FONT.table,
    },
    bodyStyles: { fontSize: FONT.table, textColor: COLOR_BLACK },
    alternateRowStyles: { fillColor: COLOR_ALT_ROW },
    columnStyles,
    didParseCell,
    willDrawPage: (d) => d.pageNumber > 1 && header(),
  });
  y = doc.lastAutoTable.finalY + SPACE.table[1];
}

function tablaKV(body) {
  tabla(null, body, {
    0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
    1: { cellWidth: CW - 60 },
  });
}

function figura(text) {
  const [before, after] = SPACE.figureCaption;
  const w = 90;
  const h = 40;
  checkPage(h + before + 8 + after);
  const x = M.left + (CW - w) / 2;
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text("[ fotografía / diagrama ]", x + w / 2, y + h / 2, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(FONT.figureCaption);
  const lines = doc.splitTextToSize(text, CW);
  doc.text(lines, M.left + CW / 2, y + h + before + asc(FONT.figureCaption), { align: "center" });
  y += h + before + lines.length * mm(FONT.figureCaption * HELV) + after;
}

function veredicto(text) {
  checkPage(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_OK);
  doc.text(text, PAGE_W / 2, y + asc(14), { align: "center" });
  y += 10;
}

const colsRegla = (w0 = 42) => ({ 0: { cellWidth: w0, fontStyle: "bold" } });

// ═══════════════════════════ PORTADA ═══════════════════════════
doc.setFillColor(...COLOR_PRIMARY);
doc.rect(0, 0, PAGE_W, 3, "F");
doc.addImage(LOGO, "PNG", M.left, 8, 55, 18);
y = 35;
doc.setFont("helvetica", "bold");
doc.setFontSize(10);
doc.setTextColor(...COLOR_GRAY);
doc.text("Documento técnico:", M.left, y);
y += 6 + asc(FONT.coverTitle) - asc(10);
doc.setFontSize(FONT.coverTitle);
doc.setTextColor(...COLOR_PRIMARY);
doc.splitTextToSize("ESTÁNDAR DE DOCUMENTACIÓN DE INFORMES TÉCNICOS", CW).forEach((t) => {
  doc.text(t, M.left, y);
  y += mm(FONT.coverTitle * HELV);
});
y += 3;
doc.setFontSize(10);
doc.setTextColor(...COLOR_BLACK);
for (const [k, v] of [
  ["Versión:", VERSION],
  ["Fecha:", FECHA],
]) {
  doc.setFont("helvetica", "bold");
  doc.text(k, M.left, y);
  doc.setFont("helvetica", "normal");
  doc.text(v, M.left + 40, y);
  y += 6;
}
function tarjeta(tituloTarjeta, filas) {
  doc.setFontSize(9);
  const anchoValor = CW - 55 - 5;
  const medidas = filas.map(([k, v]) => [k, doc.splitTextToSize(v, anchoValor)]);
  const h = 20 + medidas.reduce((a, [, l]) => a + l.length * 5, 0);
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.roundedRect(M.left, y, CW, h, 2, 2, "F");
  let cy = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(tituloTarjeta, M.left + 5, cy);
  cy += 6;
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  for (const [k, l] of medidas) {
    doc.setFont("helvetica", "bold");
    doc.text(k, M.left + 5, cy);
    doc.setFont("helvetica", "normal");
    doc.text(l, M.left + 55, cy);
    cy += l.length * 5;
  }
  y += h;
}
y += 6;
tarjeta("Información del documento", [
  ["Emitido por:", "Sievert Protección Radiológica S.A.S."],
  ["Aplica a:", "Informes técnicos de control de calidad y estudio ambiental (FT-LEC-6c)"],
  ["Formato de entrega:", "PDF, tamaño A4, generado por el sistema de información de Sievert"],
  ["Sitio web:", "www.sievert.com.co"],
  ["Correo:", "coord.estudiosycontroles@sievert.com.co"],
  ["Teléfono:", "316 523 6658"],
]);
y += 14;
// Tarjeta de propósito: un párrafo en lugar de pares clave/valor
{
  doc.setFontSize(9);
  const texto = doc.splitTextToSize(
    "Este documento describe las reglas de formato y estructura que aplican a todos los informes técnicos emitidos por Sievert, con el fin de garantizar documentos consistentes, legibles y verificables, independientemente del equipo evaluado o del profesional que genere el informe.",
    CW - 10
  );
  const h = 20 + texto.length * 5;
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.roundedRect(M.left, y, CW, h, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Propósito", M.left + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text(texto, M.left + 5, y + 13, { lineHeightFactor: 5 / (9 * PT) });
  y += h;
}

// ═══════════════════════════ CUERPO ═══════════════════════════
nuevaPagina();
titulo("1. OBJETO Y ALCANCE", 1);
parrafo(
  "El presente documento establece el estándar de documentación de los informes técnicos emitidos por Sievert Protección Radiológica S.A.S., en particular del informe de control de calidad y estudio ambiental en unidades de radiografía general (FT-LEC-6c)."
);
parrafo(
  "El estándar define el formato de página, los márgenes, la tipografía, el interlineado, el espaciado entre elementos, la presentación de tablas y figuras, la estructura de contenido y los elementos de identificación y control de cada informe. Estas reglas se aplican de forma automática por el sistema de generación de informes: ningún informe requiere ajustes manuales de formato, lo que garantiza que todos los documentos se presenten de manera uniforme."
);

titulo("2. ESTRUCTURA DEL INFORME", 1);
parrafo("Todo informe técnico se organiza en las siguientes secciones, en este orden:");
leyendaTabla("Tabla 2.1. Secciones del informe técnico");
tabla(
  ["Sección", "Contenido"],
  [
    ["Portada", "Tipo de informe, número, fecha, versión, identificación de la instalación y de la unidad evaluada, y vigencia del informe."],
    ["Contenido", "Tabla de contenido generada automáticamente con el número de página de cada sección y de cada prueba."],
    ["Introducción", "Marco normativo y metodológico del informe."],
    ["1. Información de la práctica", "Datos generales de la institución, datos de la instalación y características del equipo evaluado."],
    ["2. Pruebas de control de calidad", "Una subsección por cada prueba realizada (ver Tabla 2.2)."],
    ["3. Resumen de resultados", "Consolidado del concepto obtenido en cada prueba."],
    ["4. Concepto", "Concepto general del desempeño del equipo evaluado."],
    ["5. Firmas", "Responsables del informe y de la visita."],
  ],
  colsRegla(50)
);
parrafo("Cada prueba de control de calidad se documenta con la misma estructura interna:");
leyendaTabla("Tabla 2.2. Estructura de cada prueba");
tabla(
  ["Apartado", "Contenido"],
  [
    ["Objetivo", "Propósito de la prueba."],
    ["Instrumentación", "Equipos e instrumentos de medición empleados."],
    ["Metodología", "Procedimiento aplicado para realizar la prueba."],
    ["Resultados", "Valores medidos, presentados en tablas y, cuando aplica, figuras."],
    ["Análisis", "Interpretación de los resultados frente a los valores de referencia."],
    ["Criterio de aceptación", "Tolerancia o nivel de referencia aplicable a la prueba."],
    ["Concepto", "Resultado de la prueba: Conforme / No conforme (o Favorable / No favorable)."],
    ["Acciones correctivas", "Recomendaciones cuando la prueba no cumple el criterio de aceptación."],
  ],
  colsRegla(50)
);
parrafo(
  "Cuando una prueba no aplica al equipo evaluado, se indica expresamente en la metodología el motivo y se registra \"No aplica\" en los apartados restantes."
);

titulo("3. FORMATO DE PÁGINA Y MÁRGENES", 1);
leyendaTabla("Tabla 3.1. Formato de página");
tabla(
  ["Parámetro", "Valor", "Regla"],
  [
    ["Tamaño de página", "A4", "21,0 x 29,7 cm, orientación vertical."],
    ["Margen superior", "2,25 cm", "El encabezado se ubica dentro de este margen."],
    ["Margen inferior", "1,80 cm", "El pie de página se ubica dentro de este margen."],
    ["Margen izquierdo", "2,10 cm", "Todo el contenido se alinea a este margen."],
    ["Margen derecho", "2,00 cm", "Ancho útil de contenido: 16,9 cm."],
  ],
  { ...colsRegla(), 1: { cellWidth: 26, halign: "center" } }
);

titulo("4. TIPOGRAFÍA", 1);
parrafo(
  "Todo el informe utiliza una única familia tipográfica, Helvetica, sin mezclar fuentes. Cada elemento tiene un tamaño fijo que el sistema aplica automáticamente según su función dentro del documento."
);
leyendaTabla("Tabla 4.1. Tamaños de letra por elemento");
tabla(
  ["Elemento", "Tamaño", "Ejemplo"],
  [
    ["Título de portada", "22 pt", "Nombre del informe en la portada."],
    ["Título 1", "13 pt", "Secciones principales: INTRODUCCIÓN, 1. INFORMACIÓN DE LA PRÁCTICA."],
    ["Título 2", "11 pt", "Cada prueba: 2.1 Evaluación de las condiciones ambientales."],
    ["Título 3", "9,5 pt", "Apartados de una prueba: Objetivo, Metodología, Resultados."],
    ["Cuerpo de texto", "9 pt", "Párrafos del informe."],
    ["Leyenda de tabla", "8,5 pt", "Tabla 2.1.1. Registro de lecturas..."],
    ["Encabezado y cuerpo de tabla", "8,5 pt", "Títulos de columna y datos. Mínimo 7,5 pt solo en tablas muy anchas."],
    ["Leyenda de figura", "8,5 pt", "Fig. 2.1.1. Plano de la instalación..."],
    ["Encabezado y pie de página", "8 pt", "Identificación del informe y paginación."],
    ["Tabla de contenido", "13 / 9 pt", "Título CONTENIDO / entradas."],
  ],
  { ...colsRegla(), 1: { cellWidth: 22, halign: "center" } }
);

titulo("5. INTERLINEADO Y ESPACIADO", 1);
parrafo(
  "El cuerpo de texto se presenta justificado, con interlineado de 1,12. Los títulos de más de una línea usan interlineado sencillo. La separación superior e inferior de cada elemento es constante en todo el informe, lo que permite reconocer la jerarquía del contenido de un vistazo."
);
leyendaTabla("Tabla 5.1. Espaciado vertical");
tabla(
  ["Elemento", "Espacio superior", "Espacio inferior"],
  [
    ["Título 1", "12 pt", "6 pt"],
    ["Título 2", "9 pt", "4 pt"],
    ["Título 3", "6 pt", "3 pt"],
    ["Párrafo de cuerpo", "0 pt", "6 pt"],
    ["Leyenda de tabla", "8 pt", "4 pt"],
    ["Tabla", "-", "8 pt"],
    ["Leyenda de figura", "4 pt", "8 pt"],
  ],
  { ...colsRegla(60), 1: { halign: "center" }, 2: { halign: "center" } }
);

titulo("6. TABLAS Y FIGURAS", 1);
lista([
  "Toda tabla de resultados va precedida de una leyenda numerada según la prueba a la que pertenece (por ejemplo, Tabla 2.1.1).",
  "Las tablas que continúan en otra página repiten automáticamente la fila de encabezado, y ninguna fila se divide entre dos páginas.",
  "Los textos descriptivos se alinean a la izquierda, los datos numéricos a la derecha y los conceptos y códigos al centro.",
  "Los conceptos Conforme / Favorable se resaltan en verde y No conforme / No favorable en rojo; el color se usa únicamente para comunicar el resultado.",
  "Toda figura o fotografía lleva una leyenda numerada y centrada debajo de ella, y ambas se mantienen en la misma página.",
]);

titulo("7. TABLA DE CONTENIDO", 1);
lista([
  "Se ubica inmediatamente después de la portada, en página independiente, y se genera automáticamente.",
  "Incluye únicamente las secciones principales (Título 1) y las pruebas (Título 2), con su número de página.",
  "No incluye los apartados internos de cada prueba (Objetivo, Instrumentación, Metodología, Resultados, Análisis, Criterio de aceptación).",
  "Si su extensión lo requiere, continúa en la página siguiente sin reducir el tamaño de letra.",
]);

titulo("8. PAGINACIÓN", 1);
lista([
  "El tamaño de letra del cuerpo y de las tablas nunca se reduce para hacer caber contenido en una página: el número de páginas crece de forma natural.",
  "Un título nunca queda como última línea de una página; se mantiene junto con el inicio de su contenido.",
  "El concepto de cada prueba se mantiene junto a su resultado.",
]);

titulo("9. IDENTIFICACIÓN Y CONTROL DEL DOCUMENTO", 1);
leyendaTabla("Tabla 9.1. Elementos de identificación");
tabla(
  ["Elemento", "Descripción"],
  [
    ["Encabezado", "Desde la página 2: logo de Sievert, tipo de informe con marca y modelo del equipo, e institución."],
    ["Pie de página", "Código documental FT-LEC-6c, versión del informe, fecha de generación y paginación (Página X de Y), junto con los datos de contacto: sitio web, correo y teléfono."],
    ["Número de informe", "Identificador único del informe, visible en la portada."],
    ["Versión", "Cada reemisión del informe incrementa su número de versión."],
    ["Pre-informe", "Mientras el informe no es oficial, todas sus páginas llevan la marca de agua PRE-INFORME."],
    ["Informe oficial", "Lleva el sello de agua de Sievert y un código QR en la portada para verificar su autenticidad."],
    ["Vigencia", "Dos (2) años contados a partir de la fecha de emisión, conforme a la Resolución 1811 de 2025."],
  ],
  colsRegla(40)
);

titulo("10. MARCO DE REFERENCIA", 1);
parrafo(
  "Los informes técnicos se elaboran en cumplimiento de la Resolución 1811 de 2025 del Ministerio de Salud y Protección Social y demás disposiciones vigentes en materia de protección radiológica. Las pruebas de control de calidad siguen los lineamientos del documento IAEA-TECDOC-1958: Protocolos de Control de Calidad para Radiodiagnóstico en América Latina y el Caribe."
);

// ═══════════════════════════ ANEXO: EJEMPLO ═══════════════════════════
nuevaPagina();
titulo("ANEXO A. EJEMPLO DE PÁGINAS DEL INFORME", 1);
parrafo(
  "Las páginas siguientes muestran, con datos ilustrativos, cómo se aplican las reglas de este estándar en un informe técnico.",
  { color: COLOR_GRAY }
);
const tocAntes = toc.length;
titulo("1. INFORMACIÓN DE LA PRÁCTICA", 1, { registrar: false });
titulo3("Datos Generales");
tablaKV([
  ["Fecha de Informe", "14 de agosto de 2026"],
  ["Nombre de la Institución", "Institución de ejemplo S.A.S."],
  ["Sede de ubicación de la unidad de RX", "Sede principal"],
  ["Nombre del Servicio", "Radiología"],
  ["Responsable de la Visita", "Nombre Apellido"],
]);
titulo3("Datos de la Instalación e Identificación del Equipo");
tablaKV([
  ["Marca", "Marca"],
  ["Modelo", "Modelo"],
  ["Sistema de adquisición", "Digital"],
  ["Filtración inherente", "1,3 mm Al"],
]);
nuevaPagina();
titulo("2. PRUEBAS DE CONTROL DE CALIDAD EN RADIOLOGÍA GENERAL", 1, { registrar: false });
titulo("2.1 Evaluación de las condiciones ambientales y descripción de blindajes", 2, {
  registrar: false,
});
titulo3("2.1.1. Objetivo");
parrafo(
  "Realizar el levantamiento radiométrico para evaluar las condiciones ambientales del servicio en términos de protección radiológica y verificar los niveles de exposición ocupacional y del público."
);
titulo3("2.1.2. Instrumentación");
parrafo(
  "Sistema dosimétrico calibrado para mediciones en protección radiológica, material equivalente simulador de radiación dispersa y cinta métrica."
);
titulo3("2.1.3. Metodología");
parrafo(
  "Las mediciones se realizan en puntos representativos de la instalación, posicionando un simulador de dispersión en la ubicación habitual del paciente y utilizando una técnica radiográfica alta dentro del rango clínico."
);
titulo3("2.1.4. Resultados");
leyendaTabla("Tabla 2.1.1. Registro de lecturas de tasa de dosis equivalente ambiental H*(10)");
tabla(
  ["Sitio", "Punto de Medición", "Lectura (mSv/h)"],
  [
    ["1", "Puerta de entrada cuarto de disparo", "0,00300"],
    ["2", "Ventana cuarto de disparo", "0,00110"],
    ["3", "Pared cuarto de disparo", "0,00210"],
    ["4", "Entrada general / camillas", "0,00550"],
  ],
  { 0: { cellWidth: 14, halign: "center" }, 2: { halign: "right" } }
);
figura("Fig. 2.1.1. Plano de la instalación con la ubicación de los puntos de medición");
titulo3("2.1.5. Análisis");
parrafo(
  "Las lecturas obtenidas se utilizaron para estimar la dosis equivalente anual en los puntos evaluados, considerando la carga de trabajo del equipo, el factor de uso del haz y el factor de ocupación de cada área."
);
leyendaTabla("Tabla 2.1.2. Cálculo de la dosis equivalente anual (mSv/año)");
tabla(
  ["Sitio", "Punto de medición", "Dosis anual (mSv/año)", "Tipo de área", "Concepto"],
  [
    ["1", "Puerta de entrada cuarto de disparo", "0,009479", "Supervisada", "Conforme"],
    ["2", "Ventana cuarto de disparo", "0,006951", "Supervisada", "Conforme"],
    ["3", "Pared cuarto de disparo", "0,006635", "Supervisada", "Conforme"],
  ],
  { 0: { cellWidth: 14, halign: "center" }, 2: { halign: "right" }, 4: { halign: "center" } },
  (d) => {
    if (d.section === "body" && d.column.index === 4) {
      d.cell.styles.textColor = COLOR_OK;
      d.cell.styles.fontStyle = "bold";
    }
  }
);
titulo3("2.1.6. Concepto", 20);
veredicto("FAVORABLE");
toc.length = tocAntes;

// ═══════════════════════════ CONTENIDO ═══════════════════════════
doc.insertPage(2);
doc.setPage(2);
header();
y = M.top;
titulo("CONTENIDO", 1, { registrar: false, after: mm(12) });
for (const e of toc) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text(e.text, M.left, y + asc(9));
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(String(e.pagina + 1), M.left + CW, y + asc(9), { align: "right" });
  y += 7.5;
}

// ═══════════════════════════ PIE ═══════════════════════════
const CONTACTOS = [
  ["web", "www.sievert.com.co"],
  ["correo", "coord.estudiosycontroles@sievert.com.co"],
  ["telefono", "316 523 6658"],
];
const ICONO = 2.4;

function icono(tipo, x, top, s) {
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.2);
  if (tipo === "web") {
    const r = s / 2;
    doc.circle(x + r, top + r, r, "S");
    doc.ellipse(x + r, top + r, r * 0.45, r, "S");
    doc.line(x, top + r, x + s, top + r);
  } else if (tipo === "correo") {
    const yTop = top + s * 0.15;
    const h = s * 0.7;
    doc.rect(x, yTop, s, h, "S");
    doc.line(x, yTop, x + s / 2, yTop + h * 0.55);
    doc.line(x + s / 2, yTop + h * 0.55, x + s, yTop);
  } else {
    doc.roundedRect(x + s * 0.2, top, s * 0.6, s, 0.3, 0.3, "S");
    doc.line(x + s * 0.42, top + s * 0.83, x + s * 0.58, top + s * 0.83);
  }
}

function contactos(baseline) {
  const anchos = CONTACTOS.map(([, t]) => ICONO + 1.2 + doc.getTextWidth(t));
  let x = (PAGE_W - anchos.reduce((a, b) => a + b, 0) - 6 * (CONTACTOS.length - 1)) / 2;
  CONTACTOS.forEach(([tipo, t], i) => {
    icono(tipo, x, baseline - 2.2, ICONO);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(t, x + ICONO + 1.2, baseline);
    x += anchos[i] + 6;
  });
}

const total = doc.getNumberOfPages();
for (let i = 1; i <= total; i++) {
  doc.setPage(i);
  doc.setDrawColor(...COLOR_GRAY);
  doc.setLineWidth(0.1);
  doc.line(M.left, 286.5, PAGE_W - M.right, 286.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT.headerFooter);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(`Estándar de documentación | Versión ${VERSION}`, M.left, 289.4);
  doc.text(`Página ${i} de ${total}`, PAGE_W - M.right, 289.4, { align: "right" });
  contactos(293.6);
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 295, PAGE_W, 2, "F");
}

doc.setProperties({
  title: "Estándar de documentación de informes técnicos",
  author: "Sievert Protección Radiológica S.A.S.",
});
writeFileSync(SALIDA, Buffer.from(doc.output("arraybuffer")));
console.log(SALIDA, total, "páginas");
