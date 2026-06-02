import { describe, it, expect } from "vitest";
import {
  stats,
  formulaHelpers,
  evaluateFormula,
  evaluateAllFormulas,
  evaluateFormulaSummaries,
  evaluateCriterio,
  evaluateCriterios,
  suggestConcepto,
} from "./engine";
import type { FormulaDefinicion, CriterioAceptacion } from "@/lib/db/types";

// ─── stats helpers ───

describe("stats", () => {
  it("mean of empty array returns 0", () => {
    expect(stats.mean([])).toBe(0);
  });

  it("mean calculates correctly", () => {
    expect(stats.mean([2, 4, 6])).toBe(4);
  });

  it("stddev of < 2 elements returns 0", () => {
    expect(stats.stddev([])).toBe(0);
    expect(stats.stddev([5])).toBe(0);
  });

  it("stddev calculates sample standard deviation", () => {
    const result = stats.stddev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });

  it("cv returns coefficient of variation as percentage", () => {
    expect(stats.cv([10, 10, 10])).toBe(0);
    const cv = stats.cv([90, 100, 110]);
    expect(cv).toBeGreaterThan(0);
    expect(cv).toBeLessThan(15);
  });

  it("cv returns 0 when mean is 0", () => {
    expect(stats.cv([0, 0])).toBe(0);
  });

  it("max/min/sum/count work on arrays", () => {
    expect(stats.max([3, 1, 4, 1, 5])).toBe(5);
    expect(stats.min([3, 1, 4, 1, 5])).toBe(1);
    expect(stats.sum([1, 2, 3])).toBe(6);
    expect(stats.count([1, 2, 3])).toBe(3);
  });

  it("max/min return 0 on empty arrays", () => {
    expect(stats.max([])).toBe(0);
    expect(stats.min([])).toBe(0);
  });
});

// ─── formulaHelpers ───

describe("formulaHelpers", () => {
  describe("variacionVsCentro", () => {
    it("returns 0 when no Centro row", () => {
      const rows = [
        { roi: "Superior", media_pixel: 100 },
        { roi: "Inferior", media_pixel: 110 },
      ];
      expect(formulaHelpers.variacionVsCentro(rows, "media_pixel")).toBe(0);
    });

    it("calculates max percentage deviation from Centro", () => {
      const rows = [
        { roi: "Centro", media_pixel: 100 },
        { roi: "Superior", media_pixel: 105 },
        { roi: "Inferior", media_pixel: 90 },
      ];
      expect(formulaHelpers.variacionVsCentro(rows, "media_pixel")).toBe(10);
    });
  });

  describe("variacionVsMedia", () => {
    it("returns 0 with fewer than 2 values", () => {
      const rows = [{ ddi_valor: 100 }];
      expect(formulaHelpers.variacionVsMedia(rows, "ddi_valor")).toBe(0);
    });

    it("calculates max percentage deviation from mean", () => {
      const rows = [{ ddi_valor: 100 }, { ddi_valor: 110 }, { ddi_valor: 90 }];
      const result = formulaHelpers.variacionVsMedia(rows, "ddi_valor");
      expect(result).toBeCloseTo(10, 0);
    });

    it("filters by field/value when provided", () => {
      const rows = [
        { tipo: "a", val: 100 },
        { tipo: "a", val: 110 },
        { tipo: "b", val: 200 },
      ];
      const result = formulaHelpers.variacionVsMedia(rows, "val", "tipo", "a");
      expect(result).toBeCloseTo(4.76, 1);
    });
  });
});

// ─── Expression validation ───

describe("evaluateFormula - expression validation", () => {
  const makeFormula = (expr: string): FormulaDefinicion => ({
    campo_resultado: "test",
    label: "Test",
    expresion: expr,
    dependencias: [],
  });

  it("blocks dangerous patterns", () => {
    const dangerous = [
      "eval('alert(1)')",
      "window.location",
      "document.cookie",
      "process.env",
      "fetch('http://evil.com')",
      "import('fs')",
      "require('child_process')",
      "constructor.constructor('return this')()",
      "this.__proto__",
    ];

    for (const expr of dangerous) {
      expect(evaluateFormula(makeFormula(expr), {}, []), `Should block: ${expr}`).toBeNull();
    }
  });

  it("allows safe arithmetic expressions", () => {
    const result = evaluateFormula(makeFormula("row.a + row.b * 2"), { a: 10, b: 5 }, []);
    expect(result).toBe(20);
  });

  it("allows ternary expressions", () => {
    const result = evaluateFormula(makeFormula("row.x > 0 ? row.x * 100 : 0"), { x: 0.5 }, []);
    expect(result).toBe(50);
  });

  it("allows Math functions", () => {
    const result = evaluateFormula(
      makeFormula("Math.abs(row.a - row.b) / row.b * 100"),
      { a: 90, b: 100 },
      []
    );
    expect(result).toBe(10);
  });

  it("allows stats functions", () => {
    const rows = [{ val: 10 }, { val: 20 }, { val: 30 }];
    const result = evaluateFormula(makeFormula("stats.mean(rows.map(r => r.val))"), rows[0], rows);
    expect(result).toBe(20);
  });

  it("allows helper calls", () => {
    const rows = [
      { roi: "Centro", media_pixel: 100 },
      { roi: "Superior", media_pixel: 110 },
    ];
    const result = evaluateFormula(
      makeFormula("helpers.variacionVsCentro(rows, 'media_pixel')"),
      rows[0],
      rows
    );
    expect(result).toBe(10);
  });

  it("returns null for NaN/Infinity results", () => {
    expect(evaluateFormula(makeFormula("0 / 0"), {}, [])).toBeNull();
    expect(evaluateFormula(makeFormula("1 / 0"), {}, [])).toBeNull();
  });

  it("returns null on runtime errors", () => {
    expect(evaluateFormula(makeFormula("row.missing.deep"), {}, [])).toBeNull();
  });
});

