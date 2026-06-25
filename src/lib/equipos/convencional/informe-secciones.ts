// ============================================================
//  Catálogo de secciones del informe convencional
//  Define las 21 pruebas TECDOC con textos para el PDF,
//  grupo al que pertenecen, y orden por defecto.
// ============================================================

export interface SeccionInfoCatalogo {
  codigo: string;
  nombre: string;
  grupo: string;
  orden: number;
  /** Texto del objetivo para el PDF */
  objetivo: string;
  /** Texto de instrumentación para el PDF */
  instrumentacion: string;
  /** Texto de metodología para el PDF */
  metodologia: string;
  /** Texto del criterio de aceptación para el PDF */
  criterio: string;
  /** Texto por defecto del análisis (editable por el físico, p.ej. 2.2) */
  analisis?: string;
}

export const CATALOGO_SECCIONES: SeccionInfoCatalogo[] = [
  {
    codigo: "2.1",
    nombre: "Evaluacion de las condiciones ambientales / Levantamiento radiometrico",
    grupo: "A",
    orden: 1,
    objetivo:
      "Realizar el levantamiento radiometrico para evaluar las condiciones ambientales del servicio en terminos de proteccion radiologica y verificar los niveles de exposicion ocupacional y del publico.",
    instrumentacion:
      "Sistema dosimetrico calibrado para mediciones en proteccion radiologica (camara de ionizacion o detector de estado solido), material equivalente simulador de radiacion dispersa y cinta metrica.",
    metodologia:
      "Se realizó el levantamiento radiométrico mediante mediciones de radiación dispersa en puntos representativos del área donde se encuentra instalado el equipo de radiología general. Las mediciones se efectuaron utilizando una cámara de ionización o un detector de estado sólido calibrado en términos de dosis equivalente ambiental H*(10), posicionando un simulador de dispersión en la ubicación habitual del paciente durante la exposición, aplicando la técnica máxima utilizada en la práctica clínica. Los puntos de medición evaluados se presentan en el diagrama radiométrico de la instalación.",
    criterio:
      "Area controlada (trabajadores): H*(10) <= 5 mSv/ano. Area supervisada (publico): H*(10) <= 0.5 mSv/ano.",
  },
  {
    codigo: "2.2",
    nombre: "Inspección visual, descripción de la instalación y blindajes",
    grupo: "A",
    orden: 2,
    objetivo:
      "Verificar mediante inspección visual el estado físico y las condiciones de seguridad del equipo de radiografía general y de su instalación, con el fin de identificar posibles deterioros, defectos mecánicos o condiciones que puedan afectar la protección radiológica del operador, los pacientes o el público.",
    instrumentacion:
      "Inspección visual directa del equipo y de la instalación, utilizando herramientas básicas de verificación cuando aplica.",
    metodologia:
      "Se realizó una inspección visual del equipo y de las condiciones de operación de la instalación mediante una lista de verificación basada en los lineamientos del IAEA-TECDOC-1958 y en los criterios de seguridad aplicables a equipos de radiología general.",
    criterio:
      "La inspección visual se considera aceptable cuando los componentes visibles del equipo y las condiciones de operación de la instalación se encuentran en buen estado físico, sin deterioros, fugas o defectos que puedan comprometer la protección radiológica del operador, los pacientes o el público.",
    analisis:
      "La inspección visual realizada al equipo de radiografía general y a las condiciones de operación de la instalación permitió verificar que los componentes visibles del sistema de rayos X se encuentran en adecuado estado físico, con el fin de identificar deterioros, fugas de aceite, daños mecánicos o anomalías en los cables de alimentación y control.\n\nAsimismo, se revisaron las condiciones de operación del equipo, la señalización de radioprotección y los elementos de seguridad presentes en la instalación para determinar si son consistentes con los requerimientos para la operación segura del equipo evaluado.",
  },
  {
    codigo: "2.3",
    nombre: "Sistema de colimación del haz y perpendicularidad del rayo central",
    grupo: "E",
    orden: 3,
    objetivo:
      "Evaluar la desviación entre el campo luminoso y el campo real de radiación y la perpendicularidad del eje central del haz de radiación con relación al plano del receptor de imagen.",
    instrumentacion:
      "Detector CR o DR, dispositivo de verificación de colimación y alineación del rayo central y cinta métrica.",
    metodologia:
      "Se ubicó el dispositivo de verificación de colimación sobre el receptor de imagen y se ajustó el campo luminoso de manera que coincidiera con las marcas de referencia del objeto de prueba. Posteriormente, se realizó una exposición radiográfica con una técnica adecuada para visualizar el campo irradiado y la posición del rayo central.\n\nA partir de la imagen obtenida se evaluó la coincidencia entre el campo luminoso y el campo de radiación, así como la perpendicularidad del rayo central respecto al plano del receptor, de acuerdo con los criterios establecidos en el IAEA-TECDOC-1958.",
    criterio:
      "La desviación entre el campo luminoso y el campo de radiación no debe exceder el 2 % de la distancia foco-receptor en cada borde ni el 4 % en total. La perpendicularidad del rayo central debe presentar una desviación angular menor o igual a 3°.",
  },
  {
    codigo: "2.4",
    nombre: "Exactitud y repetibilidad del tiempo de exposición",
    grupo: "B",
    orden: 4,
    objetivo:
      "Evaluar la exactitud y la repetibilidad del indicador del tiempo de exposición del generador de rayos X.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nSe seleccionó una combinación representativa de tensión y corriente del generador y se realizaron al menos tres exposiciones para un tiempo de exposición determinado, registrando el tiempo medido en cada exposición. El procedimiento se repitió para otros dos tiempos de exposición seleccionados, manteniendo constantes los demás parámetros de irradiación.",
    criterio:
      "La desviación entre el tiempo de exposición seleccionado y el tiempo medido no debe exceder +/-10 %.\nLa repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) <= 10 %.",
  },
  {
    codigo: "2.5",
    nombre: "Exactitud y repetibilidad de la tensión del tubo de rayos X",
    grupo: "B",
    orden: 5,
    objetivo:
      "Evaluar la exactitud y la repetibilidad del indicador de la tensión del tubo de rayos X del generador.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nSe seleccionaron al menos tres valores representativos de tensión del tubo de rayos X y se realizaron al menos tres exposiciones para cada valor seleccionado, registrando la tensión medida en cada irradiación. Durante las mediciones se mantuvieron constantes los demás parámetros de irradiación.",
    criterio:
      "La desviación entre la tensión seleccionada y la tensión medida no debe exceder +/-10 %.\nLa repetibilidad de las mediciones debe presentar un coeficiente de variación (CV) <= 5 %.",
  },
  {
    codigo: "2.6",
    nombre: "Capa hemirreductora (CHR)",
    grupo: "B",
    orden: 6,
    objetivo:
      "Verificar si el valor de la capa hemirreductora está de acuerdo con los requisitos mínimos.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nSe realizaron exposiciones utilizando valores representativos de tensión del tubo de rayos X, registrando la capa hemirreductora (CHR) reportada por el analizador para cada condición de irradiación. Los valores obtenidos se compararon con los valores mínimos de referencia establecidos para radiodiagnóstico según la tensión del tubo utilizada.",
    criterio:
      "La capa hemirreductora del haz de rayos X debe ser igual o mayor que los valores mínimos de referencia establecidos para cada nivel de tensión del tubo.",
  },
  {
    codigo: "2.7",
    nombre: "Valor del rendimiento del tubo de rayos X, repetibilidad y linealidad",
    grupo: "B",
    orden: 7,
    objetivo:
      "Evaluar el valor, la repetibilidad y la linealidad del rendimiento del tubo de rayos X.",
    instrumentacion: "Analizador de rayos X RaySafe X2 con detector para radiodiagnóstico.",
    metodologia:
      "Se posicionó el medidor no invasivo sobre la mesa, en el centro del haz de radiación, ajustando el tamaño del campo al volumen sensible del instrumento. En sistemas digitales se protegió el detector mediante una lámina de cobre (Cu) de 1 mm de espesor.\n\nEl detector del sistema dosimétrico se ubicó aproximadamente a 100 cm del foco del tubo de rayos X. Se seleccionó un valor de 80 kV como tensión de referencia. Posteriormente se realizaron exposiciones utilizando diferentes valores de mAs, registrando el kerma en aire reportado por el analizador en cada irradiación.\n\nA partir de las mediciones obtenidas se calculó el rendimiento del tubo de rayos X, expresado como kerma en aire por unidad de carga (µGy/mAs). La repetibilidad se evaluó mediante el cálculo del coeficiente de variación (CV) para exposiciones repetidas bajo las mismas condiciones de irradiación, mientras que la linealidad se evaluó mediante la comparación del rendimiento obtenido para los diferentes valores de mAs.",
    criterio:
      "El coeficiente de variación (CV) para exposiciones repetidas no debe exceder 5 %.\nLa desviación en la linealidad del rendimiento con respecto al mAs no debe exceder +/-10 %.",
  },
  {
    codigo: "2.8",
    nombre: "Determinacion del factor de correccion del producto kerma-area (PKA)",
    grupo: "B",
    orden: 8,
    objetivo:
      "Verificar si el medidor de dosis-area (DAP meter) del equipo esta calibrado correctamente, calculando un factor de correccion.",
    instrumentacion: "Sensor RaySafe X2 RF, cinta metrica, regla para medir campo de irradiacion.",
    metodologia:
      "Se usaron los mismos programas clinicos (Extremidad, Torax, Columna). Se midio el Kerma en aire con el sensor y el area del campo de irradiacion.",
    criterio:
      "Se registra como referencia. Un factor muy diferente de 1.0 indica que el medidor DAP del equipo necesita recalibracion.",
  },
  {
    codigo: "2.9",
    nombre: "Control de calidad del DDI/EI",
    grupo: "D",
    orden: 9,
    objetivo:
      "Verificar que el indicador de dosis digital (DDI) y el indice de exposicion (EI) del sistema de imagen reportan valores correctos.",
    instrumentacion: "Placas de cobre (1 mm), Detector de imagen (DR o CR).",
    metodologia:
      "Se configuro una tecnica estandar (70 kVp, Cu 1mm). Se realizo una exposicion con el detector de imagen en posicion y se comparo el EI/DI con los valores base.",
    criterio: "Desviacion del EI y D.I. respecto a base <= 20%.",
  },
  {
    codigo: "2.10",
    nombre: "Repetibilidad del DDI/EI",
    grupo: "D",
    orden: 10,
    objetivo:
      "Verificar que al repetir exposiciones con la misma tecnica, el DDI/EI reportado es consistente.",
    instrumentacion: "Placas de cobre (1 mm), Detector de imagen.",
    metodologia:
      "Se repitio la misma exposicion 3 veces y se registro el EI y D.I. de cada exposicion.",
    criterio: "CV del EI y D.I. <= 20%.",
  },
  {
    codigo: "2.11",
    nombre: "Uniformidad y artefactos del detector",
    grupo: "E",
    orden: 11,
    objetivo:
      "Verificar que el detector de imagen produce una respuesta uniforme y no tiene artefactos que afecten la calidad diagnostica.",
    instrumentacion: "Detector de imagen (DR o CR), placa de cobre como filtro.",
    metodologia:
      "Se coloco el lado mas largo del detector alineado con el tubo. Se coloco un filtro de cobre a la salida del tubo. Se realizo una exposicion uniforme (flat field) y se analizaron 5 ROIs en dos orientaciones.",
    criterio: "Uniformidad segun especificaciones del fabricante. Sin artefactos visibles.",
  },
  {
    codigo: "2.12",
    nombre: "Resolucion espacial de alto contraste",
    grupo: "E",
    orden: 12,
    objetivo:
      "Determinar la capacidad del sistema para distinguir objetos pequenos y cercanos entre si. Se mide en pares de lineas por milimetro (pl/mm).",
    instrumentacion: "Patron de resolucion (tipo barra de plomo), Detector de imagen.",
    metodologia:
      "Se coloco el patron de resolucion sobre el detector, se realizo una exposicion y se identifico el grupo de barras mas fino visible.",
    criterio: "Resolucion >= valor de referencia del sistema.",
  },
  {
    codigo: "2.13",
    nombre: "Umbral de sensibilidad a bajo contraste",
    grupo: "E",
    orden: 13,
    objetivo: "Evaluar la capacidad del sistema para detectar diferencias sutiles de contraste.",
    instrumentacion:
      "Patron de bajo contraste (phantom con insertos de diferente densidad), Detector de imagen.",
    metodologia:
      "Se coloco el patron de bajo contraste sobre el detector, se realizo una exposicion y se identificaron los insertos de menor contraste visibles.",
    criterio: "Segun especificaciones del fabricante y valor de referencia.",
  },
  {
    codigo: "2.14",
    nombre: "Integridad y limpieza de cassettes y pantallas IP",
    grupo: "D",
    orden: 14,
    objetivo:
      "Verificar que los cassettes y pantallas de imagen (CR) estan en buen estado y limpios, sin artefactos que afecten la calidad de imagen.",
    instrumentacion: "Inspeccion visual, Exposicion uniforme de prueba.",
    metodologia:
      "Se inspecciono visualmente cada cassette y se realizo una exposicion uniforme (flat field) con cada uno.",
    criterio: "Sin artefactos visibles. Cassette sin danos fisicos.",
  },
  {
    codigo: "2.15",
    nombre: "Uniformidad de sensibilidad de pantallas IP CR",
    grupo: "D",
    orden: 15,
    objetivo:
      "Verificar que la pantalla de imagen CR tiene sensibilidad uniforme en toda su superficie.",
    instrumentacion: "Detector CR, Exposicion uniforme.",
    metodologia:
      "Se realizo una exposicion uniforme que cubrio toda la pantalla y se analizo la uniformidad del EI entre cassettes.",
    criterio: "Uniformidad segun fabricante.",
  },
  {
    codigo: "2.16",
    nombre: "Funcion de transferencia de modulacion (MTF)",
    grupo: "E",
    orden: 16,
    objetivo:
      "Evaluar la capacidad del sistema para reproducir fielmente el contraste de objetos de diferente tamano.",
    instrumentacion: "Patron MTF o borde recto (edge phantom), Software de analisis DICOM.",
    metodologia:
      "Se coloco el patron MTF sobre el detector con una ligera inclinacion (2-5 grados), se realizo una exposicion, se exporto la imagen DICOM y se analizo con software especializado.",
    criterio: "MTF >= valor de referencia del sistema.",
  },
  {
    codigo: "2.17",
    nombre: "Sensibilidad del control automatico de exposicion (CAE)",
    grupo: "C",
    orden: 17,
    objetivo:
      "Verificar que el CAE da valores similares a los de la visita anterior (valores base).",
    instrumentacion: "Placas de cobre (1 mm), equipo con CAE activado.",
    metodologia:
      "Se activo el CAE en modo automatico, se coloco 1 placa de cobre (1 mm) como atenuador y se compararon los valores medidos con los de la visita anterior.",
    criterio: "Variacion de mAs, EI y D.I. respecto a base <= 50%.",
  },
  {
    codigo: "2.18",
    nombre: "Consistencia entre los sensores del CAE",
    grupo: "C",
    orden: 18,
    objetivo:
      "Verificar que los 3 sensores del CAE y sus combinaciones dan resultados similares entre si.",
    instrumentacion: "Placas de cobre (1 mm), equipo con CAE activado.",
    metodologia:
      "Se mantuvieron las mismas condiciones (70 kVp, Cu 1mm) y se disparo con cada combinacion de sensores (7 mediciones).",
    criterio: "Variacion (MAX-MIN)/promedio de mAs, EI y D.I. <= 30%.",
  },
  {
    codigo: "2.19",
    nombre: "Repetibilidad del CAE",
    grupo: "C",
    orden: 19,
    objetivo:
      "Verificar que el CAE da resultados consistentes al repetir disparos con la misma configuracion.",
    instrumentacion: "Placas de cobre (1 mm), equipo con CAE activado.",
    metodologia:
      "Se mantuvieron las mismas condiciones (70 kVp, Cu 1mm, sensor Centro) y se disparo 4 veces.",
    criterio: "CV de mAs, EI y D.I. <= 10%.",
  },
  {
    codigo: "2.20",
    nombre: "Compensacion del CAE para diferentes kVp y espesores",
    grupo: "C",
    orden: 20,
    objetivo:
      "Verificar que el CAE ajusta correctamente la exposicion cuando cambia el voltaje (kVp) o el espesor del paciente.",
    instrumentacion: "Placas de cobre: 1 mm, 2 mm, 3 mm. Equipo con CAE activado.",
    metodologia:
      "Se disparo a diferentes kVp (60, 70, 81) con Cu 1mm y a diferentes espesores (Cu 1, 2, 3mm) a 81 kVp. Se compararon los valores con los de referencia.",
    criterio: "Variacion por kVp y espesor de mAs, EI y D.I. <= 30%.",
  },
  {
    codigo: "2.21",
    nombre: "Dosis al receptor de imagen",
    grupo: "B",
    orden: 21,
    objetivo:
      "Medir cuanta radiacion llega al detector de imagen usando los programas clinicos reales del equipo.",
    instrumentacion: "Sensor RaySafe X2 RF, rejilla del equipo, cinta metrica.",
    metodologia:
      "Se hicieron 3 disparos CON rejilla y 3 SIN rejilla usando programas clinicos reales. Se registro la dosis al receptor corregida por distancia.",
    criterio: "Diferencia con valor base <= 0.01 mGy.",
  },
];

/** Busca una sección del catálogo por código */
export function getCatalogoSeccion(codigo: string): SeccionInfoCatalogo | undefined {
  return CATALOGO_SECCIONES.find((s) => s.codigo === codigo);
}
