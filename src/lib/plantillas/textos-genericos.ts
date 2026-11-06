import type { TextosPrueba } from "./types";

// ============================================================
//  Textos v0 de las pruebas del catálogo GENÉRICO (equipos sin paquete
//  dedicado: flujo legacy de `prueba_resultados`). Antes vivían inline en
//  generar-pre-informe.ts (`getTextoPrueba`); ahora son la base sobre la
//  que el coordinador edita la plantilla de cada tipo (#196).
// ============================================================

export const TEXTOS_PRUEBA_GENERICOS: Record<string, TextosPrueba> = {
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
      "La desviación entre el campo luminoso y el campo de radiación no debe exceder el 2 % de la distancia foco-receptor en cada borde ni el 4 % en total. La perpendicularidad del rayo central debe presentar una desviación angular <= 3°.",
  },
  TIE: {
    objetivo:
      "Evaluar la exactitud y la repetibilidad del indicador del tiempo de exposición del generador de rayos X.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. Se seleccionó una combinación representativa de tensión y corriente del generador y se realizaron al menos tres exposiciones para un tiempo de exposición determinado.",
    criterio:
      "La desviación entre el tiempo de exposición seleccionado y el tiempo medido no debe exceder ±10 %. La repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) <= 10 %.",
  },
  KVP: {
    objetivo:
      "Evaluar la exactitud y la repetibilidad del indicador de la tensión del tubo de rayos X del generador.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación. Se seleccionaron al menos tres valores representativos de tensión del tubo de rayos X y se realizaron al menos tres exposiciones para cada valor seleccionado, registrando la tensión medida en cada irradiación.",
    criterio:
      "La desviación entre la tensión seleccionada y la tensión medida no debe exceder ±10 %. La repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) <= 5 %.",
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

/** Texto para una prueba genérica sin texto específico. */
export const TEXTO_PRUEBA_GENERICO_DEFECTO: TextosPrueba = {
  objetivo: "Evaluar el parámetro según los lineamientos del IAEA-TECDOC-1958.",
  instrumentacion: "Analizador de rayos X con detector para radiodiagnóstico.",
  metodologia:
    "La prueba se realizó conforme al procedimiento descrito en el IAEA-TECDOC-1958, bajo condiciones representativas de operación del equipo.",
  criterio:
    "Los resultados se evaluaron conforme a los criterios de aceptación establecidos en el IAEA-TECDOC-1958.",
};
