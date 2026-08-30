import { describe, it, expect } from "vitest";
import { parseDecimal, formatDecimal, decimalInputValue } from "./decimal";

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
  it("null / undefined / NaN → fallback", () => {
    expect(formatDecimal(null)).toBe("—");
    expect(formatDecimal(undefined)).toBe("—");
    expect(formatDecimal(NaN)).toBe("—");
    expect(formatDecimal(undefined, 2, "No aplica")).toBe("No aplica");
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
