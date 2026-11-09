import { describe, it, expect } from "vitest";
import { contenidoPlantillaSchema, guardarBorradorSchema, publicarPlantillaSchema } from "./types";

describe("contenidoPlantillaSchema (#196)", () => {
  it("acepta textos por prueba y textos de informe", () => {
    const r = contenidoPlantillaSchema.safeParse({
      tituloInforme: "CONTROL DE CALIDAD",
      introduccion: "Uno.\n\nDos.",
      pruebas: { "2.1": { objetivo: "x", accionesNoConforme: "y" }, LEV: { criterio: "z" } },
    });
    expect(r.success).toBe(true);
  });

  it("#187: acepta la variante portátil (introducción + textos por prueba)", () => {
    const r = contenidoPlantillaSchema.safeParse({
      pruebas: {},
      variantes: { portatil: { introduccion: "P.", pruebas: { "2.5": { metodologia: "m" } } } },
    });
    expect(r.success).toBe(true);
  });

  it("#187: rechaza variantes desconocidas o campos raros en la variante", () => {
    expect(
      contenidoPlantillaSchema.safeParse({ pruebas: {}, variantes: { movil: {} } }).success
    ).toBe(false);
    expect(
      contenidoPlantillaSchema.safeParse({
        pruebas: {},
        variantes: { portatil: { pruebas: { "2.5": { script: "x" } } } },
      }).success
    ).toBe(false);
  });

  it("rechaza campos desconocidos dentro de una prueba", () => {
    const r = contenidoPlantillaSchema.safeParse({ pruebas: { "2.1": { script: "x" } } });
    expect(r.success).toBe(false);
  });

  it("rechaza claves de prueba con caracteres no permitidos", () => {
    const r = contenidoPlantillaSchema.safeParse({ pruebas: { "2.1<script>": { objetivo: "x" } } });
    expect(r.success).toBe(false);
  });

  it("rechaza textos desmedidos", () => {
    const r = contenidoPlantillaSchema.safeParse({
      pruebas: { "2.1": { objetivo: "a".repeat(20001) } },
    });
    expect(r.success).toBe(false);
  });
});

describe("guardarBorradorSchema / publicarPlantillaSchema", () => {
  it("exige un tipo de equipo válido y un código no vacío", () => {
    expect(
      guardarBorradorSchema.safeParse({
        tipo_equipo: "CONVENCIONAL",
        codigo: " FT-LEC-6c ",
        contenido: { pruebas: {} },
      })
    ).toMatchObject({ success: true, data: { codigo: "FT-LEC-6c" } });
    expect(
      guardarBorradorSchema.safeParse({
        tipo_equipo: "NAVE",
        codigo: "X",
        contenido: { pruebas: {} },
      }).success
    ).toBe(false);
    expect(
      guardarBorradorSchema.safeParse({
        tipo_equipo: "CONVENCIONAL",
        codigo: "  ",
        contenido: { pruebas: {} },
      }).success
    ).toBe(false);
    expect(publicarPlantillaSchema.safeParse({ tipo_equipo: "CT" }).success).toBe(true);
    expect(publicarPlantillaSchema.safeParse({}).success).toBe(false);
  });
});
