import { describe, it, expect } from "vitest";
import { promedio, desviacion, cvPct } from "./estadistica";

describe("promedio", () => {
  it("array vacío → 0", () => {
    expect(promedio([])).toBe(0);
  });
  it("un solo elemento → ese valor", () => {
    expect(promedio([5])).toBe(5);
  });
  it("varios valores → media aritmética", () => {
    expect(promedio([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("desviacion (muestral, n-1)", () => {
  it("array vacío → 0", () => {
    expect(desviacion([])).toBe(0);
  });
  it("un solo elemento → 0 (n-1 = 0, sin varianza definida)", () => {
    expect(desviacion([5])).toBe(0);
  });
  it("valores idénticos → 0", () => {
    expect(desviacion([10, 10, 10])).toBe(0);
  });
  it("caso conocido: [2, 4, 4, 4, 5, 5, 7, 9] → desviación muestral 2.13809...", () => {
    // Promedio = 5. Suma de cuadrados de diferencias = 32. n-1 = 7.
    // sqrt(32/7) ≈ 2.13808993...
    const arr = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(desviacion(arr)).toBeCloseTo(2.1380899, 6);
  });
});

describe("cvPct", () => {
  it("array vacío → 0", () => {
    expect(cvPct([])).toBe(0);
  });
  it("promedio 0 → 0 (evita división por cero)", () => {
    expect(cvPct([0, 0, 0])).toBe(0);
  });
  it("valores idénticos → CV = 0", () => {
    expect(cvPct([10, 10, 10])).toBe(0);
  });
  it("caso puntual reportado por Alberto: CV ≈ 1.6%", () => {
    // Promedio = 100. Desviación muestral ≈ 1.63299. CV = desv/promedio*100 ≈ 1.633%.
    const arr = [98, 99, 100, 101, 102];
    expect(promedio(arr)).toBe(100);
    expect(cvPct(arr)).toBeCloseTo(1.5811388, 5);
  });
});
