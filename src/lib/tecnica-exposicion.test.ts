import { describe, expect, it } from "vitest";
import {
  campoDeColumna,
  campoDesactualizado,
  completarTecnica,
  leerTecnica,
  patchTecnica,
  recalcularCampo,
  registrarEdicion,
} from "./tecnica-exposicion";

describe("completarTecnica (mA × t = mAs)", () => {
  it("computes mAs from mA and time", () => {
    expect(completarTecnica({ ma: 200, t: 0.1 })).toEqual({ campo: "mas", valor: 20 });
  });

  it("computes time from mA and mAs", () => {
    expect(completarTecnica({ ma: 100, mas: 5 })).toEqual({ campo: "t", valor: 0.05 });
  });

  it("computes mA from time and mAs", () => {
    expect(completarTecnica({ t: 0.05, mas: 5 })).toEqual({ campo: "ma", valor: 100 });
  });

  it("does nothing when fewer than two values are present", () => {
    expect(completarTecnica({ ma: 100 })).toBeNull();
    expect(completarTecnica({})).toBeNull();
  });

  it("never overwrites when all three are present", () => {
    expect(completarTecnica({ ma: 200, t: 0.032, mas: 6.3 })).toBeNull();
  });

  it("does not divide by zero", () => {
    expect(completarTecnica({ ma: 0, mas: 5 })).toBeNull();
    expect(completarTecnica({ t: 0, mas: 5 })).toBeNull();
  });

  it("rounds away floating point noise", () => {
    expect(completarTecnica({ ma: 320, t: 0.032 })).toEqual({ campo: "mas", valor: 10.24 });
    expect(completarTecnica({ ma: 300, mas: 2 })).toEqual({ campo: "t", valor: 0.0067 });
    expect(completarTecnica({ t: 0.3, mas: 10 })).toEqual({ campo: "ma", valor: 33.3 });
  });
});

describe("patchTecnica", () => {
  const CAMPOS = { ma: "ma_nominal", t: "tiempo_nominal_s", mas: "mas_nominal" } as const;

  it("maps the computed value to the column name", () => {
    expect(
      patchTecnica(CAMPOS, { ma_nominal: 100, tiempo_nominal_s: null, mas_nominal: 5 })
    ).toEqual({ tiempo_nominal_s: 0.05 });
  });

  it("returns an empty patch when nothing can be computed", () => {
    expect(patchTecnica(CAMPOS, { ma_nominal: 100 })).toEqual({});
  });
});

describe("campoDesactualizado", () => {
  const coherente = { ma: 100, t: 0.05, mas: 5 };
  const incoherente = { ma: 200, t: 0.05, mas: 5 };

  it("returns null when the three values agree", () => {
    expect(campoDesactualizado(coherente, [])).toBeNull();
  });

  it("tolerates console rounding (within 5%)", () => {
    expect(campoDesactualizado({ ma: 200, t: 0.032, mas: 6.3 }, [])).toBeNull();
  });

  it("returns null when a value is missing", () => {
    expect(campoDesactualizado({ ma: 200, t: 0.05 }, [])).toBeNull();
  });

  it("defaults to mAs when nothing was edited in this session", () => {
    expect(campoDesactualizado(incoherente, [])).toBe("mas");
  });

  it("flags mAs after mA was edited", () => {
    expect(campoDesactualizado(incoherente, ["ma"])).toBe("mas");
  });

  it("flags time after mAs was edited", () => {
    expect(campoDesactualizado(incoherente, ["mas"])).toBe("t");
  });

  it("flags the field not touched in the last two edits", () => {
    expect(campoDesactualizado(incoherente, ["t", "mas"])).toBe("ma");
    expect(campoDesactualizado(incoherente, ["ma", "t", "mas"])).toBe("mas");
  });
});

describe("registrarEdicion", () => {
  it("keeps the most recent edit first without duplicates", () => {
    expect(registrarEdicion(["t", "ma"], "ma")).toEqual(["ma", "t"]);
    expect(registrarEdicion([], "mas")).toEqual(["mas"]);
  });
});

describe("recalcularCampo", () => {
  it("recomputes the given field from the other two", () => {
    expect(recalcularCampo({ ma: 200, t: 0.05, mas: 5 }, "mas")).toBe(10);
    expect(recalcularCampo({ ma: 200, t: 0.05, mas: 5 }, "t")).toBe(0.025);
    expect(recalcularCampo({ ma: 200, t: 0.05, mas: 5 }, "ma")).toBe(100);
  });

  it("returns null when it cannot compute", () => {
    expect(recalcularCampo({ ma: 0, t: 0.05, mas: 5 }, "t")).toBeNull();
  });
});

describe("leerTecnica / campoDeColumna", () => {
  const CAMPOS = { ma: "tecnica_ma", t: "tecnica_tiempo_s", mas: "tecnica_mas" } as const;

  it("reads the technique from a record with its own column names", () => {
    expect(leerTecnica(CAMPOS, { tecnica_ma: 100, tecnica_mas: 5 })).toEqual({
      ma: 100,
      t: undefined,
      mas: 5,
    });
  });

  it("maps a column back to its technique field", () => {
    expect(campoDeColumna(CAMPOS, "tecnica_tiempo_s")).toBe("t");
    expect(campoDeColumna(CAMPOS, "tecnica_kv")).toBeUndefined();
  });
});
