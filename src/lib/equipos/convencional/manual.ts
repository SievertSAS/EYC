// ============================================================
//  Manual de pruebas — Convencional (TECDOC)
//  Cada prueba tiene: objetivo, instrumentación, pasos,
//  criterios de aceptación, tips y alertas.
//  Se muestra en un drawer lateral desde cada grupo.
// ============================================================

export interface ManualPrueba {
  codigo: string;
  nombre: string;
  grupo: string;
  objetivo: string;
  instrumentacion: string[];
  pasos: string[];
  criterios: { descripcion: string; limite: string }[];
  tips: string[];
  alertas: string[];
}

export const MANUAL_CONVENCIONAL: ManualPrueba[] = [
  // ─── GRUPO A ───
  {
    codigo: "2.1",
    nombre: "Evaluación de las condiciones ambientales / Levantamiento radiométrico",
    grupo: "A",
    objetivo:
      "Medir la tasa de dosis equivalente ambiental H*(10) en todos los puntos alrededor de la sala donde hay personas (operadores, público) para verificar que la protección radiológica del recinto es adecuada.",
    instrumentacion: [
      "Detector de radiación RaySafe X2 Survey o cámara de ionización",
      "Recipientes de agua entre 7 a 10 litros y 20 cm de altura (simulador de paciente)",
      "Cinta métrica",
    ],
    pasos: [
      "Elabora (o reutiliza) un croquis/plano de la sala identificando todos los puntos de medición: puertas, ventanillas, paredes adyacentes, puesto del operador.",
      "Coloca el simulador de agua sobre la mesa/receptor de imagen con el haz centrado y la colimación máxima.",
      "Selecciona la técnica de mayor kVp que se usa clínicamente (viene de la precarga).",
      "Retira el Flat Panel o cassette del Bucky — no debes irradiar el detector de imagen.",
      "Mide el fondo natural de radiación con el equipo apagado. Toma varias muestras de 10 segundos y promedia.",
      "Registra la distancia del tubo al puesto del operador.",
      "Configura la técnica radiográfica de prueba (kV, mA, tiempo, mAs).",
      "Para cada punto de medición: dispara y registra la lectura del detector en μSv/h.",
      "Asigna el factor de ocupación T según el uso real del área (1 para ocupación completa, fracciones para áreas de paso).",
      "Clasifica cada punto como área 'Controlada' o 'Supervisada'.",
      "El sistema calcula automáticamente la dosis equivalente anual H*(10) usando la fórmula: H*(10) = Lectura(mSv/h) × (1/60) × T × U × W × 50 / I.",
    ],
    criterios: [
      { descripcion: "Área controlada (trabajadores)", limite: "H*(10) ≤ 5 mSv/año" },
      { descripcion: "Área supervisada (público)", limite: "H*(10) ≤ 0.5 mSv/año" },
    ],
    tips: [
      "Usa planos anteriores si están vigentes, pero verifica que no haya cambios en la sala.",
      "Lo ideal es solicitar un plano al cliente antes de la visita.",
      "Toma varias muestras de fondo natural para obtener un promedio confiable.",
      "La carga de trabajo W se calcula como el mayor entre W estimada y W estándar (160 mA·min/sem).",
      "El factor de uso U = 1 porque en esta práctica solo se tiene radiación dispersa.",
    ],
    alertas: [
      "NO irradiar el Flat Panel o cassette — retírelo del Bucky antes de iniciar.",
      "Asegúrate de que no haya personas en áreas adyacentes durante los disparos.",
    ],
  },
  {
    codigo: "2.2",
    nombre: "Inspección visual, descripción de la instalación y blindajes",
    grupo: "A",
    objetivo:
      "Verificar el estado físico y funcional del equipo de rayos X, las condiciones de seguridad de la instalación y los elementos de protección radiológica disponibles.",
    instrumentacion: ["Inspección visual directa", "Cámara fotográfica para evidencias"],
    pasos: [
      "Inspecciona el estado de los accesorios: mesa radiográfica, soporte del tubo, consola del generador, cables de alimentación y control. Busca desgaste o deterioro.",
      "Verifica la estabilidad del cabezal del tubo y el funcionamiento mecánico: colimación, movimientos, frenos del soporte, mesa y Bucky vertical.",
      "Inspecciona visualmente el cabezal del tubo buscando fugas de aceite o deterioro del encapsulado.",
      "Verifica los indicadores del panel: indicador de exposición, selección de punto focal, parámetros (kV, mA, tiempo/mAs).",
      "Revisa las 12 condiciones de operación: señalización, disparador fuera de sala, puertas plomadas, demarcación de áreas, etc.",
      "Registra todos los elementos de protección radiológica disponibles: chalecos, protectores de tiroides, guantes, gafas plomadas. Anota cantidad y estado.",
    ],
    criterios: [
      {
        descripcion: "Cada item de inspección",
        limite: "Conforme / No conforme / No aplica",
      },
      {
        descripcion: "Elementos de protección",
        limite: "Deben estar disponibles y en buen estado",
      },
    ],
    tips: [
      "Toma fotografías de cualquier hallazgo relevante (cables dañados, fugas de aceite, señalización faltante).",
      "Si encuentras un No conforme, documenta detalladamente en las observaciones.",
    ],
    alertas: [],
  },

  // ─── GRUPO B ───
  {
    codigo: "2.4",
    nombre: "Exactitud y repetibilidad del tiempo de exposición",
    grupo: "B",
    objetivo:
      "Verificar que el tiempo de exposición que indica el equipo corresponde al tiempo real medido por el sensor, y que al repetir la medición los resultados son consistentes.",
    instrumentacion: ["Sensor RaySafe X2 RF", "Cinta métrica"],
    pasos: [
      "Coloca el sensor RaySafe en el centro del haz a 100 cm del foco.",
      "Retira el Flat Panel o cassette del Bucky.",
      "Selecciona al menos 3 valores de tiempo clínicamente representativos (configurados en los grupos de disparos).",
      "Realiza mínimo 3 exposiciones por cada tiempo seleccionado.",
      "El sensor mide el tiempo real de cada disparo.",
      "El sistema calcula: desviación porcentual = |nominal − medido| / nominal × 100%.",
      "El sistema calcula: coeficiente de variación CV = desviación estándar / promedio × 100%.",
    ],
    criterios: [
      {
        descripcion: "Exactitud (desviación máxima)",
        limite: "≤ 10% respecto al valor nominal",
      },
      { descripcion: "Repetibilidad (CV)", limite: "≤ 10%" },
    ],
    tips: [
      "Los datos salen de los mismos disparos del Grupo B — no necesitas disparos adicionales.",
      "Los grupos 1 (60kV), 2 (80kV) y 6 (90kV) aportan datos para esta prueba.",
    ],
    alertas: [
      "No confundir el tiempo nominal (lo que configuras en el equipo) con el tiempo medido (lo que registra el sensor).",
    ],
  },
  {
    codigo: "2.5",
    nombre: "Exactitud y repetibilidad de la tensión del tubo (kVp)",
    grupo: "B",
    objetivo:
      "Verificar que el kilovoltaje (kVp) que indica el equipo corresponde al kVp real medido por el sensor, y que las mediciones son repetibles.",
    instrumentacion: ["Sensor RaySafe X2 RF", "Cinta métrica"],
    pasos: [
      "Usa las mismas mediciones del paso 3 del Grupo B.",
      "Para cada grupo de disparos, compara el kVp nominal (configurado) con el kVp medido (sensor).",
      "El sistema calcula la desviación porcentual y el CV por grupo.",
    ],
    criterios: [
      { descripcion: "Exactitud (desviación máxima)", limite: "≤ 10% respecto al nominal" },
      { descripcion: "Repetibilidad (CV)", limite: "≤ 5%" },
    ],
    tips: [
      "El CV para kVp es más estricto (5%) que para tiempo (10%) porque el kVp afecta directamente la calidad de imagen y la dosis al paciente.",
    ],
    alertas: [],
  },
  {
    codigo: "2.6",
    nombre: "Capa hemirreductora (CHR)",
    grupo: "B",
    objetivo:
      "Medir la calidad del haz de radiación. La CHR indica cuánto material (aluminio) se necesita para reducir la intensidad del haz a la mitad. Una CHR baja significa que el haz tiene muchos fotones de baja energía que no aportan a la imagen pero sí irradian al paciente.",
    instrumentacion: ["Sensor RaySafe X2 RF (mide CHR automáticamente)"],
    pasos: [
      "Usa las mismas mediciones del paso 3 del Grupo B.",
      "El sensor RaySafe determina automáticamente el valor de CHR a partir del espectro del haz.",
      "Compara el CHR medido con el mínimo requerido según el kVp usado.",
    ],
    criterios: [
      { descripcion: "CHR a 60 kVp", limite: "≥ 1.8 mm Al" },
      { descripcion: "CHR a 70 kVp", limite: "≥ 2.1 mm Al" },
      { descripcion: "CHR a 80 kVp", limite: "≥ 2.3 mm Al" },
      { descripcion: "CHR a 90 kVp", limite: "≥ 2.5 mm Al" },
    ],
    tips: [
      "Si la CHR es menor al mínimo, puede indicar que la filtración del tubo es insuficiente o que el tubo está deteriorado.",
      "La CHR depende de la filtración total del haz (inherente + añadida).",
    ],
    alertas: [],
  },
  {
    codigo: "2.7",
    nombre: "Rendimiento del tubo, repetibilidad y linealidad",
    grupo: "B",
    objetivo:
      "Medir cuánta radiación produce el tubo por cada mAs (rendimiento en μGy/mAs). Verificar que es consistente entre disparos iguales (repetibilidad) y proporcional al cambiar los mAs (linealidad).",
    instrumentacion: ["Sensor RaySafe X2 RF", "Cinta métrica"],
    pasos: [
      "Usa las mediciones de los grupos 2–6 del paso 3.",
      "Para cada grupo: calcula el rendimiento = (Dosis / mAs) × (distancia/80)² × 1000 → μGy/mAs.",
      "Repetibilidad: compara los 3 disparos del grupo 3 (80kV, 10mAs). CV debe ser ≤ 5%.",
      "Linealidad: compara el rendimiento entre grupos con diferente mAs (grupos 2, 3, 4, 5). La diferencia entre cualquier par consecutivo debe ser ≤ 10%.",
    ],
    criterios: [
      { descripcion: "Repetibilidad (CV del rendimiento)", limite: "≤ 5%" },
      {
        descripcion: "Linealidad (diferencia entre pares consecutivos)",
        limite: "≤ 10%",
      },
    ],
    tips: [
      "El rendimiento se normaliza a 80 cm para poder comparar entre diferentes distancias.",
      "Los grupos 4 y 5 tienen mAs libre — el físico elige valores diferentes para evaluar la linealidad.",
    ],
    alertas: [],
  },
  {
    codigo: "2.21",
    nombre: "Dosis al receptor de imagen",
    grupo: "B",
    objetivo:
      "Medir cuánta radiación llega al detector de imagen usando los programas clínicos reales del equipo. Se compara con los valores de referencia (base) de la visita anterior.",
    instrumentacion: [
      "Sensor RaySafe X2 RF",
      "Rejilla del equipo",
      "Cinta métrica",
    ],
    pasos: [
      "Haz 3 disparos CON rejilla usando programas clínicos reales (Extremidad, Tórax AP, Columna AP).",
      "Haz 3 disparos SIN rejilla con los mismos programas.",
      "Registra las distancias: d1 (foco → sensor) y d2 (foco → detector de imagen).",
      "La dosis al receptor se calcula: Dosis_receptor = Dosis_medida × (d1/d2)².",
      "Compara con los valores base de la precarga.",
    ],
    criterios: [
      {
        descripcion: "Diferencia con valor base",
        limite: "≤ 0.01 mGy",
      },
    ],
    tips: [
      "Para mediciones CON rejilla: ubica el sensor debajo de la rejilla.",
      "Para mediciones SIN rejilla: ubica el sensor entre el tubo y el detector. Orden: Detector → Profluoro 150 → Sensor → Tubo.",
      "La corrección por distancia (d1/d2)² es necesaria porque el sensor no está exactamente donde está el detector.",
    ],
    alertas: [
      "Retire el filtro de cobre antes de estas mediciones.",
      "Al cambiar entre con y sin rejilla, verifique que las distancias estén correctas.",
    ],
  },
  {
    codigo: "2.8",
    nombre: "Determinación del factor de corrección del producto kerma-área (PKA)",
    grupo: "B",
    objetivo:
      "Verificar si el medidor de dosis-área (DAP meter) del equipo está calibrado correctamente, calculando un factor de corrección.",
    instrumentacion: [
      "Sensor RaySafe X2 RF",
      "Cinta métrica",
      "Regla para medir campo de irradiación",
    ],
    pasos: [
      "Usa los mismos programas clínicos (Extremidad, Tórax, Columna).",
      "Mide el Kerma en aire con el sensor a la distancia conocida.",
      "Mide el ancho y largo del campo de irradiación en cm.",
      "Calcula el área de irradiación corregida: Área_corr = (ancho × largo) × (d2/d1)².",
      "Calcula el Kerma corregido: Kerma_corr = Kerma_medido × (d2/d1)².",
      "Calcula el DAP estimado = Kerma_corr × Área_corr.",
      "Factor de corrección = DAP_estimado / DAP_nominal (el que muestra el equipo).",
    ],
    criterios: [
      {
        descripcion: "Factor de corrección",
        limite: "Se registra como referencia — no tiene límite de aceptación estricto",
      },
    ],
    tips: [
      "Un factor muy diferente de 1.0 indica que el medidor DAP del equipo necesita recalibración.",
    ],
    alertas: ["Retire el filtro de cobre antes de las mediciones de Kerma."],
  },

  // ─── GRUPO C ───
  {
    codigo: "2.17",
    nombre: "Sensibilidad del control automático de exposición (CAE)",
    grupo: "C",
    objetivo:
      "Verificar que el CAE da valores similares a los de la visita anterior (valores base). Si cambió mucho, el CAE puede estar descalibrado.",
    instrumentacion: [
      "Placas de cobre (1 mm) como atenuador",
      "Equipo con CAE activado",
    ],
    pasos: [
      "Activa el CAE del equipo en modo automático.",
      "Coloca el colimador en modo manual.",
      "Coloca 1 placa de cobre (1 mm) como atenuador sobre el detector.",
      "Dispara a 70 kVp con el sensor CAE en posición 'Centro'.",
      "Registra: carga (mAs), EI (índice de exposición), D.I. (deviation index).",
      "Compara los valores con los de la visita anterior (base) guardados en la precarga.",
    ],
    criterios: [
      { descripcion: "Variación de mAs respecto a base", limite: "≤ 50%" },
      { descripcion: "Variación de EI respecto a base", limite: "≤ 50%" },
      { descripcion: "Variación de D.I. respecto a base", limite: "≤ 50%" },
    ],
    tips: [
      "Si no hay valores base (primera visita), esta prueba establece los valores de referencia.",
    ],
    alertas: [
      "Revisar la configuración del colimador — debe estar en modo MANUAL.",
      "Si se mueve la placa de cobre, hay que repetir toda la ronda de disparos.",
    ],
  },
  {
    codigo: "2.18",
    nombre: "Consistencia entre los sensores del CAE",
    grupo: "C",
    objetivo:
      "Verificar que los 3 sensores del CAE (izquierdo, centro, derecho) y sus combinaciones dan resultados similares entre sí.",
    instrumentacion: ["Placas de cobre (1 mm)", "Equipo con CAE activado"],
    pasos: [
      "Mantén la misma configuración: 70 kVp, Cu 1mm.",
      "Dispara con cada combinación de sensores: Izquierda, Centro, Derecha, Izq+Der, Izq+Centro, Centro+Der, Izq+Centro+Der.",
      "Registra mAs, EI y D.I. para cada combinación (7 mediciones).",
      "Calcula el promedio y la variación porcentual para cada parámetro.",
    ],
    criterios: [
      { descripcion: "Variación entre sensores (mAs)", limite: "≤ 30%" },
      { descripcion: "Variación entre sensores (EI)", limite: "≤ 30%" },
      { descripcion: "Variación entre sensores (D.I.)", limite: "≤ 30%" },
    ],
    tips: [
      "Si un sensor da resultados muy diferentes, puede estar dañado o desalineado.",
    ],
    alertas: [],
  },
  {
    codigo: "2.19",
    nombre: "Repetibilidad del CAE",
    grupo: "C",
    objetivo:
      "Verificar que el CAE da resultados consistentes al repetir disparos con la misma configuración.",
    instrumentacion: ["Placas de cobre (1 mm)", "Equipo con CAE activado"],
    pasos: [
      "Mantén: 70 kVp, Cu 1mm, sensor Centro.",
      "Dispara 4–5 veces con la misma configuración.",
      "Registra mAs, EI y D.I. de cada disparo.",
      "Calcula promedio, desviación estándar y coeficiente de variación (CV).",
    ],
    criterios: [
      { descripcion: "CV de la carga (mAs)", limite: "≤ 10%" },
      { descripcion: "CV del EI", limite: "≤ 10%" },
      { descripcion: "CV del D.I.", limite: "≤ 10%" },
    ],
    tips: [
      "Si el CV es alto, el CAE no está regulando consistentemente la exposición.",
    ],
    alertas: [],
  },
  {
    codigo: "2.20",
    nombre: "Compensación del CAE para diferentes kVp y espesores",
    grupo: "C",
    objetivo:
      "Verificar que el CAE ajusta correctamente la exposición cuando cambia el voltaje (kVp) o el espesor del paciente (simulado con placas de cobre de diferente grosor).",
    instrumentacion: [
      "Placas de cobre: 1 mm, 2 mm, 3 mm",
      "Equipo con CAE activado",
    ],
    pasos: [
      "Compensación por kVp: dispara a 60, 70 y 81 kVp con Cu 1mm y sensor Centro. Compara con valores base.",
      "Compensación por espesores: dispara a 81 kVp con Cu 1mm, 2mm y 3mm. Compara con valores base.",
      "Calcula la variación porcentual de mAs, EI y D.I. respecto a los valores base de cada configuración.",
    ],
    criterios: [
      { descripcion: "Variación por kVp (mAs, EI, D.I.)", limite: "≤ 30%" },
      {
        descripcion: "Variación por espesor (mAs, EI, D.I.)",
        limite: "≤ 30%",
      },
    ],
    tips: [
      "El CAE debe compensar: a mayor espesor → más mAs; a mayor kVp → menos mAs.",
      "Si no compensa, las imágenes de pacientes de diferente tamaño tendrán calidad inconsistente.",
    ],
    alertas: [],
  },

  // ─── GRUPO D ───
  {
    codigo: "2.9",
    nombre: "Control de calidad del DDI/EI",
    grupo: "D",
    objetivo:
      "Verificar que el indicador de dosis digital (DDI) y el índice de exposición (EI) del sistema de imagen reportan valores correctos y dentro del rango esperado.",
    instrumentacion: ["Placas de cobre (1 mm)", "Detector de imagen (DR o CR)"],
    pasos: [
      "Configura una técnica estándar (típicamente 70 kVp, Cu 1mm).",
      "Realiza una exposición con el detector de imagen en posición.",
      "Lee el DDI/EI reportado por el sistema de imagen.",
      "Compara con el rango esperado para la dosis entregada.",
    ],
    criterios: [
      {
        descripcion: "DDI/EI dentro del rango esperado",
        limite: "Según especificaciones del fabricante",
      },
    ],
    tips: [
      "El DDI y el EI son indicadores que el sistema de imagen usa para reportar cuánta dosis recibió el detector.",
    ],
    alertas: [],
  },
  {
    codigo: "2.10",
    nombre: "Repetibilidad del DDI/EI",
    grupo: "D",
    objetivo:
      "Verificar que al repetir exposiciones con la misma técnica, el DDI/EI reportado es consistente.",
    instrumentacion: ["Placas de cobre (1 mm)", "Detector de imagen"],
    pasos: [
      "Repite la misma exposición 4–5 veces.",
      "Registra el DDI/EI de cada exposición.",
      "Calcula el CV (coeficiente de variación).",
    ],
    criterios: [
      { descripcion: "CV del DDI/EI", limite: "≤ 10%" },
    ],
    tips: [],
    alertas: [],
  },
  {
    codigo: "2.14",
    nombre: "Integridad y limpieza de cassettes y pantallas IP",
    grupo: "D",
    objetivo:
      "Verificar que los cassettes y pantallas de imagen (CR) están en buen estado y limpios, sin artefactos que afecten la calidad de imagen.",
    instrumentacion: ["Inspección visual", "Exposición uniforme de prueba"],
    pasos: [
      "Inspecciona visualmente cada cassette buscando daños físicos.",
      "Realiza una exposición uniforme (flat field) con cada cassette.",
      "Revisa la imagen buscando artefactos, manchas o zonas de sensibilidad irregular.",
    ],
    criterios: [
      { descripcion: "Sin artefactos visibles en la imagen", limite: "Conforme / No conforme" },
      { descripcion: "Cassette sin daños físicos", limite: "Conforme / No conforme" },
    ],
    tips: [
      "Esta prueba solo aplica a sistemas CR (con cassettes). No aplica a detectores DR fijos.",
    ],
    alertas: [],
  },
  {
    codigo: "2.15",
    nombre: "Uniformidad de sensibilidad de pantallas IP CR",
    grupo: "D",
    objetivo:
      "Verificar que la pantalla de imagen CR tiene sensibilidad uniforme en toda su superficie.",
    instrumentacion: ["Detector CR", "Exposición uniforme"],
    pasos: [
      "Realiza una exposición uniforme que cubra toda la pantalla.",
      "Analiza la imagen resultante buscando variaciones de densidad.",
      "Mide la uniformidad en diferentes regiones de la imagen.",
    ],
    criterios: [
      { descripcion: "Uniformidad de la sensibilidad", limite: "Según fabricante" },
    ],
    tips: ["Solo aplica a sistemas CR."],
    alertas: [],
  },

  // ─── GRUPO E ───
  {
    codigo: "2.3",
    nombre: "Sistema de colimación del haz y perpendicularidad del rayo central",
    grupo: "E",
    objetivo:
      "Verificar que el colimador delimita correctamente el campo de radiación y que el rayo central es perpendicular al detector de imagen.",
    instrumentacion: [
      "Patrón de colimación / herramienta de alineación",
      "Detector de imagen",
      "Cinta métrica",
    ],
    pasos: [
      "Coloca el patrón de colimación sobre el detector.",
      "Realiza una exposición.",
      "En la imagen resultante, mide las desviaciones entre el campo luminoso y el campo de radiación.",
      "Verifica la perpendicularidad del rayo central.",
    ],
    criterios: [
      {
        descripcion: "Desviación del campo de radiación respecto al campo luminoso",
        limite: "≤ 2% de la distancia foco-detector por cada lado",
      },
      { descripcion: "Perpendicularidad del rayo central", limite: "≤ 1.5°" },
    ],
    tips: [
      "Toma fotografía del montaje experimental para documentar.",
    ],
    alertas: [],
  },
  {
    codigo: "2.11",
    nombre: "Uniformidad y artefactos del detector",
    grupo: "E",
    objetivo:
      "Verificar que el detector de imagen produce una respuesta uniforme y no tiene artefactos que afecten la calidad diagnóstica.",
    instrumentacion: [
      "Detector de imagen (DR o CR)",
      "Placa de cobre como filtro",
    ],
    pasos: [
      "Coloca el lado más largo del detector alineado con el tubo.",
      "Coloca un filtro de cobre a la salida del tubo.",
      "Realiza una exposición uniforme (flat field).",
      "Analiza la imagen DICOM buscando artefactos, líneas, manchas o zonas irregulares.",
    ],
    criterios: [
      { descripcion: "Sin artefactos visibles", limite: "Conforme / No conforme" },
      { descripcion: "Uniformidad de la respuesta", limite: "Según fabricante" },
    ],
    tips: [
      "Haz esta prueba ANTES que las demás o deja reposar el detector después para evitar imagen residual.",
    ],
    alertas: [
      "Coloca el filtro de cobre a la salida del tubo para obtener un haz uniforme.",
    ],
  },
  {
    codigo: "2.12",
    nombre: "Resolución espacial de alto contraste",
    grupo: "E",
    objetivo:
      "Determinar la capacidad del sistema para distinguir objetos pequeños y cercanos entre sí. Se mide en pares de líneas por milímetro (pl/mm).",
    instrumentacion: [
      "Patrón de resolución (tipo barra de plomo)",
      "Detector de imagen",
    ],
    pasos: [
      "Coloca el patrón de resolución sobre el detector.",
      "Realiza una exposición con técnica estándar.",
      "Observa la imagen e identifica el grupo de barras más fino que se puede distinguir.",
      "Registra la resolución en pl/mm.",
    ],
    criterios: [
      {
        descripcion: "Resolución espacial",
        limite: "≥ valor de referencia del sistema (según fabricante)",
      },
    ],
    tips: [
      "Usa zoom en la imagen para evaluar los patrones más finos.",
    ],
    alertas: [],
  },
  {
    codigo: "2.13",
    nombre: "Umbral de sensibilidad a bajo contraste",
    grupo: "E",
    objetivo:
      "Evaluar la capacidad del sistema para detectar diferencias sutiles de contraste, como las que aparecen en tejidos blandos.",
    instrumentacion: [
      "Patrón de bajo contraste (phantom con insertos de diferente densidad)",
      "Detector de imagen",
    ],
    pasos: [
      "Coloca el patrón de bajo contraste sobre el detector.",
      "Realiza una exposición con técnica estándar.",
      "Observa la imagen e identifica los insertos de menor contraste que son visibles.",
      "Registra el umbral de detección.",
    ],
    criterios: [
      {
        descripcion: "Umbral de bajo contraste",
        limite: "Según especificaciones del fabricante y valor de referencia",
      },
    ],
    tips: [
      "Esta prueba es sensible a las condiciones de visualización — usa un monitor calibrado.",
    ],
    alertas: [],
  },
  {
    codigo: "2.16",
    nombre: "Función de transferencia de modulación (MTF)",
    grupo: "E",
    objetivo:
      "Evaluar la capacidad del sistema para reproducir fielmente el contraste de objetos de diferente tamaño. Es una medida más precisa que la resolución visual.",
    instrumentacion: [
      "Patrón MTF o borde recto (edge phantom)",
      "Software de análisis DICOM",
    ],
    pasos: [
      "Coloca el patrón MTF o borde recto sobre el detector con una ligera inclinación (2–5°).",
      "Realiza una exposición.",
      "Exporta la imagen DICOM.",
      "Analiza con software especializado para calcular la curva MTF.",
      "Registra los valores de MTF a frecuencias clave (ej: MTF al 50%, MTF al 10%).",
    ],
    criterios: [
      {
        descripcion: "MTF",
        limite: "≥ valor de referencia del sistema",
      },
    ],
    tips: [
      "El análisis de MTF requiere software especializado y la imagen DICOM original.",
      "La inclinación del borde recto debe ser entre 2° y 5° para un cálculo preciso.",
    ],
    alertas: [],
  },
];

/** Busca una prueba por código */
export function getManualPrueba(codigo: string): ManualPrueba | undefined {
  return MANUAL_CONVENCIONAL.find((p) => p.codigo === codigo);
}

/** Obtiene todas las pruebas de un grupo */
export function getManualGrupo(grupo: string): ManualPrueba[] {
  return MANUAL_CONVENCIONAL.filter((p) => p.grupo === grupo.toUpperCase());
}
