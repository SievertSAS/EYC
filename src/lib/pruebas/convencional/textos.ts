// ============================================================
//  Textos TECDOC 1958 para las pruebas de equipo convencional
//  Usados en la generación del informe PDF
// ============================================================

import type { TextosPrueba } from "@/lib/db/types";

export const TEXTOS: Record<string, TextosPrueba> = {
  // ─── Grupo A ───
  "2.1": {
    objetivo:
      "Verificar que las tasas de dosis en los puntos de interés cumplen con los niveles de referencia establecidos para las áreas controladas y supervisadas.",
    instrumentacion:
      "Detector de radiación calibrado tipo cámara de ionización o detector Geiger-Müller.",
    metodologia:
      "Se realizan mediciones de tasa de dosis en los puntos de interés previamente identificados, con el equipo operando a la técnica máxima de uso clínico.",
    criterio:
      "La dosis anual en áreas controladas no debe superar 5 mSv/año. En áreas supervisadas no debe superar 0.5 mSv/año (Resolución 1811 de 2025).",
  },
  "2.2": {
    objetivo:
      "Verificar el estado físico general del equipo de rayos X, la integridad de los blindajes y los elementos de protección radiológica.",
    instrumentacion: "Inspección visual directa.",
    metodologia:
      "Se realiza inspección visual del equipo, sus componentes, estado de blindajes, señalización y elementos de protección radiológica disponibles.",
    criterio:
      "Todos los componentes deben estar en buen estado de funcionamiento. Los elementos de protección deben estar disponibles y en condiciones adecuadas.",
  },

  // ─── Grupo B ───
  "2.3": {
    objetivo:
      "Evaluar la coincidencia del campo luminoso con el campo de radiación y la perpendicularidad del haz central.",
    instrumentacion:
      "Herramienta de prueba de colimación (plantilla de colimación), película radiográfica o detector digital.",
    metodologia:
      "Se coloca la herramienta de colimación sobre el receptor de imagen, se realiza una exposición y se miden las desviaciones entre el campo de luz y el campo de radiación en los cuatro bordes.",
    criterio:
      "La desviación total del campo luminoso respecto al campo de radiación no debe exceder el 3% de la DFI. La desviación de perpendicularidad no debe exceder 1.5° (TECDOC 1958).",
  },
  "2.12": {
    objetivo:
      "Evaluar la resolución espacial de alto contraste del sistema de imagen.",
    instrumentacion:
      "Patrón de resolución de alto contraste (pares de líneas por milímetro).",
    metodologia:
      "Se realiza una exposición del patrón de resolución a la técnica clínica estándar y se determina visualmente el número máximo de pares de líneas resueltos.",
    criterio:
      "La resolución debe ser mayor o igual al valor de referencia establecido para el sistema (TECDOC 1958).",
  },
  "2.13": {
    objetivo:
      "Evaluar la resolución de bajo contraste del sistema de imagen.",
    instrumentacion: "Patrón de resolución de bajo contraste.",
    metodologia:
      "Se realiza una exposición del patrón de bajo contraste y se evalúan los objetos visibles en la imagen.",
    criterio:
      "La cantidad de objetos visibles debe ser mayor o igual al valor de referencia (TECDOC 1958).",
  },

  // ─── Grupo C ───
  "2.4": {
    objetivo:
      "Evaluar la exactitud y repetibilidad del tiempo de exposición indicado por el generador.",
    instrumentacion: "Detector multifunción tipo RaySafe o equivalente.",
    metodologia:
      "Se realizan al menos 3 mediciones a cada técnica seleccionada, registrando el tiempo nominal y el tiempo medido.",
    criterio:
      "La desviación del tiempo de exposición no debe exceder ±20% para tiempos ≥ 100 ms. CV% ≤ 10% (TECDOC 1958).",
  },
  "2.5": {
    objetivo:
      "Evaluar la exactitud y repetibilidad de la tensión del tubo de rayos X (kVp).",
    instrumentacion: "Detector multifunción tipo RaySafe o equivalente.",
    metodologia:
      "Se realizan mediciones de kVp a los valores nominales seleccionados y se calculan las desviaciones y coeficiente de variación.",
    criterio:
      "La desviación del kVp no debe exceder ±10%. CV% ≤ 5% (TECDOC 1958).",
  },
  "2.6": {
    objetivo:
      "Determinar la capa hemirreductora (CHR) del haz de rayos X para verificar la filtración del equipo.",
    instrumentacion:
      "Detector multifunción con medición de HVL o láminas de aluminio de alta pureza.",
    metodologia:
      "Se mide el HVL directamente con el detector multifunción o se realizan mediciones con diferentes espesores de aluminio.",
    criterio:
      "La CHR medida debe ser mayor o igual al valor mínimo establecido para el kVp de operación según TECDOC 1958.",
  },
  "2.7": {
    objetivo:
      "Evaluar el rendimiento del tubo de rayos X (kerma en aire por unidad de carga) y su linealidad.",
    instrumentacion: "Detector multifunción tipo RaySafe o equivalente.",
    metodologia:
      "Se mide la dosis a diferentes valores de mAs manteniendo el kVp constante. Se calcula el rendimiento (µGy/mAs) y su linealidad.",
    criterio:
      "El rendimiento debe ser estable (CV ≤ 10%). La linealidad (variación entre valores de mAs) debe ser ≤ 20% (TECDOC 1958).",
  },
  "2.8": {
    objetivo:
      "Evaluar la repetibilidad y reproducibilidad de la dosis de salida del equipo.",
    instrumentacion: "Detector multifunción tipo RaySafe o equivalente.",
    metodologia:
      "Se realizan múltiples exposiciones consecutivas a la misma técnica y se calcula el coeficiente de variación de la dosis.",
    criterio: "CV% de la dosis ≤ 10% (TECDOC 1958).",
  },
  "2.21": {
    objetivo:
      "Estimar la dosis al paciente para las proyecciones clínicas más frecuentes.",
    instrumentacion: "Detector multifunción tipo RaySafe o equivalente.",
    metodologia:
      "Se calcula el kerma en aire incidente (Ki) a partir del rendimiento del tubo, la técnica clínica y la distancia foco-piel.",
    criterio:
      "La dosis estimada no debe exceder los niveles de referencia diagnósticos establecidos (Resolución 1811 de 2025).",
  },

  // ─── Grupo D ───
  "2.9": {
    objetivo:
      "Verificar la calibración del indicador de dosis al detector (DDI/EI/S) del sistema de imagen digital.",
    instrumentacion:
      "Detector multifunción y sistema de adquisición digital.",
    metodologia:
      "Se realizan exposiciones a diferentes niveles de mAs y se comparan los valores de DDI/EI indicados por el sistema con los esperados.",
    criterio:
      "La desviación del DDI/EI respecto al valor de referencia no debe exceder ±20% (TECDOC 1958).",
  },
  "2.10": {
    objetivo:
      "Evaluar la repetibilidad del indicador de dosis al detector (DDI/EI).",
    instrumentacion:
      "Sistema de adquisición digital.",
    metodologia:
      "Se realizan múltiples exposiciones a la misma técnica y se calcula el CV% del DDI/EI.",
    criterio: "CV% del DDI/EI ≤ 10% (TECDOC 1958).",
  },

  // ─── Grupo E ───
  "2.11": {
    objetivo:
      "Evaluar la uniformidad de la imagen y detectar la presencia de artefactos.",
    instrumentacion:
      "Software de análisis DICOM, fantoma de uniformidad o imagen sin objeto.",
    metodologia:
      "Se adquiere una imagen uniforme y se analizan 5 regiones de interés (ROI) en posiciones estándar, calculando la media, desviación estándar y SNR.",
    criterio:
      "La variación de la señal entre ROIs no debe exceder ±10% respecto al valor central. No deben observarse artefactos significativos (TECDOC 1958).",
  },
  "2.16": {
    objetivo:
      "Evaluar la función de transferencia de modulación (MTF) del sistema de imagen.",
    instrumentacion:
      "Patrón de MTF o borde recto, software de análisis.",
    metodologia:
      "Se adquiere imagen del patrón de MTF y se calcula la MTF al 50% y 20% en ambas direcciones (horizontal y vertical).",
    criterio:
      "Los valores de MTF deben ser mayores o iguales al 80% del valor de referencia (TECDOC 1958).",
  },

  // ─── Grupo F ───
  "2.14": {
    objetivo:
      "Verificar la integridad física y funcional de los chasis radiográficos o placas de imagen (IP).",
    instrumentacion: "Inspección visual y negatoscopio o monitor DICOM.",
    metodologia:
      "Se inspeccionan visualmente los chasis, se verifica el cierre, la limpieza de las pantallas y la ausencia de artefactos en la imagen.",
    criterio:
      "Los chasis deben estar en buen estado, sin daños visibles. Las imágenes no deben presentar artefactos atribuibles al chasis (TECDOC 1958).",
  },
  "2.15": {
    objetivo:
      "Evaluar la uniformidad de sensibilidad entre las placas de imagen (IP) del servicio.",
    instrumentacion:
      "Sistema CR/DR, exposición controlada.",
    metodologia:
      "Se exponen todas las placas IP a las mismas condiciones y se compara el DDI/EI entre ellas.",
    criterio:
      "La variación del DDI/EI entre placas no debe exceder ±10% respecto al valor medio (TECDOC 1958).",
  },

  // ─── Grupo G ───
  "2.17": {
    objetivo:
      "Evaluar la sensibilidad del control automático de exposición (CAE).",
    instrumentacion:
      "Detector multifunción, láminas de atenuación.",
    metodologia:
      "Se realizan exposiciones con CAE activo a diferentes espesores de atenuador y se verifica que la dosis al detector permanezca estable.",
    criterio:
      "La variación de la dosis al detector con diferentes espesores no debe exceder ±20% respecto al valor de referencia (TECDOC 1958).",
  },
  "2.18": {
    objetivo:
      "Evaluar la consistencia del CAE a diferentes valores de kVp.",
    instrumentacion:
      "Detector multifunción, sistema de adquisición digital.",
    metodologia:
      "Se realizan exposiciones con CAE a diferentes kVp manteniendo el espesor del atenuador constante.",
    criterio:
      "La variación del DDI/EI entre los diferentes kVp no debe exceder ±20% (TECDOC 1958).",
  },
  "2.19": {
    objetivo:
      "Evaluar la repetibilidad del control automático de exposición.",
    instrumentacion: "Detector multifunción, sistema de adquisición digital.",
    metodologia:
      "Se realizan múltiples exposiciones consecutivas con CAE a la misma técnica.",
    criterio: "CV% de la dosis y del DDI/EI ≤ 10% (TECDOC 1958).",
  },
  "2.20": {
    objetivo:
      "Evaluar la compensación del CAE para diferentes espesores del paciente.",
    instrumentacion:
      "Detector multifunción, láminas de atenuación de diferentes espesores.",
    metodologia:
      "Se realizan exposiciones con diferentes espesores de atenuador (simulando distintos grosores de paciente) y se verifica la compensación del CAE.",
    criterio:
      "La variación del DDI/EI entre espesores no debe exceder ±20% respecto al valor de referencia (TECDOC 1958).",
  },
};
