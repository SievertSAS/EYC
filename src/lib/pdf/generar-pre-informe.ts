import type { jsPDF } from "jspdf";
import { db } from "@/lib/db";
import type {
  VisitaEjecucion,
  Equipo,
  UbicacionRx,
  Sede,
  Cliente,
  Tubo,
  SalaDimensiones,
  Usuario,
  Contacto,
  PruebaResultado,
  PruebaDefinicion,
  MedicionRadiometrica,
  ElementoProteccion,
  ParteEquipo,
} from "@/lib/db/types";
import { hasPackage } from "@/lib/equipos/registry";
import { getCatalogoSeccion } from "@/lib/equipos/convencional/informe-secciones";
import {
  recopilarDatosConv,
  renderResultadosSeccion,
  renderDiagramaRadiometrico,
  type InformeCtx,
} from "./secciones-convencional";

let _logoCache: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (_logoCache) return _logoCache;
  const res = await fetch("/logo-informe.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      _logoCache = reader.result as string;
      resolve(_logoCache);
    };
    reader.readAsDataURL(blob);
  });
}

// ─── Tipos internos ───

interface DatosInforme {
  visita: VisitaEjecucion;
  equipo?: Equipo;
  ubicacion?: UbicacionRx;
  sede?: Sede;
  cliente?: Cliente;
  tubo?: Tubo;
  sala?: SalaDimensiones;
  tecnico?: Usuario;
  contactos: Contacto[];
  pruebas: (PruebaResultado & { definicion?: PruebaDefinicion })[];
  mediciones: MedicionRadiometrica[];
  elementos: ElementoProteccion[];
  partes: ParteEquipo[];
}

// ─── Constantes de estilo ───

const COLOR_PRIMARY: [number, number, number] = [51, 65, 85];
const COLOR_HEADER_BG: [number, number, number] = [241, 245, 249];
const COLOR_GRAY: [number, number, number] = [100, 116, 139];
const COLOR_BLACK: [number, number, number] = [30, 30, 30];
const COLOR_ALT_ROW: [number, number, number] = [248, 250, 252];
const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 22;

// ============================================================
//  Recopilar todos los datos de la visita
// ============================================================

async function recopilarDatos(visitaId: number): Promise<DatosInforme | null> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return null;

  const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
  const ubicacion = visita.ubicacion_id
    ? await db.ubicaciones_rx.get(visita.ubicacion_id)
    : undefined;
  const solicitud = await db.solicitudes.get(visita.solicitud_id);
  const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
  const sede = ubicacion
    ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? 0)
    : undefined;
  const tubo = visita.equipo_id
    ? await db.tubos.where("equipo_id").equals(visita.equipo_id).first()
    : undefined;
  const sala = visita.ubicacion_id
    ? await db.sala_dimensiones.where("ubicacion_id").equals(visita.ubicacion_id).first()
    : undefined;
  const tecnico = visita.tecnico_id ? await db.usuarios.get(visita.tecnico_id) : undefined;

  // Contactos del cliente
  const contactos = cliente?.id
    ? await db.contactos.where("cliente_id").equals(cliente.id).toArray()
    : [];

  // Pruebas con definiciones
  const resultados = await db.prueba_resultados.where("visita_id").equals(visitaId).toArray();
  const definiciones = await db.prueba_definiciones.toArray();
  const defMap = new Map(definiciones.map((d) => [d.id!, d]));
  const pruebas = resultados.map((r) => ({
    ...r,
    definicion: defMap.get(r.prueba_definicion_id),
  }));
  pruebas.sort(
    (a, b) => (a.definicion?.orden_sugerido ?? 99) - (b.definicion?.orden_sugerido ?? 99)
  );

  // Mediciones
  const mediciones = await db.mediciones_radiometricas
    .where("visita_id")
    .equals(visitaId)
    .sortBy("punto_numero");

  // Elementos de protección
  const elementos = await db.elementos_proteccion.where("visita_id").equals(visitaId).toArray();

  // Partes del equipo
  const partes = visita.equipo_id
    ? await db.partes_equipo.where("equipo_id").equals(visita.equipo_id).toArray()
    : [];

  return {
    visita,
    equipo,
    ubicacion,
    sede,
    cliente,
    tubo,
    sala,
    tecnico,
    contactos,
    pruebas,
    mediciones,
    elementos,
    partes,
  };
}

// ============================================================
//  Textos del TECDOC por código de prueba
// ============================================================

interface TextoPrueba {
  objetivo: string;
  instrumentacion: string;
  metodologia: string;
  criterio: string;
}

