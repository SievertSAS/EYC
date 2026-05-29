// ============================================================
//  Tipos del sistema de paquetes de pruebas
//  Un paquete agrupa todas las pruebas para un tipo de equipo
// ============================================================

import type {
  TipoEquipo,
  MedicionSchema,
  SlotImagen,
  FormulaDefinicion,
  CriterioAceptacion,
  TextosPrueba,
} from "@/lib/db/types";

/** Paquete completo de pruebas para un tipo de equipo */
export interface PaquetePruebas {
  tipo_equipo: TipoEquipo;
  nombre: string;
  plantilla_informe: string;
  grupos: GrupoPruebaDefinition[];
}

/** Definición de un grupo dentro de un paquete */
export interface GrupoPruebaDefinition {
  codigo: string;
  nombre: string;
  orden: number;
  schema_mediciones: MedicionSchema;
  slots_imagen: SlotImagen[];
  pruebas: PruebaEnGrupo[];
}

/** Definición de una prueba dentro de un grupo */
export interface PruebaEnGrupo {
  codigo: string;
  numero_tecdoc: string;
  nombre: string;
  descripcion: string;
  orden_en_grupo: number;
  orden_global: number;
  formulas: FormulaDefinicion[];
  criterios_aceptacion: CriterioAceptacion[];
  textos_informe: TextosPrueba;
  slots_imagen: SlotImagen[];
}