// ─── Real formula expressions from grupos.ts ───

describe("real formulas from CONV package", () => {
  it("dosis_anual_msv: calculates annual dose", () => {
    const formula = makeFormula(
      "row.tasa_dosis * (row.factor_ocupacion === '1' ? 1 : row.factor_ocupacion === '1/4' ? 0.25 : row.factor_ocupacion === '1/16' ? 0.0625 : row.factor_ocupacion === '1/20' ? 0.05 : 0.025) * (row.horas_anio || 2000)"
    );
    const row = { tasa_dosis: 0.001, factor_ocupacion: "1/4", horas_anio: 2000 };
    const result = evaluateFormula(formula, row, [row]);
    expect(result).toBeCloseTo(0.5, 4);
  });

  it("desviacion_total_pct: colimation deviation", () => {
    const formula = makeFormula("Math.abs(row.desviacion_cm) / (row.dfi_cm || 100) * 100");
    const row = { desviacion_cm: -2, dfi_cm: 100 };
    expect(evaluateFormula(formula, row, [row])).toBe(2);
  });

  it("desviacion_kvp_pct: kVp accuracy", () => {
    const formula = makeFormula(
      "row.kvp_set > 0 ? Math.abs(row.kvp_med - row.kvp_set) / row.kvp_set * 100 : 0"
    );
    const row = { kvp_set: 80, kvp_med: 82 };
    expect(evaluateFormula(formula, row, [row])).toBe(2.5);
  });

  it("cv_kvp_pct: kVp repeatability", () => {
    const formula = makeFormula(
      "stats.cv(rows.filter(r => r.kvp_set === row.kvp_set && r.kvp_med != null).map(r => r.kvp_med))"
    );
    const rows = [
      { kvp_set: 80, kvp_med: 80.5 },
      { kvp_set: 80, kvp_med: 79.5 },
      { kvp_set: 80, kvp_med: 80.0 },
    ];
    const result = evaluateFormula(formula, rows[0], rows);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(5);
  });

  it("rendimiento: tube output", () => {
    const formula = makeFormula("row.mas_med > 0 ? row.dosis_ugy / row.mas_med : 0");
    const row = { mas_med: 50, dosis_ugy: 2500 };
    expect(evaluateFormula(formula, row, [row])).toBe(50);
  });

  it("helpers.variacionVsCentro via formula (uniformidad)", () => {
    const formula = makeFormula("helpers.variacionVsCentro(rows, 'media_pixel')");
    const rows = [
      { roi: "Centro", media_pixel: 1000 },
      { roi: "Superior", media_pixel: 1050 },
      { roi: "Inferior", media_pixel: 950 },
      { roi: "Izquierda", media_pixel: 980 },
      { roi: "Derecha", media_pixel: 1020 },
    ];
    const result = evaluateFormula(formula, rows[0], rows);
    expect(result).toBe(5);
  });

  it("helpers.variacionVsMedia via formula (consistencia CAE)", () => {
    const formula = makeFormula(
      "helpers.variacionVsMedia(rows, 'ddi_valor', 'tipo_prueba_cae', 'consistencia')"
    );
    const rows = [
      { tipo_prueba_cae: "consistencia", ddi_valor: 500 },
      { tipo_prueba_cae: "consistencia", ddi_valor: 520 },
      { tipo_prueba_cae: "repetibilidad", ddi_valor: 300 },
    ];
    const result = evaluateFormula(formula, rows[0], rows);
    expect(result).toBeCloseTo(1.96, 1);
  });
});

// ─── evaluateAllFormulas ───

