import { describe, it, expect } from "vitest";
import {
  actualizarDescripcionArea,
  agregarArea,
  aplicaCategoriaUbicacion,
  areasFlotantesCompletas,
  areasFlotantesDeVisita,
  normalizarAreasFlotantes,
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

const area = (nombre: string, descripcion = "") => ({ nombre, descripcion });

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

describe("normalizarAreasFlotantes (compatibilidad con string[] viejo)", () => {
  it("convierte los nombres sueltos (formato viejo) en áreas sin descripción", () => {
    expect(normalizarAreasFlotantes(["UCI adultos", "Urgencias"])).toEqual([
      area("UCI adultos"),
      area("Urgencias"),
    ]);
  });

  it("conserva las áreas con descripción y acepta formatos mezclados", () => {
    expect(
      normalizarAreasFlotantes([area("UCI adultos", "Cama 3, junto a la estación"), "Urgencias"])
    ).toEqual([area("UCI adultos", "Cama 3, junto a la estación"), area("Urgencias")]);
  });

  it("descarta basura: no-array, elementos sin nombre, nombres vacíos y repetidos", () => {
    expect(normalizarAreasFlotantes(null)).toEqual([]);
    expect(normalizarAreasFlotantes(undefined)).toEqual([]);
    expect(normalizarAreasFlotantes("UCI")).toEqual([]);
    expect(
      normalizarAreasFlotantes([
        42,
        null,
        { descripcion: "sin nombre" },
        "   ",
        { nombre: "UCI", descripcion: 7 },
        "uci",
      ])
    ).toEqual([area("UCI")]);
  });
});

describe("areasFlotantesDeVisita", () => {
  it("portátil flotante: devuelve las áreas elegidas", () => {
    const v = {
      categoria_ubicacion: "flotante" as const,
      ubicaciones_flotantes: [area("UCI adultos", "Cama 3")],
    };
    expect(areasFlotantesDeVisita(v, conv("portatil"))).toEqual([area("UCI adultos", "Cama 3")]);
  });

  it("datos viejos (string[]) se normalizan", () => {
    const v = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: ["UCI adultos"] };
    expect(areasFlotantesDeVisita(v, conv("portatil"))).toEqual([area("UCI adultos")]);
  });

  it("portátil flotante sin áreas: lista vacía (no null)", () => {
    const v = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: null };
    expect(areasFlotantesDeVisita(v, conv("portatil"))).toEqual([]);
  });

  it("fija, equipo fijo o datos viejos de un equipo que dejó de ser portátil: null", () => {
    const flot = { categoria_ubicacion: "flotante" as const, ubicaciones_flotantes: [area("UCI")] };
    expect(areasFlotantesDeVisita({ categoria_ubicacion: "fija" }, conv("portatil"))).toBeNull();
    expect(areasFlotantesDeVisita(flot, conv("fijo"))).toBeNull();
    expect(areasFlotantesDeVisita({}, conv("portatil"))).toBeNull();
  });
});

describe("agregarArea / quitarArea / actualizarDescripcionArea", () => {
  it("agrega con descripción vacía y no duplica un área ya elegida (mayúsculas/tildes)", () => {
    expect(agregarArea([area("UCI pediátrica")], "uci PEDIATRICA")).toEqual([
      area("UCI pediátrica"),
    ]);
    expect(agregarArea([area("UCI adultos", "Cama 3")], "  Reanimación ")).toEqual([
      area("UCI adultos", "Cama 3"),
      area("Reanimación"),
    ]);
    expect(agregarArea([], "   ")).toEqual([]);
  });

  it("quita por nombre normalizado", () => {
    expect(quitarArea([area("UCI adultos"), area("Reanimación", "x")], "reanimacion")).toEqual([
      area("UCI adultos"),
    ]);
  });

  it("actualiza solo la descripción del área indicada (nombre normalizado)", () => {
    const antes = [area("UCI adultos"), area("Reanimación", "vieja")];
    expect(actualizarDescripcionArea(antes, "REANIMACION", "Box 2")).toEqual([
      area("UCI adultos"),
      area("Reanimación", "Box 2"),
    ]);
    expect(antes[1].descripcion).toBe("vieja");
  });
});

describe("areasFlotantesCompletas", () => {
  it("exige al menos un área y descripción no vacía en todas", () => {
    expect(areasFlotantesCompletas([])).toBe(false);
    expect(areasFlotantesCompletas([area("UCI", "Cama 3"), area("Urgencias", "  ")])).toBe(false);
    expect(areasFlotantesCompletas([area("UCI", "Cama 3"), area("Urgencias", "Box 1")])).toBe(true);
  });
});

describe("textos del informe", () => {
  it("2.2.4: encabezado y una línea por área con su descripción", () => {
    expect(
      textoAreasFlotantes([
        area("UCI adultos", " Cama 3, junto a la estación. "),
        area("Urgencias"),
      ])
    ).toEqual([
      "Áreas evaluadas (ubicaciones flotantes):",
      "UCI adultos: Cama 3, junto a la estación.",
      "Urgencias",
    ]);
  });

  it("portada: flotante lista solo los nombres; si no, el nombre del servicio", () => {
    expect(
      textoAreaServicio("Radiología", [area("UCI adultos", "Cama 3"), area("Urgencias")])
    ).toBe("Ubicaciones flotantes: UCI adultos, Urgencias");
    expect(textoAreaServicio("Radiología", null)).toBe("Radiología");
    expect(textoAreaServicio(undefined, null)).toBe("No reporta");
    expect(textoAreaServicio("Radiología", [])).toBe("Radiología");
  });
});
