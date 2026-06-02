// ============================================================
//  Paquete completo: CONVENCIONAL
//  21 pruebas en 7 grupos — TECDOC 1958 / Res. 1811
//  6 módulos de visita
// ============================================================

import type { EquipmentPackage } from "../types";
import { MODULOS_CONVENCIONAL } from "./modulos";
import { GRUPOS_CONVENCIONAL } from "./grupos";
import { generarInformeConvencional } from "./informe";

export const CONVENCIONAL_PACKAGE: EquipmentPackage = {
  tipo_equipo: "CONVENCIONAL",
  nombre: "Equipo de radiografía convencional",
  plantilla_informe: "FT-LEC-6c",
  modulos: MODULOS_CONVENCIONAL,
  grupos: GRUPOS_CONVENCIONAL,
  generarInforme: generarInformeConvencional,
};
