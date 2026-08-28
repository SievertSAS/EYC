import { describe, it, expect } from "vitest";
import { GRUPOS_CONVENCIONAL } from "./grupos";
import { CATALOGO_SECCIONES } from "./informe-secciones";
import { tieneCriterio } from "./evaluacion";

// grupos.ts es data estática. Estos tests FIJAN su estructura y su
// consistencia con informe-secciones.ts y evaluacion.ts — el mapeo
// código↔grupo tiene que coincidir entre los tres (la auditoría sospechaba
// una divergencia; no la hay, y este test la mantiene así).

const CODIGOS_TECDOC = Array.from({ length: 21 }, (_, i) => `2.${i + 1}`);

describe("GRUPOS_CONVENCIONAL — estructura", () => {
  it("5 grupos, códigos a-e en orden", () => {
    expect(GRUPOS_CONVENCIONAL.map((g) => g.codigo)).toEqual(["a", "b", "c", "d", "e"]);
    expect(GRUPOS_CONVENCIONAL.map((g) => g.orden)).toEqual([1, 2, 3, 4, 5]);
  });

  it("las 21 pruebas TECDOC (2.1-2.21) aparecen exactamente una vez", () => {
    const codigos = GRUPOS_CONVENCIONAL.flatMap((g) => g.pruebas.map((p) => p.codigo)).sort();
    expect(codigos).toHaveLength(21);
    expect(new Set(codigos).size).toBe(21);
    expect(codigos.sort()).toEqual([...CODIGOS_TECDOC].sort());
  });

  it("orden_global es único y va de 1 a 21", () => {
    const ordenes = GRUPOS_CONVENCIONAL.flatMap((g) => g.pruebas.map((p) => p.orden_global)).sort(
      (a, b) => a - b
    );
    expect(ordenes).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });
});

describe("consistencia grupos.ts ↔ informe-secciones.ts", () => {
  it("cada prueba de grupos.ts está en CATALOGO_SECCIONES y en el MISMO grupo", () => {
    for (const grupo of GRUPOS_CONVENCIONAL) {
      for (const prueba of grupo.pruebas) {
        const seccion = CATALOGO_SECCIONES.find((s) => s.codigo === prueba.codigo);
        expect(seccion, `sección para ${prueba.codigo}`).toBeDefined();
        // grupos.ts usa "a".."e"; el catálogo usa "A".."E".
        expect(seccion!.grupo.toLowerCase(), `grupo de ${prueba.codigo}`).toBe(grupo.codigo);
      }
    }
  });

  it("CATALOGO_SECCIONES no tiene códigos que grupos.ts no conozca", () => {
    const codigosGrupos = new Set(
      GRUPOS_CONVENCIONAL.flatMap((g) => g.pruebas.map((p) => p.codigo))
    );
    for (const s of CATALOGO_SECCIONES) {
      expect(codigosGrupos.has(s.codigo), `catálogo tiene ${s.codigo} que grupos.ts no`).toBe(true);
    }
  });
});

describe("consistencia con evaluacion.ts (tieneCriterio)", () => {
  it("2.8 es el único código sin criterio (documentado)", () => {
    expect(tieneCriterio("2.8")).toBe(false);
  });

  it("el resto de los 21 códigos tiene evaluador de criterio", () => {
    for (const c of CODIGOS_TECDOC) {
      if (c === "2.8") continue;
      expect(tieneCriterio(c), `tieneCriterio(${c})`).toBe(true);
    }
  });
});