describe("evaluateAllFormulas", () => {
  it("returns a map of campo_resultado → values per row", () => {
    const formulas: FormulaDefinicion[] = [
      {
        campo_resultado: "result_a",
        label: "A",
        expresion: "row.x * 2",
        dependencias: ["x"],
      },
    ];
    const rows = [{ x: 5 }, { x: 10 }];
    const results = evaluateAllFormulas(formulas, rows);
    expect(results.get("result_a")).toEqual([10, 20]);
  });
});

// ─── evaluateFormulaSummaries ───

describe("evaluateFormulaSummaries", () => {
  it("uses max(abs) for desviacion fields", () => {
    const formulas: FormulaDefinicion[] = [
      {
        campo_resultado: "desviacion_kvp",
        label: "Dev",
        expresion: "row.val",
        dependencias: ["val"],
      },
    ];
    const rows = [{ val: -5 }, { val: 3 }, { val: -8 }];
    const summaries = evaluateFormulaSummaries(formulas, rows);
    expect(summaries.desviacion_kvp).toBe(8);
  });

  it("uses mean for non-desviacion fields", () => {
    const formulas: FormulaDefinicion[] = [
      {
        campo_resultado: "rendimiento",
        label: "R",
        expresion: "row.val",
        dependencias: ["val"],
      },
    ];
    const rows = [{ val: 10 }, { val: 20 }, { val: 30 }];
    const summaries = evaluateFormulaSummaries(formulas, rows);
    expect(summaries.rendimiento).toBe(20);
  });

  it("returns null when all values are null", () => {
    const formulas: FormulaDefinicion[] = [
      {
        campo_resultado: "test",
        label: "T",
        expresion: "row.missing.deep",
        dependencias: [],
      },
    ];
    const summaries = evaluateFormulaSummaries(formulas, [{}]);
    expect(summaries.test).toBeNull();
  });
});

// ─── evaluateCriterio ───

describe("evaluateCriterio", () => {
  const crit = (
    overrides: Partial<CriterioAceptacion> & Pick<CriterioAceptacion, "operador" | "valor">
  ): CriterioAceptacion => ({
    campo: "x",
    descripcion: "",
    referencia_normativa: "",
    ...overrides,
  });

  it("lt", () => {
    const c = crit({ operador: "lt", valor: 10 });
    expect(evaluateCriterio(c, 9)).toBe(true);
    expect(evaluateCriterio(c, 10)).toBe(false);
  });

  it("lte", () => {
    const c = crit({ operador: "lte", valor: 10 });
    expect(evaluateCriterio(c, 10)).toBe(true);
    expect(evaluateCriterio(c, 11)).toBe(false);
  });

  it("gt", () => {
    const c = crit({ operador: "gt", valor: 5 });
    expect(evaluateCriterio(c, 6)).toBe(true);
    expect(evaluateCriterio(c, 5)).toBe(false);
  });

  it("gte", () => {
    const c = crit({ operador: "gte", valor: 2.5 });
    expect(evaluateCriterio(c, 2.5)).toBe(true);
    expect(evaluateCriterio(c, 2.4)).toBe(false);
  });

  it("eq", () => {
    const c = crit({ operador: "eq", valor: 42 });
    expect(evaluateCriterio(c, 42)).toBe(true);
    expect(evaluateCriterio(c, 41)).toBe(false);
  });

  it("between", () => {
    const c = crit({ operador: "between", valor: [5, 10] });
    expect(evaluateCriterio(c, 7)).toBe(true);
    expect(evaluateCriterio(c, 5)).toBe(true);
    expect(evaluateCriterio(c, 10)).toBe(true);
    expect(evaluateCriterio(c, 4)).toBe(false);
    expect(evaluateCriterio(c, 11)).toBe(false);
  });

  it("unknown operator returns false", () => {
    const c = crit({ operador: "nope" as never, valor: 1 });
    expect(evaluateCriterio(c, 1)).toBe(false);
  });
});

// ─── suggestConcepto ───

describe("suggestConcepto", () => {
  it("returns FAVORABLE when all criteria pass", () => {
    const evals = [
      { campo: "a", valor_obtenido: 5, criterio_descripcion: "", cumple: true },
      { campo: "b", valor_obtenido: 3, criterio_descripcion: "", cumple: true },
    ];
    expect(suggestConcepto(evals)).toBe("FAVORABLE");
  });

  it("returns NO_FAVORABLE when any criterion fails", () => {
    const evals = [
      { campo: "a", valor_obtenido: 5, criterio_descripcion: "", cumple: true },
      { campo: "b", valor_obtenido: 15, criterio_descripcion: "", cumple: false },
    ];
    expect(suggestConcepto(evals)).toBe("NO_FAVORABLE");
  });
});

// ─── helper to create formulas ───

function makeFormula(expr: string): FormulaDefinicion {
  return {
    campo_resultado: "test",
    label: "Test",
    expresion: expr,
    dependencias: [],
  };
}
