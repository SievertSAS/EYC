import { describe, it, expect } from "vitest";
import {
  toggleParametro,
  parametrosConsolaDefinidos,
  normalizarParametrosConsola,
} from "./parametros-consola";
import { PARAMETROS_CONSOLA, PARAMETRO_CONSOLA_LABELS } from "@/lib/db/types";

describe("#189 — parámetros nominales que muestra la consola", () => {
  it("catálogo canónico y etiquetas", () => {
    expect(PARAMETROS_CONSOLA).toEqual(["kv", "ma", "tiempo", "mas"]);
    expect(PARAMETRO_CONSOLA_LABELS).toEqual({
      kv: "kV",
      ma: "mA",
      tiempo: "Tiempo",
      mas: "mAs",
    });
  });

  describe("toggleParametro", () => {
    it("agrega un parámetro sin mutar la selección original", () => {
      const sel = ["kv"] as const;
      const out = toggleParametro([...sel], "mas");
      expect(out).toEqual(["kv", "mas"]);
      expect(sel).toEqual(["kv"]);
    });

    it("devuelve siempre el orden canónico (kV, mA, Tiempo, mAs)", () => {
      let sel = toggleParametro([], "mas");
      sel = toggleParametro(sel, "tiempo");
      sel = toggleParametro(sel, "kv");
      sel = toggleParametro(sel, "ma");
      expect(sel).toEqual(["kv", "ma", "tiempo", "mas"]);
    });

    it("quita un parámetro ya marcado; quitar el último deja []", () => {
      expect(toggleParametro(["kv", "ma"], "kv")).toEqual(["ma"]);
      expect(toggleParametro(["ma"], "ma")).toEqual([]);
    });

    it("tolera selección null/undefined (equipos existentes)", () => {
      expect(toggleParametro(null, "ma")).toEqual(["ma"]);
      expect(toggleParametro(undefined, "kv")).toEqual(["kv"]);
    });
  });

  describe("parametrosConsolaDefinidos", () => {
    it("true solo con un arreglo de al menos un elemento", () => {
      expect(parametrosConsolaDefinidos(["kv"])).toBe(true);
      expect(parametrosConsolaDefinidos([])).toBe(false);
      expect(parametrosConsolaDefinidos(null)).toBe(false);
      expect(parametrosConsolaDefinidos(undefined)).toBe(false);
    });
  });

  describe("normalizarParametrosConsola (para guardar)", () => {
    it("vacío → null (la columna queda sin definir)", () => {
      expect(normalizarParametrosConsola([])).toBeNull();
      expect(normalizarParametrosConsola(null)).toBeNull();
      expect(normalizarParametrosConsola(undefined)).toBeNull();
    });

    it("con selección → arreglo en orden canónico, sin duplicados", () => {
      expect(normalizarParametrosConsola(["mas", "kv", "mas"])).toEqual(["kv", "mas"]);
    });
  });
});
