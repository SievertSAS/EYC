import type { VariantePlantilla } from "./types";

// ============================================================
//  Variante PORTÁTIL "v0" de la plantilla del CONVENCIONAL (#187).
//
//  El rayos X portátil es un CONVENCIONAL marcado como portátil: mismas
//  pruebas, mismos cálculos, mismo código de informe (FT-LEC-6c). Aquí solo
//  van los textos que cambian; todo lo demás cae al texto del fijo.
//
//  Fuente: libro de los ingenieros "PORT DR.xlsx", hoja CE_NIT (informe
//  impreso). La celda de origen va junto a cada texto.
//
//  PENDIENTE DE CONFIRMACIÓN DEL FÍSICO (ver comparación del #187):
//    - Introducción: si los párrafos 2 y 3 nuevos del libro (A188, A192)
//      reemplazan también los del fijo. Por ahora se conservan los de la app.
//    - "sobre la mesa": el libro lo quita en 2.5 y 2.7 pero lo conserva en
//      2.4 y 2.6. Se replica el libro (2.4 y 2.6 sin variante).
//    - 2.21: el libro sigue mencionando el Bucky aunque el portátil no tiene
//      ("Bucky: No"). Se copia tal cual.
//    - 2.1: metodología completa del libro (6 párrafos). Los resultados y el
//      análisis con/sin elementos de protección son del #191.
// ============================================================

/** CE_NIT!A184 — reemplaza al primer párrafo de la introducción del fijo. */
export const INTRO_P1_PORTATIL =
  "El presente informe técnico documenta los resultados del control de calidad realizado al equipo portátil de rayos X destinado a la práctica de radiología general, con el propósito de evaluar su desempeño técnico y emitir el correspondiente concepto, de conformidad con la Resolución 1811 de 2025 del Ministerio de Salud y Protección Social y demás disposiciones aplicables.";

/** CE_NIT!A196 — párrafo nuevo del portátil, antes del de vigencia. */
export const INTRO_SELECCION_PRUEBAS_PORTATIL =
  "La selección de las pruebas consideró las funcionalidades disponibles y las particularidades de operación del sistema portátil, aplicando los procedimientos y criterios de aceptación pertinentes.";

/** CE_NIT!A1399/A1434/A1469/A1505 — el portátil no tiene CAE. */
export const MOTIVO_NO_APLICA_CAE_PORTATIL =
  "NO APLICA. Dado que el sistema evaluado NO cuenta con control automático de exposición.";

