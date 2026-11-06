import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import type { PlantillaInforme } from "./types";
import {
  contenidoDe,
  obtenerPlantillaVigente,
  parrafosIntroduccion,
  resolverPlantilla,
  seccionConPlantilla,
  textosDePrueba,
} from "./resolver";

// ============================================================
//  #196 — Resolución de la plantilla de informe vigente.
//  Regla: la última versión PUBLICADA del tipo de equipo; sin versiones,
//  el catálogo en código hace de "v0". Campo a campo, un texto vacío de
//  la plantilla cae al del catálogo.
// ============================================================

const cat21 = CATALOGO_SECCIONES.find((c) => c.codigo === "2.1")!;

function publicada(over: Partial<PlantillaInforme>): PlantillaInforme {
  return {
    id: crypto.randomUUID(),
    tipo_equipo: "CONVENCIONAL",
    codigo: "FT-LEC-6c",
    version: 1,
    estado: "publicada",
    contenido: { pruebas: {} },
    publicada_por: "dt-1",
    publicada_en: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("resolverPlantilla — v0 (catálogo en código)", () => {
  it("CONVENCIONAL sin plantilla publicada → textos del catálogo, versión 0, sin id", () => {
    const p = resolverPlantilla("CONVENCIONAL");
    expect(p.plantillaId).toBeNull();
    expect(p.version).toBe(0);
    expect(p.codigo).toBe("FT-LEC-6c");
    expect(p.tituloInforme).toContain("RADIOGRAFÍA GENERAL");
    expect(textosDePrueba(p, "2.1").objetivo).toBe(cat21.objetivo);
    expect(textosDePrueba(p, "2.2").analisis).toBe(
      CATALOGO_SECCIONES.find((c) => c.codigo === "2.2")!.analisis
    );
    expect(p.pruebas.map((x) => x.codigo)).toEqual(CATALOGO_SECCIONES.map((c) => c.codigo));
  });

  it("la introducción por defecto son los 4 párrafos del informe actual", () => {
    const parrafos = parrafosIntroduccion(resolverPlantilla("CONVENCIONAL"));
    expect(parrafos).toHaveLength(4);
    expect(parrafos[0]).toMatch(/^El presente informe técnico documenta/);
  });

  it("tipos sin paquete (PANORAMICO) usan las pruebas del catálogo genérico de ese tipo", () => {
    const p = resolverPlantilla("PANORAMICO");
    const codigos = p.pruebas.map((x) => x.codigo);
    expect(codigos).toContain("LEV");
    expect(codigos).toContain("ALI_PAN");
    expect(codigos).not.toContain("COL"); // COL es solo de radiografía general
    expect(p.codigo).toBe("FT-LEC-6b");
    expect(textosDePrueba(p, "LEV").objetivo).toMatch(/levantamiento radiométrico/);
  });

  it("prueba sin texto específico en un tipo sin paquete → texto genérico TECDOC", () => {
    const p = resolverPlantilla("PANORAMICO");
    expect(textosDePrueba(p, "ALI_PAN").metodologia).toMatch(/IAEA-TECDOC-1958/);
  });
});

describe("resolverPlantilla — con versión publicada", () => {
  it("el texto publicado reemplaza al del catálogo; lo no editado cae al catálogo", () => {
    const fila = publicada({
      version: 3,
      codigo: "FT-LEC-6c-R2",
      contenido: {
        tituloInforme: "TITULO-PLANTILLA",
        introduccion: "Parrafo uno.\n\nParrafo dos.",
        pruebas: { "2.1": { objetivo: "OBJETIVO-PLANTILLA", criterio: "   " } },
      },
    });
    const p = resolverPlantilla("CONVENCIONAL", fila);
    expect(p.plantillaId).toBe(fila.id);
    expect(p.version).toBe(3);
    expect(p.codigo).toBe("FT-LEC-6c-R2");
    expect(p.tituloInforme).toBe("TITULO-PLANTILLA");
    expect(parrafosIntroduccion(p)).toEqual(["Parrafo uno.", "Parrafo dos."]);
    expect(textosDePrueba(p, "2.1").objetivo).toBe("OBJETIVO-PLANTILLA");
    // Vacío / solo espacios → catálogo
    expect(textosDePrueba(p, "2.1").criterio).toBe(cat21.criterio);
    expect(textosDePrueba(p, "2.1").metodologia).toBe(cat21.metodologia);
  });

  it("seccionConPlantilla conserva nombre/grupo/orden del catálogo y aplica los textos", () => {
    const p = resolverPlantilla(
      "CONVENCIONAL",
      publicada({ contenido: { pruebas: { "2.1": { accionesNoConforme: "ACCIONES-NC" } } } })
    );
    const s = seccionConPlantilla(cat21, p);
    expect(s.nombre).toBe(cat21.nombre);
    expect(s.grupo).toBe(cat21.grupo);
    expect(s.accionesNoConforme).toBe("ACCIONES-NC");
    expect(s.objetivo).toBe(cat21.objetivo);
  });

  it("contenidoDe devuelve el contenido EFECTIVO completo (para precargar el editor)", () => {
    const p = resolverPlantilla(
      "CONVENCIONAL",
      publicada({ contenido: { pruebas: { "2.1": { objetivo: "OBJ-EDITADO" } } } })
    );
    const c = contenidoDe(p);
    expect(c.pruebas["2.1"].objetivo).toBe("OBJ-EDITADO");
    expect(c.pruebas["2.3"].objetivo).toBe(
      CATALOGO_SECCIONES.find((x) => x.codigo === "2.3")!.objetivo
    );
    expect(c.introduccion).toMatch(/El presente informe técnico/);
    // Solo campos que la prueba usa: la 2.1 no tiene análisis fijo.
    expect(c.pruebas["2.1"]).not.toHaveProperty("analisis");
  });
});

describe("obtenerPlantillaVigente (Dexie)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("sin filas → v0", async () => {
    const p = await obtenerPlantillaVigente("CONVENCIONAL");
    expect(p.version).toBe(0);
    expect(p.plantillaId).toBeNull();
  });

  it("toma la versión publicada más alta; ignora borradores, otros tipos y borradas", async () => {
    await db.plantillas_informe.bulkAdd([
      publicada({ id: "v1", version: 1 }),
      publicada({ id: "v2", version: 2 }),
      publicada({ id: "v9-borrada", version: 9, deleted_at: "2026-10-02T00:00:00Z" }),
      publicada({ id: "otro-tipo", version: 5, tipo_equipo: "PANORAMICO" }),
      {
        ...publicada({ id: "borrador" }),
        estado: "borrador",
        version: null,
        publicada_en: null,
        publicada_por: null,
      },
    ]);
    const p = await obtenerPlantillaVigente("CONVENCIONAL");
    expect(p.plantillaId).toBe("v2");
    expect(p.version).toBe(2);
  });
});
