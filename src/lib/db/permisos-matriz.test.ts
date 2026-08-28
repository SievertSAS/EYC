// Pin COMPLETO de la matriz de permisos por defecto (4 roles × 9 módulos ×
// 4 acciones = 144 decisiones). `permisos.test.ts` valida patrones; esto fija
// cada celda para que cualquier edición accidental de PERMISOS_DEFAULT_MATRIZ
// salte. Ver docs/modules/02-permisos.md.

import { describe, it, expect } from "vitest";
import { permisoDefault, MODULOS_APP, ROLES_DISPONIBLES } from "./types";
import type { AccionesPermiso } from "./types";

// Presets (mismos que en types.ts): [ver, crear, editar, eliminar]
const TOTAL: AccionesPermiso = { ver: true, crear: true, editar: true, eliminar: true };
const VER: AccionesPermiso = { ver: true, crear: false, editar: false, eliminar: false };
const NADA: AccionesPermiso = { ver: false, crear: false, editar: false, eliminar: false };
const GEST: AccionesPermiso = { ver: true, crear: true, editar: true, eliminar: false };
const EJEC: AccionesPermiso = { ver: true, crear: false, editar: true, eliminar: false };

// Matriz esperada. Orden de módulos = MODULOS_APP:
// dashboard, clientes, solicitudes, visitas, revision, equipos, informes, sync, configuracion
const ESPERADO: Record<string, AccionesPermiso[]> = {
  coordinador: [TOTAL, TOTAL, TOTAL, TOTAL, TOTAL, TOTAL, TOTAL, TOTAL, TOTAL],
  programador: [VER, VER, GEST, GEST, VER, VER, VER, VER, NADA],
  tecnico: [VER, NADA, NADA, EJEC, VER, EJEC, VER, VER, NADA],
  comercial: [VER, GEST, GEST, NADA, NADA, NADA, NADA, NADA, NADA],
};

describe("PERMISOS_DEFAULT_MATRIZ — pin completo (144 celdas)", () => {
  it("MODULOS_APP tiene el orden que asume ESPERADO", () => {
    expect(MODULOS_APP).toEqual([
      "dashboard",
      "clientes",
      "solicitudes",
      "visitas",
      "revision",
      "equipos",
      "informes",
      "sync",
      "configuracion",
    ]);
    expect(ROLES_DISPONIBLES).toEqual(["coordinador", "programador", "tecnico", "comercial"]);
  });

  for (const rol of ROLES_DISPONIBLES) {
    MODULOS_APP.forEach((modulo, i) => {
      it(`${rol} · ${modulo}`, () => {
        expect(permisoDefault(rol, modulo)).toEqual(ESPERADO[rol][i]);
      });
    });
  }
});
