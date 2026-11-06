import { describe, it, expect } from "vitest";
import { parseDecimal, formatDecimal, formatCapturado, decimalInputValue } from "./decimal";

describe("parseDecimal", () => {
  it.each<[unknown, number | undefined]>([
    ["1,8", 1.8],
    ["1.8", 1.8],
    ["1,80", 1.8],
    ["100", 100],
    ["0", 0],
    ["-2,5", -2.5],
    ["  3,14  ", 3.14],
    ["1.234,56", 1234.56], // punto miles, coma decimal (es-CO)
    ["1,234.56", 1234.56], // coma miles, punto decimal (en-US)
    ["1.234.567", 1234567], // solo miles con punto
    ["1,234,567", 1234567], // solo miles con coma
    ["2,5 mm Al", 2.5], // con unidad pegada
    ["", undefined],
    ["   ", undefined],
    ["abc", undefined],
    ["-", undefined],
    [null, undefined],
    [undefined, undefined],
    [42, 42],
    [NaN, undefined],
  ])("parseDecimal(%j) === %j", (input, expected) => {
    expect(parseDecimal(input as string)).toBe(expected);
  });
});

describe("formatDecimal (es-CO, coma)", () => {
  it("usa coma decimal", () => {
    expect(formatDecimal(1.8)).toBe("1,8");
    expect(formatDecimal(2.5)).toBe("2,5");
    expect(formatDecimal(100)).toBe("100");
  });
  it("respeta decimals exactos", () => {
    expect(formatDecimal(1.8, 2)).toBe("1,80");
    expect(formatDecimal(100, 2)).toBe("100,00");
    expect(formatDecimal(0.5, 3)).toBe("0,500");
  });
  it("no agrupa miles", () => {
    expect(formatDecimal(1234.5)).toBe("1234,5");
  });
  it("sin `decimals`: hasta 3 decimales, sin ceros de relleno (columna T del informe)", () => {
    // Regresión: el factor de ocupación 1 salía como "1," en la tabla 2.1.2.
    expect(formatDecimal(1)).toBe("1");
    expect(formatDecimal(0.5)).toBe("0,5");
    expect(formatDecimal(0.05)).toBe("0,05");
    expect(formatDecimal(0.2)).toBe("0,2");
  });
  it("null / undefined / NaN → fallback", () => {
    expect(formatDecimal(null)).toBe("—");
    expect(formatDecimal(undefined)).toBe("—");
    expect(formatDecimal(NaN)).toBe("—");
    expect(formatDecimal(undefined, 2, "No aplica")).toBe("No aplica");
  });
});

describe("formatCapturado — valor capturado tal cual (#199)", () => {
  it("no redondea ni rellena con ceros", () => {
    expect(formatCapturado(2.5)).toBe("2,5");
    expect(formatCapturado(0.0025)).toBe("0,0025");
    expect(formatCapturado(9)).toBe("9");
    expect(formatCapturado(9.0)).toBe("9");
    expect(formatCapturado(8.5)).toBe("8,5");
    expect(formatCapturado(12.5)).toBe("12,5");
    expect(formatCapturado(0.125)).toBe("0,125");
  });
  it("no agrupa miles", () => {
    expect(formatCapturado(1234)).toBe("1234");
    expect(formatCapturado(1234.56)).toBe("1234,56");
  });
  it("hasta 6 decimales por defecto; `maxDec` lo ajusta", () => {
    expect(formatCapturado(0.000123)).toBe("0,000123");
    expect(formatCapturado(1 / 3)).toBe("0,333333");
    expect(formatCapturado(1 / 3, 2)).toBe("0,33");
  });
  it("null / undefined / NaN → fallback", () => {
    expect(formatCapturado(null)).toBe("—");
    expect(formatCapturado(undefined)).toBe("—");
    expect(formatCapturado(NaN)).toBe("—");
    expect(formatCapturado(undefined, 6, "No aplica")).toBe("No aplica");
  });
});

describe("decimalInputValue", () => {
  it("número → coma; vacío → ''", () => {
    expect(decimalInputValue(1.8)).toBe("1,8");
    expect(decimalInputValue(null)).toBe("");
    expect(decimalInputValue(undefined)).toBe("");
  });
});

describe("round-trip UI: tipear coma o punto guarda el mismo number", () => {
  it("'1,8' y '1.8' → 1.8 (number)", () => {
    expect(parseDecimal("1,8")).toBe(parseDecimal("1.8"));
    expect(parseDecimal("1,8")).toBe(1.8);
  });
});