function getTextoPrueba(codigo: string): TextoPrueba {
  const textos: Record<string, TextoPrueba> = {
    LEV: {
      objetivo:
        "Realizar el levantamiento radiométrico para evaluar las condiciones ambientales del servicio en términos de protección radiológica y verificar los niveles de exposición ocupacional y del público.",
      instrumentacion:
        "Sistema dosimétrico calibrado para mediciones en protección radiológica (cámara de ionización o detector de estado sólido), material equivalente simulador de radiación dispersa y cinta métrica.",
      metodologia:
        "Se realizó el levantamiento radiométrico mediante mediciones de radiación dispersa en puntos representativos del área donde se encuentra instalado el equipo de radiología general. Las mediciones se efectuaron utilizando una cámara de ionización o un detector de estado sólido calibrado en términos de dosis equivalente ambiental H*(10), posicionando un simulador de dispersión en la ubicación habitual del paciente durante la exposición, aplicando la técnica máxima utilizada en la práctica clínica.",
      criterio:
        "Los resultados se consideran aceptables cuando la dosis anual estimada se encuentra por debajo de los niveles de restricción, correspondientes a 5,0 mSv/año para áreas controladas y 0,5 mSv/año para áreas supervisadas, conforme a los criterios de protección radiológica aplicables.",
    },
    INS: {
      objetivo:
        "Verificar mediante inspección visual el estado físico y las condiciones de seguridad del equipo de radiografía general y de su instalación, con el fin de identificar posibles deterioros, defectos mecánicos o condiciones que puedan afectar la protección radiológica del operador, los pacientes o el público.",
      instrumentacion:
        "Inspección visual directa del equipo y de la instalación, utilizando herramientas básicas de verificación cuando aplica.",
      metodologia:
        "Se realizó una inspección visual del equipo y de las condiciones de operación de la instalación mediante una lista de verificación basada en los lineamientos del IAEA-TECDOC-1958 y en los criterios de seguridad aplicables a equipos de radiología general.",
      criterio:
        "La inspección visual se considera aceptable cuando los componentes visibles del equipo y las condiciones de operación de la instalación se encuentran en buen estado físico, sin deterioros, fugas o defectos que puedan comprometer la protección radiológica del operador, los pacientes o el público.",
    },
    COL: {
      objetivo:
        "Evaluar la desviación entre el campo luminoso y el campo real de radiación y la perpendicularidad del eje central del haz de radiación con relación al plano del receptor de imagen.",
      instrumentacion:
        "Detector CR o DR, dispositivo de verificación de colimación y alineación del rayo central y cinta métrica.",
      metodologia:
        "Se ubicó el dispositivo de verificación de colimación sobre el receptor de imagen y se ajustó el campo luminoso de manera que coincidiera con las marcas de referencia del objeto de prueba. Posteriormente, se realizó una exposición radiográfica con una técnica adecuada para visualizar el campo irradiado y la posición del rayo central.",
      criterio:
        "La desviación entre el campo luminoso y el campo de radiación no debe exceder el 2 % de la distancia foco-receptor en cada borde ni el 4 % en total. La perpendicularidad del rayo central debe presentar una desviación angular ≤ 3°.",
    },
    TIE: {
      objetivo:
        "Evaluar la exactitud y la repetibilidad del indicador del tiempo de exposición del generador de rayos X.",
      instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
      metodologia:
        "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. Se seleccionó una combinación representativa de tensión y corriente del generador y se realizaron al menos tres exposiciones para un tiempo de exposición determinado.",
      criterio:
        "La desviación entre el tiempo de exposición seleccionado y el tiempo medido no debe exceder ±10 %. La repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) ≤ 10 %.",
    },
    KVP: {
      objetivo:
        "Evaluar la exactitud y la repetibilidad del indicador de la tensión del tubo de rayos X del generador.",
      instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
      metodologia:
        "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación. Se seleccionaron al menos tres valores representativos de tensión del tubo de rayos X y se realizaron al menos tres exposiciones para cada valor seleccionado, registrando la tensión medida en cada irradiación.",
      criterio:
        "La desviación entre la tensión seleccionada y la tensión medida no debe exceder ±10 %. La repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) ≤ 5 %.",
    },
    CHR: {
      objetivo:
        "Verificar si el valor de la capa hemirreductora está de acuerdo con los requisitos mínimos.",
      instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
      metodologia:
        "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación. Se realizaron exposiciones utilizando valores representativos de tensión del tubo de rayos X, registrando la capa hemirreductora (CHR) reportada por el analizador para cada condición de irradiación.",
      criterio:
        "La capa hemirreductora del haz de rayos X debe ser igual o mayor que los valores mínimos de referencia establecidos para cada nivel de tensión del tubo.",
    },
    REN: {
      objetivo:
        "Evaluar el valor, la repetibilidad y la linealidad del rendimiento del tubo de rayos X.",
      instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
      metodologia:
        "Se posicionó el detector del sistema dosimétrico a aproximadamente 100 cm del foco del tubo de rayos X. Se seleccionó un valor de 80 kV como tensión de referencia. Se realizaron exposiciones utilizando diferentes valores de mAs, registrando el kerma en aire reportado por el analizador en cada irradiación.",
      criterio:
        "El coeficiente de variación (CV) para exposiciones repetidas no debe exceder 5 %. La desviación en la linealidad del rendimiento con respecto al mAs no debe exceder ±10 %.",
    },
    DOS: {
      objetivo: "Estimar la dosis al receptor de imagen bajo condiciones clínicas representativas.",
      instrumentacion:
        "Sistema dosimétrico calibrado para medición de kerma en aire (cámara de ionización o detector de estado sólido), material atenuador y sistema receptor de imagen digital.",
      metodologia:
        "La determinación de la dosis al receptor se realizó siguiendo el procedimiento descrito en el IAEA-TECDOC-1958. Se seleccionaron parámetros clínicos representativos y se realizaron exposiciones, registrando el valor de dosis medida en cada condición.",
      criterio:
        "La diferencia entre el valor de la dosis calculada y la dosis base inicial debe ser < 0,01 mGy o 10 µGy.",
    },
  };

  // Texto genérico para pruebas sin texto específico
  return (
    textos[codigo] ?? {
      objetivo: "Evaluar el parámetro según los lineamientos del IAEA-TECDOC-1958.",
      instrumentacion: "Analizador de rayos X con detector para radiodiagnóstico.",
      metodologia:
        "La prueba se realizó conforme al procedimiento descrito en el IAEA-TECDOC-1958, bajo condiciones representativas de operación del equipo.",
      criterio:
        "Los resultados se evaluaron conforme a los criterios de aceptación establecidos en el IAEA-TECDOC-1958.",
    }
  );
}