/** Textos por prueba del portátil (la introducción se arma en ./base.ts). */
export const PRUEBAS_PORTATIL_DEFECTO: NonNullable<VariantePlantilla["pruebas"]> = {
  "2.1": {
    // CE_NIT!A219, A222, A224, A227, A231, A234 — pendiente de confirmación.
    metodologia: [
      "Se realizó el levantamiento radiométrico del equipo portátil de rayos X mediante mediciones de radiación dispersa en puntos representativos de las posiciones que pueden ocupar el operador y otras personas durante la ejecución de procedimientos radiográficos.",
      "Para las mediciones se dispuso el equipo en una configuración de ensayo representativa de su utilización clínica, posicionando un simulador de dispersión en la trayectoria del haz primario de radiación.",
      "Se seleccionaron parámetros de exposición representativos de las condiciones máximas de utilización clínica reportadas para el equipo y se realizaron mediciones en diferentes posiciones y distancias respecto al conjunto formado por el tubo de rayos X y el simulador.",
      "En cada punto se efectuaron mediciones consecutivas, registrando la mayor lectura obtenida de tasa de dosis equivalente ambiental H*(10). Asimismo, se registraron las condiciones de irradiación, la disposición geométrica del montaje y las condiciones de protección radiológica correspondientes a cada medición.",
      "Las lecturas obtenidas se emplearon para estimar la dosis equivalente ambiental anual, considerando la carga de trabajo adoptada, los factores de uso y ocupación correspondientes y las condiciones de exposición representadas por cada punto de medición.",
      "Los resultados se presentan en la siguiente tabla y las posiciones de medición se identifican en el diagrama radiométrico correspondiente.",
    ].join("\n\n"),
  },
  "2.2": {
    // CE_NIT!A344, con la errata del libro corregida ("del aplicables a la operacion").
    objetivo:
      "Verificar mediante inspección visual el estado físico y las condiciones de seguridad aplicables a la operación de un equipo portátil, con el fin de identificar posibles deterioros, defectos mecánicos o condiciones que puedan afectar la protección radiológica del operador, los pacientes o el público.",
    // CE_NIT!A358 — el libro no trae la tabla de zonas A–D (eso es del #188).
    descripcionInstalacion:
      "Al tratarse de una unidad de radiología general portátil de uso en diferentes áreas de las instalaciones, se establece una metodología de operación general con posiciones generales de pacientes adyacentes y posiciones tentativas del operario como se ilustra en el diagrama radiométrico mostrado en la Figura 1.",
    // CE_NIT!A409 + A412
    analisis: [
      "La inspección visual permitió verificar que los componentes del equipo portátil de rayos X evaluados se encuentran en adecuado estado físico y funcional, sin evidencias de deterioro, fugas de aceite o anomalías mecánicas visibles.",
      "Asimismo, se verificaron las condiciones de funcionamiento de los sistemas de soporte, posicionamiento, movilidad e inmovilización, así como los indicadores y controles del generador y los elementos de protección radiológica disponibles durante la evaluación.",
    ].join("\n\n"),
  },
  "2.5": {
    // CE_NIT!A664 — sin "sobre la mesa".
    metodologia:
      "Se posicionó el medidor no invasivo, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nSe seleccionaron al menos tres valores representativos de tensión del tubo de rayos X y se realizaron al menos tres exposiciones para cada valor seleccionado, registrando la tensión medida en cada irradiación. Durante las mediciones se mantuvieron constantes los demás parámetros de irradiación.",
  },
  "2.7": {
    // CE_NIT!A806 — sin "sobre la mesa".
    metodologia:
      "Se posicionó el medidor no invasivo en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nEl detector del sistema dosimétrico se ubicó aproximadamente a 100 cm del foco del tubo de rayos X. Se seleccionó un valor de 80 kV como tensión de referencia. Posteriormente se realizaron exposiciones utilizando diferentes valores de mAs, registrando el kerma en aire reportado por el analizador en cada irradiación.\n\nA partir de las mediciones obtenidas se calculó el rendimiento del tubo de rayos X, expresado como kerma en aire por unidad de carga (µGy/mAs). La repetibilidad se evaluó mediante el cálculo del coeficiente de variación (CV) para exposiciones repetidas bajo las mismas condiciones de irradiación, mientras que la linealidad se evaluó mediante la comparación del rendimiento obtenido para los diferentes valores de mAs.",
  },
  "2.17": { metodologiaNoAplica: MOTIVO_NO_APLICA_CAE_PORTATIL },
  "2.18": { metodologiaNoAplica: MOTIVO_NO_APLICA_CAE_PORTATIL },
  "2.19": { metodologiaNoAplica: MOTIVO_NO_APLICA_CAE_PORTATIL },
  "2.20": { metodologiaNoAplica: MOTIVO_NO_APLICA_CAE_PORTATIL },
  "2.21": {
    // CE_NIT!A1536 — sin rejilla, TPR = 1. Conserva las menciones al Bucky
    // del libro (pendiente de confirmación).
    metodologia: [
      "La determinación de la dosis al receptor se realizó siguiendo el procedimiento descrito en el IAEA-TECDOC-1958.",
      "El tubo de rayos X se centró con el detector y el haz se colimó para cubrir completamente el área del receptor. Se retiró la rejilla y el medidor PKA cuando fue posible. Posteriormente, se colocó una lámina de cobre de 1 mm en la salida del haz de radiación y el dosímetro en la superficie del Bucky, alineado con el eje central del haz.",
      "Se registraron la distancia fuente–dosímetro (d1) y la distancia fuente–receptor de imagen (d2), teniendo en cuenta la posición relativa del detector dentro del Bucky.",
      "Se seleccionaron parámetros clínicos representativos (mínimos, promedio y máximos) y se realizaron exposiciones, registrando el valor de dosis medida en cada condición.",
      "La dosis al receptor se calculó aplicando la corrección geométrica correspondiente y considerando un factor de rejilla (TPR) igual a 1, dado que la medición se realizó sin rejilla.",
    ].join("\n\n"),
  },
};
