import { describe, it, expect } from "vitest";
import { MANUAL_CONVENCIONAL, getManualPrueba, getManualGrupo } from "./manual";
import { CATALOGO_SECCIONES, getCatalogoSeccion } from "./informe-secciones";
import { ITEMS_INSPECCION_EQUIPO, ITEMS_CONDICIONES_OPERACION } from "./inspeccion-items";
import { GRUPOS_CONVENCIONAL } from "./grupos";

// Catálogos de texto estáticos (Módulo 9). Pin de estructura + consistencia
// con grupos.ts. No hay lógica que testear — sí que no se desincronicen.

const CODIGOS = GRUPOS_CONVENCIONAL.flatMap((g) => g.pruebas.map((p) => p.codigo));

describe("MANUAL_CONVENCIONAL", () => {
  it("una entrada por cada una de las 21 pruebas TECDOC", () => {
    expect(MANUAL_CONVENCIONAL).toHaveLength(21);
    expect(MANUAL_CONVENCIONAL.map((m) => m.codigo).sort()).toEqual([...CODIGOS].sort());
  });

  it("cada entrada tiene objetivo y pasos no vacíos", () => {
    for (const m of MANUAL_CONVENCIONAL) {
      expect(m.objetivo.trim(), m.codigo).not.toBe("");
      expect(m.pasos.length, m.codigo).toBeGreaterThan(0);
    }
  });

  it("getManualPrueba / getManualGrupo", () => {
    expect(getManualPrueba("2.1")?.grupo).toBe("A");
    expect(getManualPrueba("no-existe")).toBeUndefined();
    expect(getManualGrupo("a").map((m) => m.codigo)).toEqual(["2.1", "2.2"]);
    expect(getManualGrupo("A").length).toBe(2); // case-insensitive
  });

  it("el grupo del manual coincide con el de grupos.ts", () => {
    for (const grupo of GRUPOS_CONVENCIONAL) {
      for (const prueba of grupo.pruebas) {
        expect(getManualPrueba(prueba.codigo)?.grupo.toLowerCase(), prueba.codigo).toBe(
          grupo.codigo
        );
      }
    }
  });
});

describe("CATALOGO_SECCIONES", () => {
  it("21 secciones con objetivo y metodología", () => {
    expect(CATALOGO_SECCIONES).toHaveLength(21);
    for (const s of CATALOGO_SECCIONES) {
      expect(s.objetivo?.trim(), s.codigo).toBeTruthy();
      expect(s.metodologia?.trim(), s.codigo).toBeTruthy();
    }
  });

  it("getCatalogoSeccion", () => {
    expect(getCatalogoSeccion("2.5")?.grupo).toBe("B");
    expect(getCatalogoSeccion("9.9")).toBeUndefined();
  });
});

describe("inspeccion-items", () => {
  it("los checklists tienen la cantidad de ítems esperada", () => {
    expect(ITEMS_INSPECCION_EQUIPO).toHaveLength(4);
    expect(ITEMS_CONDICIONES_OPERACION).toHaveLength(12);
    for (const t of [...ITEMS_INSPECCION_EQUIPO, ...ITEMS_CONDICIONES_OPERACION]) {
      expect(t.trim()).not.toBe("");
    }
  });
});
