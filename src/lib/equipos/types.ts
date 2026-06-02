// ============================================================
//  EquipmentPackage — interfaz central del paquete por equipo
//  Cada tipo de equipo define: módulos, pruebas e informe PDF
// ============================================================

import type { TipoEquipo } from "@/lib/db/types";
import type { GrupoPruebaDefinition } from "./grupo-types";

/** Módulo de visita (paso/sección dentro de una visita) */
export interface ModuloVisita {
  /** Identificador único del módulo */
  id: string;
  /** Nombre completo para mostrar en UI */
  nombre: string;
  /** Nombre corto para móvil/tabs */
  nombreCorto: string;
  /** Nombre del icono Lucide (resuelto dinámicamente) */
  icon: string;
  /** Orden de aparición en la navegación */
  orden: number;
  /** Si es true, bloquea envío a revisión cuando no está completado */
  requerido: boolean;
  /** Ruta del módulo (usada en URL) — por defecto igual al id */
  ruta?: string;
}

/** Paquete completo para un tipo de equipo */
export interface EquipmentPackage {
  /** Tipo de equipo al que aplica este paquete */
  tipo_equipo: TipoEquipo;
  /** Nombre descriptivo del equipo */
  nombre: string;
  /** Código de la plantilla de informe (ej: "FT-LEC-6c") */
  plantilla_informe: string;
  /** Módulos que aplican a este equipo (en orden) */
  modulos: ModuloVisita[];
  /** Grupos de pruebas con fórmulas y criterios */
  grupos: GrupoPruebaDefinition[];
  /** Función generadora del informe PDF específico */
  generarInforme: (visitaId: number) => Promise<Blob | null>;
}
