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
