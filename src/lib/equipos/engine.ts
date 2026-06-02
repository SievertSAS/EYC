// ============================================================
//  Motor de evaluación de fórmulas y criterios
//  Evalúa expresiones contra datos de medición crudos
//  Compartido por todos los EquipmentPackage
// ============================================================

import type {
  FormulaDefinicion,
  CriterioAceptacion,
  EvaluacionCriterio,
  GrupoPrueba,
  PruebaDefinicion,
  Equipo,
  ValoresReferencia,
} from "@/lib/db/types";

// ─── Helpers estadísticos ───

export const stats = {
  mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  },

  stddev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = stats.mean(arr);
    const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
  },

  cv(arr: number[]): number {
    const m = stats.mean(arr);
    if (m === 0) return 0;
    return (stats.stddev(arr) / Math.abs(m)) * 100;
  },

  max(arr: number[]): number {
    return arr.length > 0 ? Math.max(...arr) : 0;
  },

  min(arr: number[]): number {
    return arr.length > 0 ? Math.min(...arr) : 0;
  },

  sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  },

  count(arr: unknown[]): number {
    return arr.length;
  },
};

// ─── Helpers reutilizables para fórmulas complejas ───

export const formulaHelpers = {
  /** Variación porcentual de un campo respecto al ROI "Centro" */
  variacionVsCentro(rows: Record<string, unknown>[], valueField: string): number {
    const centro = rows.find((r) => r.roi === "Centro");
    if (!centro || !centro[valueField]) return 0;
    const centroVal = centro[valueField] as number;
    return stats.max(
      rows
        .filter((r) => (r[valueField] as number) > 0)
        .map((r) => (Math.abs((r[valueField] as number) - centroVal) / centroVal) * 100)
    );
  },

  /** Variación porcentual máxima vs media, con filtro opcional por campo */
  variacionVsMedia(
    rows: Record<string, unknown>[],
    valueField: string,
    filterField?: string,
    filterValue?: string
  ): number {
    const filtered = filterField
      ? rows.filter((r) => r[filterField] === filterValue && (r[valueField] as number) > 0)
      : rows.filter((r) => (r[valueField] as number) > 0);
    const vals = filtered.map((r) => r[valueField] as number);
    if (vals.length < 2) return 0;
    const m = stats.mean(vals);
    return stats.max(vals.map((v) => (Math.abs(v - m) / m) * 100));
  },
};

// ─── Validación de expresiones ───

const BLOCKED_PATTERNS: RegExp[] = [
  /\bimport\b/,
  /\brequire\b/,
  /\beval\b/,
  /\bFunction\b/,
  /\bwindow\b/,
  /\bdocument\b/,
  /\bglobal(?:This)?\b/,
  /\bprocess\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bconstructor\b/,
  /\bprototype\b/,
  /\b__proto__\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\bPromise\b/,
  /\balert\b/,
  /\bconfirm\b/,
  /\bprompt\b/,
  /\bObject\b/,
  /\bReflect\b/,
  /\bProxy\b/,
];

function validateExpression(expr: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(expr)) {
      throw new Error(`Expresión de fórmula bloqueada: patrón no permitido "${pattern.source}"`);
    }
  }
}

// ─── Contexto de evaluación ───

export interface FormulaContext {
  equipo?: Equipo;
  valores_ref?: ValoresReferencia;
}

// ─── Evaluación de fórmulas ───

