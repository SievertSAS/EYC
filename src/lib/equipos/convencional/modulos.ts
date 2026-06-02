// ============================================================
//  Módulos de visita para equipo CONVENCIONAL
//  Define qué secciones aplican y en qué orden
// ============================================================

import type { ModuloVisita } from "../types";

export const MODULOS_CONVENCIONAL: ModuloVisita[] = [
  {
    id: "condiciones",
    nombre: "Condiciones Ambientales",
    nombreCorto: "Condiciones",
    icon: "Thermometer",
    orden: 1,
    requerido: true,
  },
  {
    id: "levantamiento",
    nombre: "Levantamiento Radiométrico",
    nombreCorto: "Levantamiento",
    icon: "Gauge",
    orden: 2,
    requerido: true,
  },
  {
    id: "inspeccion",
    nombre: "Inspección Visual",
    nombreCorto: "Inspección",
    icon: "Eye",
    orden: 3,
    requerido: false,
  },
  {
    id: "pruebas",
    nombre: "Pruebas de Control de Calidad",
    nombreCorto: "Pruebas",
    icon: "FlaskConical",
    orden: 4,
    requerido: true,
  },
  {
    id: "evidencias",
    nombre: "Evidencias Fotográficas",
    nombreCorto: "Evidencias",
    icon: "Camera",
    orden: 5,
    requerido: false,
  },
  {
    id: "pre-informe",
    nombre: "Pre-Informe PDF",
    nombreCorto: "Pre-Informe",
    icon: "FileText",
    orden: 6,
    requerido: false,
    ruta: "pre-informe",
  },
];
