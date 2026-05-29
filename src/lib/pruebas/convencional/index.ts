// ============================================================
//  Paquete de pruebas: CONVENCIONAL
//  21 pruebas en 7 grupos — TECDOC 1958 / Res. 1811
// ============================================================

import type { PaquetePruebas } from "../types";
import { GRUPOS_CONVENCIONAL } from "./grupos";

export const CONVENCIONAL_PACKAGE: PaquetePruebas = {
  tipo_equipo: "CONVENCIONAL",
  nombre: "Equipo de radiografía convencional",
  plantilla_informe: "FT-LEC-6c",
  grupos: GRUPOS_CONVENCIONAL,
};