export function evaluateFormula(
  formula: FormulaDefinicion,
  row: Record<string, unknown>,
  allRows: Record<string, unknown>[],
  context: FormulaContext = {}
): number | null {
  try {
    validateExpression(formula.expresion);

    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "row",
      "rows",
      "stats",
      "Math",
      "equipo",
      "valores_ref",
      "helpers",
      `"use strict"; return (${formula.expresion});`
    );

    const result = fn(
      row,
      allRows,
      stats,
      Math,
      context.equipo ?? {},
      context.valores_ref ?? {},
      formulaHelpers
    );

    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Evalúa todas las fórmulas de una prueba para cada fila.
 * Retorna un mapa de campo_resultado → valores por fila.
 */
export function evaluateAllFormulas(
  formulas: FormulaDefinicion[],
  rows: Record<string, unknown>[],
  context: FormulaContext = {}
): Map<string, (number | null)[]> {
  const results = new Map<string, (number | null)[]>();

  for (const formula of formulas) {
    const values = rows.map((row) => evaluateFormula(formula, row, rows, context));
    results.set(formula.campo_resultado, values);
  }

  return results;
}

/**
 * Evalúa resúmenes estadísticos de todas las fórmulas de una prueba.
 * Útil para mostrar un solo valor por prueba (ej: "desviación máx kVp = 3.2%").
 */
export function evaluateFormulaSummaries(
  formulas: FormulaDefinicion[],
  rows: Record<string, unknown>[],
  context: FormulaContext = {}
): Record<string, number | null> {
  const summaries: Record<string, number | null> = {};

  for (const formula of formulas) {
    const values = rows
      .map((row) => evaluateFormula(formula, row, rows, context))
      .filter((v): v is number => v !== null);

    if (values.length > 0) {
      if (
        formula.campo_resultado.includes("desviacion") ||
        formula.campo_resultado.includes("cv")
      ) {
        summaries[formula.campo_resultado] = stats.max(values.map(Math.abs));
      } else {
        summaries[formula.campo_resultado] = stats.mean(values);
      }
    } else {
      summaries[formula.campo_resultado] = null;
    }
  }

  return summaries;
}

// ─── Evaluación de criterios ───

/**
 * Evalúa un criterio contra un valor.
 */
export function evaluateCriterio(criterio: CriterioAceptacion, valor: number): boolean {
  switch (criterio.operador) {
    case "lt":
      return valor < (criterio.valor as number);
    case "lte":
      return valor <= (criterio.valor as number);
    case "gt":
      return valor > (criterio.valor as number);
    case "gte":
      return valor >= (criterio.valor as number);
    case "eq":
      return valor === (criterio.valor as number);
    case "between": {
      const [min, max] = criterio.valor as [number, number];
      return valor >= min && valor <= max;
    }
    default:
      return false;
  }
}

/**
 * Evalúa todos los criterios de una prueba contra sus resultados calculados.
 */
export function evaluateCriterios(
  criterios: CriterioAceptacion[],
  resultados: Record<string, number | null>
): EvaluacionCriterio[] {
  return criterios.map((criterio) => {
    const valor = resultados[criterio.campo];
    return {
      campo: criterio.campo,
      valor_obtenido: valor ?? 0,
      criterio_descripcion: criterio.descripcion,
      cumple: valor !== null ? evaluateCriterio(criterio, valor) : false,
    };
  });
}

/**
 * Determina el concepto sugerido: FAVORABLE si todos los criterios se cumplen.
 */
export function suggestConcepto(evaluaciones: EvaluacionCriterio[]): "FAVORABLE" | "NO_FAVORABLE" {
  return evaluaciones.every((e) => e.cumple) ? "FAVORABLE" : "NO_FAVORABLE";
}

// ─── Evaluación completa de un grupo ───

export interface ResultadoPruebaCalculado {
  prueba_definicion_id: number;
  resultados: Record<string, number | null>;
  evaluacion_criterios: EvaluacionCriterio[];
  concepto_sugerido: "FAVORABLE" | "NO_FAVORABLE";
}

/**
 * Evalúa todas las pruebas de un grupo dado los datos crudos.
 * Retorna los resultados calculados para cada prueba.
 */
export function evaluateGroup(
  _grupo: GrupoPrueba,
  pruebas: PruebaDefinicion[],
  rawData: Record<string, unknown>[],
  context: FormulaContext = {}
): ResultadoPruebaCalculado[] {
  return pruebas.map((prueba) => {
    const formulas = prueba.formulas ?? [];
    const criterios = prueba.criterios_aceptacion ?? [];

    const resultados = evaluateFormulaSummaries(formulas, rawData, context);
    const evaluacion = evaluateCriterios(criterios, resultados);
    const concepto = evaluacion.length > 0 ? suggestConcepto(evaluacion) : "FAVORABLE";

    return {
      prueba_definicion_id: prueba.id!,
      resultados,
      evaluacion_criterios: evaluacion,
      concepto_sugerido: concepto,
    };
  });
}