// ============================================================
//  Generar el PDF
// ============================================================

export async function generarPreInforme(visitaId: number): Promise<Blob | null> {
  const [{ jsPDF }, { default: autoTable }, logoBase64] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    getLogoBase64(),
  ]);

  const datosRaw = await recopilarDatos(visitaId);
  if (!datosRaw) return null;
  const datos: DatosInforme = datosRaw;

  // Equipos con paquete dedicado (CONVENCIONAL) usan las tablas conv_*
  const esConv = !!datos.equipo?.tipo_equipo && hasPackage(datos.equipo.tipo_equipo);
  const conv = esConv ? await recopilarDatosConv(visitaId) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;
  let pageCount = 0;

  // ─── Helpers ───

  function checkPage(needed: number) {
    if (y + needed > 275) {
      doc.addPage();
      y = MARGIN + HEADER_HEIGHT;
      addHeader(doc, datos, logoBase64);
    }
  }

  function addParagraph(text: string, fontSize = 9, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLOR_BLACK);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
    checkPage(lines.length * 4.2 + 2);
    doc.text(lines, MARGIN + indent, y);
    y += lines.length * 4.2 + 2;
  }

  function addSubsectionTitle(number: string, title: string) {
    checkPage(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_BLACK);
    doc.text(`${number} ${title}`, MARGIN, y);
    y += 5;
  }

  // Contactos helper
  const medicoResp = datos.contactos.find((c) => c.cargo === "medico_responsable");
  const tecnologo = datos.contactos.find((c) => c.cargo === "tecnologo");
  const opr = datos.contactos.find((c) => c.cargo === "opr");
  const contactoProgramar = datos.contactos.find((c) => c.para_programar);

  // Formato fecha
  const fechaInforme = datos.visita.fecha_visita
    ? new Date(datos.visita.fecha_visita).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  // ═══════════════════════════════════════════════════════════
  //  PÁGINA 1 — PORTADA
  // ═══════════════════════════════════════════════════════════

  // Línea superior púrpura
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, PAGE_WIDTH, 3, "F");

  // Logo
  try {
    doc.addImage(logoBase64, "PNG", MARGIN, 8, 55, 18);
  } catch {
    // Fallback si el logo no se puede cargar
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text("Sievert", MARGIN, 20);
    doc.setFontSize(8);
    doc.text("Protección Radiológica", MARGIN, 24);
  }

  // Tipo de informe
  y = 35;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_GRAY);
  doc.text("Informe Técnico:", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("FT-LEC-6c CONTROL DE CALIDAD Y ESTUDIO AMBIENTAL EN", MARGIN, y);
  y += 5;
  doc.text("UNIDADES DE RADIOGRAFÍA GENERAL", MARGIN, y);
  y += 8;

  // Número y fecha
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de Informe:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(fechaInforme, MARGIN + 40, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Versión:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text("PRE-INFORME", MARGIN + 40, y);

  // Recuadro: Identificación de la unidad
  y += 12;
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 2, 2, "F");

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Identificación de la Unidad evaluada", MARGIN + 5, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "normal");
  doc.text(`${datos.equipo?.tipo_equipo?.replace(/_/g, " ") ?? "Rayos X"}`, MARGIN + 5, y);
  y += 5;
  doc.text(
    `Marca: ${datos.equipo?.gen_marca ?? "—"}    Modelo: ${datos.equipo?.gen_modelo ?? "—"}    Serie: ${datos.equipo?.gen_numero_serie ?? "—"}`,
    MARGIN + 5,
    y
  );

  // Recuadro: Identificación de la instalación
  y += 14;
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 2, 2, "F");

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Identificación de la Instalación", MARGIN + 5, y);
  y += 6;

  const infoInstalacion = [
    ["Razón social:", datos.cliente?.nombre_cliente ?? "—"],
    ["NIT:", `${datos.cliente?.nit ?? "—"}-${datos.cliente?.digito_verificacion ?? ""}`],
    ["Sede:", datos.sede?.nombre_sede ?? "—"],
    ["Área - servicio:", datos.ubicacion?.nombre_servicio ?? "—"],
    ["Dirección:", datos.sede?.direccion_sede ?? datos.cliente?.direccion ?? "—"],
    ["Ciudad - Departamento:", `${datos.sede?.ciudad ?? "—"} - ${datos.sede?.departamento ?? "—"}`],
  ];

  doc.setFontSize(9);
  for (const [label, value] of infoInstalacion) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_BLACK);
    doc.text(label, MARGIN + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 50, y);
    y += 5;
  }

  // Vigencia
  y += 8;
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, "F");
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, "S");
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 120, 0);
  doc.text(
    "Vigencia del Informe: Dos (2) años contados a partir de la fecha de emisión, conforme a la Resolución 1811 de 2025",
    MARGIN + 5,
    y
  );

  addFooter(doc, datos);

  // ═══════════════════════════════════════════════════════════
  //  PÁGINA 2 — INFORMACIÓN DE LA PRÁCTICA
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN + HEADER_HEIGHT;
  addHeader(doc, datos, logoBase64);

  y = addSectionTitle(doc, "INFORMACIÓN DE LA PRÁCTICA", y);

  // Datos Generales
  addSubsectionTitle("", "Datos Generales");

  const datosGenerales = [
    ["Fecha de Informe", fechaInforme],
    ["Nombre de la Institución", datos.cliente?.nombre_cliente ?? "—"],
    ["Sede de ubicación de la unidad de RX", datos.sede?.nombre_sede ?? "—"],
    ["Dirección", datos.sede?.direccion_sede ?? datos.cliente?.direccion ?? "—"],
    ["Teléfono(s)", datos.cliente?.telefono ?? "—"],
    [
      "Naturaleza de la Institución",
      datos.cliente?.naturaleza === "publico"
        ? "Pública"
        : datos.cliente?.naturaleza === "privado"
          ? "Privada"
          : (datos.cliente?.naturaleza ?? "—"),
    ],
    ["Nombre del Representante Legal", datos.cliente?.nombre_representante_legal ?? "—"],
    ["Nombre del Servicio", datos.ubicacion?.nombre_servicio ?? "—"],
    ["Médico Responsable", medicoResp?.nombre ?? "—"],
    ["Tecnólogo Responsable del Servicio", tecnologo?.nombre ?? "—"],
    ["Correo Electrónico Tecnólogo", tecnologo?.email ?? "—"],
    ["Información de Contacto Tecnólogo", tecnologo?.telefono ?? "—"],
    [
      "Oficial o encargado de protección radiológica",
      opr?.nombre ?? contactoProgramar?.nombre ?? "—",
    ],
    ["Correo Electrónico Institución", datos.cliente?.email ?? "—"],
    ["Responsable de la Visita", datos.tecnico?.nombre ?? "—"],
    ["Cédula Responsable de la Visita", datos.tecnico?.cedula ?? "—"],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: datosGenerales,
    theme: "grid",
    bodyStyles: { fontSize: 8, textColor: COLOR_BLACK },
    alternateRowStyles: { fillColor: COLOR_ALT_ROW },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
      1: { cellWidth: CONTENT_WIDTH - 60 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Datos de la Instalación e Identificación del Equipo
  checkPage(50);
  addSubsectionTitle("", "Datos de la Instalación e Identificación del Equipo");

  const datosInstalacion = [
    [
      "Número de la licencia para funcionamiento de equipos de RX",
      datos.ubicacion?.licencia ?? "No Aplica",
    ],
    [
      "Fecha de expiración de la licencia",
      datos.ubicacion?.fecha_expiracion_licencia ?? "No Aplica",
    ],
    ["Código de habilitación del servicio", datos.ubicacion?.codigo_habilitacion ?? "—"],
    ["Días Laborados por Semana", String(datos.visita.dias_laborados_semana ?? "—")],
    ["No. de Pacientes por Semana", String(datos.visita.pacientes_por_semana ?? "—")],
    ["KV máximo usado", String(datos.visita.kv_maximo_usado ?? "—")],
    ["% de rechazo de Radiografías", String(datos.visita.porcentaje_rechazo ?? "—")],
    ["Horas por día", String(datos.ubicacion?.horas_x_dia ?? "—")],
    ["Máximo de disparos/Paciente", String(datos.visita.max_disparos_paciente ?? "—")],
    ["mAs máximo usado", String(datos.visita.mas_maximo_usado ?? "—")],
    ["No. de radiografías/semana", String(datos.visita.radiografias_por_semana ?? "—")],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: datosInstalacion,
    theme: "grid",
    bodyStyles: { fontSize: 8, textColor: COLOR_BLACK },
    alternateRowStyles: { fillColor: COLOR_ALT_ROW },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
      1: { cellWidth: CONTENT_WIDTH - 60 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Características del Generador
  checkPage(40);
  addSubsectionTitle("", "Características del Generador");

  const datosGenerador = [
    ["Marca", datos.equipo?.gen_marca ?? "—"],
    ["Modelo", datos.equipo?.gen_modelo ?? "—"],
    ["No. de Serie", datos.equipo?.gen_numero_serie ?? "—"],
    ["Fecha de fabricación", datos.equipo?.gen_fecha_fabricacion ?? "—"],
    ["Fase del generador", datos.equipo?.gen_fase?.replace(/_/g, " ") ?? "—"],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: datosGenerador,
    theme: "grid",
    bodyStyles: { fontSize: 8, textColor: COLOR_BLACK },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
      1: { cellWidth: CONTENT_WIDTH - 60 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Especificaciones del Tubo
  if (datos.tubo) {
    checkPage(40);
    addSubsectionTitle("", "Especificaciones del Tubo");

    const datosTubo = [
      ["Marca", datos.tubo.marca ?? "—"],
      ["Modelo", datos.tubo.modelo ?? "—"],
      ["No. Serie", datos.tubo.numero_serie ?? "—"],
      ["Tipo", datos.tubo.tipo ?? "—"],
      ["mAs máximo", String(datos.tubo.mas_max ?? "—")],
      ["kV máx", String(datos.tubo.kv_max ?? "—")],
      ["mA máx", String(datos.tubo.ma_max ?? "—")],
      ["Foco fino (mm)", String(datos.tubo.foco_fino_mm ?? "—")],
      ["Foco grueso (mm)", String(datos.tubo.foco_grueso_mm ?? "—")],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      body: datosTubo,
      theme: "grid",
      bodyStyles: { fontSize: 8, textColor: COLOR_BLACK },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
        1: { cellWidth: CONTENT_WIDTH - 60 },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Características del Colimador y Sistema de Adquisición
  checkPage(30);
  addSubsectionTitle("", "Características del Colimador y del Sistema de Adquisición de Imágenes");

  const datosColimador = [
    ["Distancia Foco / Paciente (cm)", String(datos.equipo?.distancia_foco_paciente ?? "—")],
    ["Bucky", datos.equipo?.bucky?.replace(/_/g, " ") ?? "—"],
    ["Sistema de Adquisición de Imágenes", datos.equipo?.sistema_adquisicion ?? "—"],
    [
      "Filtración Inherente (mm Al)",
      String(datos.equipo?.filtracion_inherente_mmal ?? "No reporta"),
    ],
    ["Filtración Añadida (mm Al)", String(datos.equipo?.filtracion_anadida_mmal ?? "No reporta")],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: datosColimador,
    theme: "grid",
    bodyStyles: { fontSize: 8, textColor: COLOR_BLACK },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: COLOR_HEADER_BG },
      1: { cellWidth: CONTENT_WIDTH - 60 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Condiciones ambientales
  checkPage(15);
  addSubsectionTitle("", "Condiciones ambientales");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Temperatura (°C): ${datos.visita.temperatura_c ?? "—"}`, MARGIN, y);
  y += 5;
  doc.text(`Presión (hPa): ${datos.visita.presion_hpa ?? "—"}`, MARGIN, y);
  y += 8;

  // ═══════════════════════════════════════════════════════════
  //  PÁGINA — INTRODUCCIÓN
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  y = MARGIN + HEADER_HEIGHT;
  addHeader(doc, datos, logoBase64);

  y = addSectionTitle(doc, "INTRODUCCIÓN", y);

  addParagraph(
    "El presente informe técnico documenta los resultados del control de calidad efectuado al equipo generador de radiación ionizante destinado a la práctica de radiología general y emite el correspondiente concepto técnico, en cumplimiento de la Resolución 1811 de 2025 del Ministerio de Salud y Protección Social y demás disposiciones vigentes en materia de protección radiológica."
  );

  addParagraph(
    "Las pruebas fueron realizadas conforme a los lineamientos establecidos en el documento IAEA-TECDOC-1958: Protocolos de Control de Calidad para Radiodiagnóstico en América Latina y el Caribe, específicamente en el capítulo correspondiente a Radiología General, aplicando la estructura metodológica definida para cada ensayo técnico."
  );

  addParagraph(
    "El control de calidad se ejecutó mediante un procedimiento técnico no invasivo, desarrollado bajo condiciones normales de operación del equipo y sin intervención física sobre sus componentes internos, con el fin de verificar que los parámetros físicos y operacionales del sistema radiográfico se encuentren dentro de los criterios de aceptación establecidos."
  );

  addParagraph(
    "El presente informe tendrá una vigencia máxima de dos (2) años, contados a partir de la fecha de su emisión, siempre que no se presenten modificaciones técnicas, estructurales u operativas que alteren las condiciones evaluadas."
  );

  // ═══════════════════════════════════════════════════════════
  //  SECCIÓN — PRUEBAS DE CONTROL DE CALIDAD
  // ═══════════════════════════════════════════════════════════
  y += 4;
  y = addSectionTitle(doc, "2. PRUEBAS DE CONTROL DE CALIDAD EN RADIOLOGÍA GENERAL", y);

  // ─── Acumuladores para el resumen final (ambos flujos) ───
  const resumenRows: [string, string][] = [];
  const accionesPendientes: string[] = [];
  let conceptoGeneralOk = true;

  // ═══ Flujo CONVENCIONAL: secciones desde conv_informe_secciones (estructura CE_NIT) ═══
  if (conv) {
    const ctx: InformeCtx = {
      doc,
      autoTable,
      get y() {
        return y;
      },
      set y(v: number) {
        y = v;
      },
      checkPage,
      addParagraph,
      addSubsectionTitle,
    };

    // Todas las pruebas aparecen en el informe; el switch (incluida) decide si
    // la prueba APLICA (se evalúa) o NO APLICA (se documenta como no aplicable).
    const todasSecciones = [...conv.secciones].sort((a, b) => a.orden - b.orden);

    for (const seccion of todasSecciones) {
      const cat = getCatalogoSeccion(seccion.prueba_codigo);
      if (!cat) continue;
      const codigo = seccion.prueba_codigo;
      const aplica = seccion.incluida;

      // Título de la prueba
      checkPage(60);
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_PRIMARY);
      const tituloLines = doc.splitTextToSize(`${codigo} ${cat.nombre}`, CONTENT_WIDTH);
      doc.text(tituloLines, MARGIN, y);
      y += (tituloLines.length - 1) * 5 + 2;
      doc.setDrawColor(...COLOR_PRIMARY);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
      y += 6;

      addSubsectionTitle(`${codigo}.1.`, "Objetivo");
      addParagraph(cat.objetivo);
      addSubsectionTitle(`${codigo}.2.`, "Instrumentación");
      addParagraph(cat.instrumentacion);
      addSubsectionTitle(`${codigo}.3.`, "Metodología");
      addParagraph(cat.metodologia);

      // Resultados (+ análisis en 2.1, descripción en 2.2)
      let nextSub: number;
      if (!aplica) {
        addSubsectionTitle(`${codigo}.4.`, "Resultados");
        addParagraph("NO APLICA.");
        nextSub = 5;
      } else {
        nextSub = renderResultadosSeccion(ctx, codigo, datos.visita, conv, datos.sala);
      }

      // Criterio de aceptación
      addSubsectionTitle(`${codigo}.${nextSub}.`, "Criterio de aceptación");
      addParagraph(cat.criterio);
      nextSub++;

      // Diagrama radiométrico (solo 2.1)
      if (codigo === "2.1" && aplica) {
        renderDiagramaRadiometrico(ctx, conv);
        nextSub = 8;
      }

      // Concepto — en la 2.1 se deriva de las mediciones (el resto es manual)
      checkPage(15);
      addSubsectionTitle(`${codigo}.${nextSub}.`, "Concepto");
      nextSub++;
      const c = seccion.concepto;
      const esAuto21 = codigo === "2.1" && aplica;

      let conceptoLabel: string;
      let conceptoParrafo: string | undefined;
      let esNoConforme = c === "No_conforme";
      let accionesTexto = seccion.acciones_correctivas?.trim()
        ? seccion.acciones_correctivas
        : "No se requieren acciones correctivas.";

      if (esAuto21) {
        const hayMediciones = conv.mediciones.length > 0;
        esNoConforme = hayMediciones && conv.mediciones.some((m) => m.concepto === "No_conforme");
        if (!hayMediciones) {
          conceptoLabel = "PENDIENTE";
        } else if (esNoConforme) {
          conceptoLabel = "NO FAVORABLE";
          conceptoParrafo =
            "Las dosis equivalentes anuales estimadas en algunas áreas evaluadas superan los niveles de restricción de dosis establecidos para áreas supervisadas, por lo que las condiciones radiológicas de la instalación requieren evaluación y adopción de medidas correctivas.";
          accionesTexto =
            "Se recomienda evaluar las condiciones de blindaje de la instalación, revisar la carga de trabajo del equipo y adoptar las medidas de protección radiológica necesarias para garantizar el cumplimiento de los niveles de restricción de dosis establecidos. Una vez subsanada la condición identificada, se deberá repetir el estudio radiométrico para verificar el cumplimiento de los criterios establecidos.";
        } else {
          conceptoLabel = "FAVORABLE";
          conceptoParrafo =
            "Las dosis equivalentes anuales estimadas en las áreas evaluadas se encuentran por debajo de los niveles de restricción de dosis establecidos para áreas controladas y supervisadas, por lo que las condiciones radiológicas de la instalación se consideran aceptables para la operación del equipo evaluado.";
          accionesTexto = "No se requieren acciones correctivas.";
        }
      } else if (!aplica) {
        conceptoLabel = "NO APLICA";
        esNoConforme = false;
      } else {
        conceptoLabel =
          c === "Conforme" ? "CONFORME" : c === "No_conforme" ? "NO CONFORME" : "PENDIENTE";
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (conceptoLabel === "CONFORME" || conceptoLabel === "FAVORABLE")
        doc.setTextColor(16, 150, 80);
      else if (conceptoLabel === "NO CONFORME" || conceptoLabel === "NO FAVORABLE")
        doc.setTextColor(220, 50, 50);
      else doc.setTextColor(...COLOR_GRAY);
      doc.text(conceptoLabel, MARGIN, y);
      y += 6;
      if (conceptoParrafo) {
        addParagraph(conceptoParrafo);
      }
      // La 2.1 no lleva observaciones (concepto automático)
      if (codigo !== "2.1" && seccion.observaciones?.trim()) {
        addParagraph(seccion.observaciones);
      }

      // Acciones correctivas
      addSubsectionTitle(`${codigo}.${nextSub}.`, "Acciones Correctivas");
      addParagraph(accionesTexto);
      y += 4;

      resumenRows.push([`${codigo} ${cat.nombre}`, conceptoLabel]);
      if (esNoConforme) {
        conceptoGeneralOk = false;
        accionesPendientes.push(`• ${cat.nombre}: ${accionesTexto}`);
      }
    }
  }

  // ─── Para cada prueba (flujo legacy — equipos sin paquete dedicado) ───
  const pruebasOrdenadas = conv ? [] : datos.pruebas.filter((p) => p.completado);

  for (let idx = 0; idx < pruebasOrdenadas.length; idx++) {
    const prueba = pruebasOrdenadas[idx];
    const codigo = prueba.definicion?.codigo ?? "";
    const nombre = prueba.definicion?.nombre ?? "Prueba";
    const numPrueba = `2.${idx + 1}`;
    const textos = getTextoPrueba(codigo);

    // Título de la prueba
    checkPage(60);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(`${numPrueba} ${nombre}`, MARGIN, y);
    y += 2;
    doc.setDrawColor(...COLOR_PRIMARY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    y += 6;

    // Objetivo
    addSubsectionTitle(`${numPrueba}.1.`, "Objetivo");
    addParagraph(textos.objetivo);

    // Instrumentación
    addSubsectionTitle(`${numPrueba}.2.`, "Instrumentación");
    addParagraph(textos.instrumentacion);

    // Metodología
    addSubsectionTitle(`${numPrueba}.3.`, "Metodología");
    addParagraph(textos.metodologia);

    // Resultados
    addSubsectionTitle(`${numPrueba}.4.`, "Resultados");

    // Tabla de datos de la prueba
    const mediciones = prueba.datos_json?.mediciones as Record<string, string>[] | undefined;

    if (prueba.concepto === "NO_APLICA" || !mediciones || mediciones.length === 0) {
      if (prueba.concepto === "NO_APLICA") {
        addParagraph("NO APLICA.");
        if (prueba.acciones_correctivas) {
          addParagraph(prueba.acciones_correctivas);
        }
      } else {
        addParagraph("Sin datos registrados para esta prueba.");
      }
    } else {
      // Para LEV, mostrar tabla de mediciones radiométricas
      if (codigo === "LEV" && datos.mediciones.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [
            [
              "#",
              "Punto de Medición",
              "Lectura (mSv/h)",
              "T",
              "Tipo de área",
              "Dosis Anual (mSv/año)",
              "Concepto",
            ],
          ],
          body: datos.mediciones.map((m) => [
            String(m.punto_numero),
            m.ubicacion_descripcion || "—",
            m.tasa_dosis_msv_h != null ? m.tasa_dosis_msv_h.toFixed(5) : "—",
            m.factor_ocupacion ?? "—",
            m.tipo_area ? m.tipo_area.charAt(0).toUpperCase() + m.tipo_area.slice(1) : "—",
            m.dosis_anual_msv != null ? m.dosis_anual_msv.toFixed(4) : "—",
            m.concepto?.replace(/_/g, " ") ?? "—",
          ]),
          theme: "grid",
          headStyles: {
            fillColor: COLOR_PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7,
          },
          bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
          alternateRowStyles: { fillColor: COLOR_ALT_ROW },
          columnStyles: { 0: { cellWidth: 8 } },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      }
      // Para INS, mostrar tablas de inspección
      else if (codigo === "INS" && datos.partes.length > 0) {
        // Tabla de inspección del equipo
        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [["Componente", "Estado", "Observaciones"]],
          body: datos.partes.map((p) => [
            p.parte_nombre,
            (p.estado ?? "—").replace(/_/g, " "),
            p.observacion ?? "Ninguna.",
          ]),
          theme: "grid",
          headStyles: {
            fillColor: COLOR_PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7,
          },
          bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
          alternateRowStyles: { fillColor: COLOR_ALT_ROW },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

        // Elementos de protección
        if (datos.elementos.length > 0) {
          checkPage(20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...COLOR_BLACK);
          doc.text("Elementos de protección radiológica", MARGIN, y);
          y += 5;

          autoTable(doc, {
            startY: y,
            margin: { left: MARGIN, right: MARGIN },
            head: [["No.", "Descripción", "Cantidad", "Concepto", "Observaciones"]],
            body: datos.elementos.map((e, i) => [
              String(i + 1),
              e.descripcion || "—",
              String(e.cantidad ?? "—"),
              e.concepto?.replace(/_/g, " ") ?? "—",
              e.observacion ?? "Ninguna.",
            ]),
            theme: "grid",
            headStyles: {
              fillColor: COLOR_PRIMARY,
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 7,
            },
            bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
            alternateRowStyles: { fillColor: COLOR_ALT_ROW },
          });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
        }
      }
      // Para las demás pruebas, tabla genérica de mediciones
      else {
        const keys = Object.keys(mediciones[0]).filter((k) => k !== "id");
        if (keys.length > 0) {
          const headers = keys.map((k) =>
            k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          );

          autoTable(doc, {
            startY: y,
            margin: { left: MARGIN, right: MARGIN },
            head: [headers],
            body: mediciones.map((m) => keys.map((k) => String(m[k] ?? "—"))),
            theme: "grid",
            headStyles: {
              fillColor: COLOR_PRIMARY,
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 7,
            },
            bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
            alternateRowStyles: { fillColor: COLOR_ALT_ROW },
          });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
        }
      }
    }

    // Criterio de aceptación
    if (prueba.concepto !== "NO_APLICA") {
      addSubsectionTitle(`${numPrueba}.5.`, "Criterio de aceptación");
      addParagraph(textos.criterio);
    }

    // Concepto
    checkPage(15);
    addSubsectionTitle(`${numPrueba}.6.`, "Concepto");
    const conceptoText =
      prueba.concepto === "FAVORABLE"
        ? "FAVORABLE"
        : prueba.concepto === "NO_FAVORABLE"
          ? "NO FAVORABLE"
          : "NO APLICA";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(
      prueba.concepto === "FAVORABLE" ? 16 : prueba.concepto === "NO_FAVORABLE" ? 220 : 100,
      prueba.concepto === "FAVORABLE" ? 150 : prueba.concepto === "NO_FAVORABLE" ? 50 : 116,
      prueba.concepto === "FAVORABLE" ? 80 : prueba.concepto === "NO_FAVORABLE" ? 50 : 139
    );
    doc.text(conceptoText, MARGIN, y);
    y += 6;

    // Acciones correctivas
    addSubsectionTitle(`${numPrueba}.7.`, "Acciones Correctivas");
    addParagraph(
      prueba.acciones_correctivas && prueba.acciones_correctivas.trim()
        ? prueba.acciones_correctivas
        : "No se requieren acciones correctivas."
    );

    y += 4;

    resumenRows.push([`${numPrueba} ${nombre}`, conceptoText]);
    if (prueba.concepto === "NO_FAVORABLE") {
      conceptoGeneralOk = false;
      accionesPendientes.push(
        `• ${nombre}: ${prueba.acciones_correctivas ?? "Se requieren acciones correctivas."}`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RESUMEN DE RESULTADOS
  // ═══════════════════════════════════════════════════════════
  checkPage(60);
  y = addSectionTitle(doc, "RESUMEN DE RESULTADOS", y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Prueba realizada", "Concepto"]],
    body: resumenRows,
    theme: "grid",
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7, textColor: COLOR_BLACK },
    alternateRowStyles: { fillColor: COLOR_ALT_ROW },
    columnStyles: { 0: { cellWidth: 130 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = String(data.cell.raw);
        if (val === "FAVORABLE" || val === "CONFORME") {
          data.cell.styles.textColor = [16, 150, 80];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "NO FAVORABLE" || val === "NO CONFORME") {
          data.cell.styles.textColor = [220, 50, 50];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = COLOR_GRAY;
        }
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // CONCEPTO GENERAL
  checkPage(30);
  y = addSectionTitle(doc, "CONCEPTO", y);

  const conceptoGeneral = conceptoGeneralOk ? "FAVORABLE" : "NO FAVORABLE";

  addParagraph(
    "Con base en los resultados obtenidos en las pruebas de control de calidad realizadas al equipo de radiografía general, y de acuerdo con los criterios establecidos en los protocolos de control de calidad aplicables, se concluye que el desempeño del equipo evaluado es:"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(
    conceptoGeneralOk ? 16 : 220,
    conceptoGeneralOk ? 150 : 50,
    conceptoGeneralOk ? 80 : 50
  );
  doc.text(conceptoGeneral, PAGE_WIDTH / 2, y, { align: "center" });
  y += 10;

  // ACCIONES CORRECTIVAS
  y = addSectionTitle(doc, "ACCIONES CORRECTIVAS", y);

  if (accionesPendientes.length === 0) {
    addParagraph("No se requieren acciones correctivas.");
  } else {
    for (const accion of accionesPendientes) {
      addParagraph(accion);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  OBSERVACIONES
  // ═══════════════════════════════════════════════════════════
  if (datos.visita.observaciones) {
    y += 4;
    checkPage(25);
    y = addSectionTitle(doc, "OBSERVACIONES GENERALES", y);
    addParagraph(datos.visita.observaciones);
  }

  // ═══════════════════════════════════════════════════════════
  //  FIRMAS
  // ═══════════════════════════════════════════════════════════
  checkPage(60);
  y += 10;
  y = addSectionTitle(doc, "FIRMAS", y);
  y += 5;

  // Responsable Sievert
  doc.setDrawColor(...COLOR_GRAY);
  doc.line(MARGIN, y + 15, MARGIN + 70, y + 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text("Responsable Sievert S.A.S:", MARGIN, y);
  y += 20;
  doc.text("Director Técnico", MARGIN, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text("Sievert Protección Radiológica S.A.S.", MARGIN, y);

  // Responsable de visita
  y += 15;
  doc.setDrawColor(...COLOR_GRAY);
  doc.line(MARGIN, y + 15, MARGIN + 70, y + 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_BLACK);
  doc.text("Responsable de visita:", MARGIN, y);
  y += 20;
  doc.text(datos.tecnico?.nombre ?? "—", MARGIN, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(
    `C.C. ${datos.tecnico?.cedula ?? "—"} — ${datos.tecnico?.cargo?.replace(/_/g, " ") ?? "Físico Técnico"}`,
    MARGIN,
    y
  );

  // ─── Marca de agua PRE-INFORME ───
  pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(55);
    doc.setTextColor(130, 90, 242);
    doc.setGState(
      new (
        doc as unknown as {
          GState: new (opts: { opacity: number }) => unknown;
        }
      ).GState({ opacity: 0.06 })
    );
    doc.text("PRE-INFORME", PAGE_WIDTH / 2, 150, {
      align: "center",
      angle: 45,
    });
    doc.setGState(
      new (
        doc as unknown as {
          GState: new (opts: { opacity: number }) => unknown;
        }
      ).GState({ opacity: 1 })
    );
  }

  // ─── Footers ───
  pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, datos);
  }

  return doc.output("blob");
}

// ─── Helpers de layout ───

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  return y + 7;
}

function addHeader(doc: jsPDF, datos: DatosInforme, logoBase64: string) {
  const pageNum = doc.getNumberOfPages();
  doc.setPage(pageNum);

  // Logo pequeño en header
  try {
    doc.addImage(logoBase64, "PNG", MARGIN, 8, 35, 12);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text("Sievert", MARGIN, 15);
  }

  // Tipo de informe y equipo en header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(
    `Control de Calidad — ${datos.equipo?.gen_marca ?? ""} ${datos.equipo?.gen_modelo ?? ""}`,
    PAGE_WIDTH - MARGIN,
    12,
    { align: "right" }
  );
  doc.text(datos.cliente?.nombre_cliente?.substring(0, 60) ?? "", PAGE_WIDTH - MARGIN, 16, {
    align: "right",
  });

  // Línea separadora
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + HEADER_HEIGHT - 4, PAGE_WIDTH - MARGIN, MARGIN + HEADER_HEIGHT - 4);
}

function addFooter(doc: jsPDF, datos: DatosInforme) {
  const pageNum = doc.getNumberOfPages();
  doc.setPage(pageNum);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_GRAY);

  // Fecha y página
  const fechaCorta = datos.visita.fecha_visita
    ? new Date(datos.visita.fecha_visita).toLocaleDateString("es-CO")
    : "";
  doc.text(`${fechaCorta} — Pre-informe sujeto a revisión`, MARGIN, 292);
  doc.text(`${pageNum}`, PAGE_WIDTH - MARGIN, 292, { align: "right" });

  // Línea inferior púrpura
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 295, PAGE_WIDTH, 2, "F");
}
