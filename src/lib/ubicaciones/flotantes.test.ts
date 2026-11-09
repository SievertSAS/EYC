import { describe, it, expect } from "vitest";
import {
  agregarArea,
  aplicaCategoriaUbicacion,
  areasFlotantesDeVisita,
  normalizarNombreUbicacion,
  quitarArea,
  textoAreaServicio,
  textoAreasFlotantes,
} from "./flotantes";

// ============================================================
//  #188 — ubicaciones del portátil: fija (una sala) o flotante (catálogo)
// ============================================================

const conv = (tipo_instalacion?: "fijo" | "portatil") => ({
  tipo_equipo: "CONVENCIONAL",
  tipo_instalacion,
});

describe("normalizarNombreUbicacion", () => {
  it("ignora mayúsculas, tildes y espacios repetidos", () => {
    expect(normalizarNombreUbicacion("  UCI   Pediátrica ")).toBe("uci pediatrica");
    expect(normalizarNombreUbicacion("uci pediatrica")).toBe("uci pediatrica");
    expect(normalizarNombreUbicacion("REANIMACIÓN")).toBe(normalizarNombreUbicacion("reanimacion"));
  });
});

describe("aplicaCategoriaUbicacion", () => {
  it("solo para el CONVENCIONAL portátil", () => {
    expect(aplicaCategoriaUbicacion(conv("portatil"))).toBe(true);
    expect(aplicaCategoriaUbicacion(conv("fijo"))).toBe(false);
    expect(aplicaCategoriaUbicacion(conv(undefined))).toBe(false);
    expect(
      aplicaCategoriaUbicacion({ tipo_equipo: "TOMOGRAFO", tipo_instalacion: "portatil" })
    ).toBe(false);
    expect(aplicaCategoriaUbicacion(undefined)).toBe(false);
  });
});

describe("areasFlotantesDeVisita", () => {
  it("portátil flotante: devuelve las áreas elegidas", () => {
    const v = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: ["UCI adultos"] };
    expect(areasFlotantesDeVisita(v, conv("portatil"))).toEqual(["UCI adultos"]);
  });

  it("portátil flotante sin áreas: lista vacía (no null)", () => {
    const v = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: null };
    expect(areasFlotantesDeVisita(v, conv("portatil"))).toEqual([]);
  });

  it("fija, equipo fijo o datos viejos de un equipo que dejó de ser portátil: null", () => {
    const flot = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: ["UCI"] };
    expect(areasFlotantesDeVisita({ categoria_ubicacion: "fija" }, conv("portatil"))).toBeNull();
    expect(areasFlotantesDeVisita(flot, conv("fijo"))).toBeNull();
    expect(areasFlotantesDeVisita({}, conv("portatil"))).toBeNull();
  });
});

describe("agregarArea / quitarArea", () => {
  it("no duplica un área ya elegida (mayúsculas/tildes)", () => {
    expect(agregarArea(["UCI pediátrica"], "uci PEDIATRICA")).toEqual(["UCI pediátrica"]);
    expect(agregarArea(["UCI adultos"], "  Reanimación ")).toEqual(["UCI adultos", "Reanimación"]);
    expect(agregarArea([], "   ")).toEqual([]);
  });

  it("quita por nombre normalizado", () => {
    expect(quitarArea(["UCI adultos", "Reanimación"], "reanimacion")).toEqual(["UCI adultos"]);
  });
});

describe("textos del informe", () => {
  it("lista de áreas flotantes para la 2.2.4", () => {
    expect(textoAreasFlotantes(["UCI adultos", "Reanimación"])).toBe(
      "Áreas evaluadas (ubicaciones flotantes): UCI adultos, Reanimación."
    );
  });

  it("portada: flotante lista las áreas; si no, el nombre del servicio", () => {
    expect(textoAreaServicio("Radiología", ["UCI adultos", "Urgencias"])).toBe(
      "Ubicaciones flotantes: UCI adultos, Urgencias"
    );
    expect(textoAreaServicio("Radiología", null)).toBe("Radiología");
    expect(textoAreaServicio(undefined, null)).toBe("No reporta");
    expect(textoAreaServicio("Radiología", [])).toBe("Radiología");
  });
});
