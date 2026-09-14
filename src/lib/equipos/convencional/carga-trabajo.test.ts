import { describe, expect, it } from "vitest";
import { calcularWUsado } from "./carga-trabajo";

describe("calcularWUsado (#105)", () => {
  it("sin modo fijado usa el mayor entre estimada y estándar", () => {
    expect(calcularWUsado(200, 160, undefined)).toBe(200);
    expect(calcularWUsado(100, 160, undefined)).toBe(160);
  });

  it("modo 'estimada' usa la estimada aunque sea menor que la estándar", () => {
    expect(calcularWUsado(100, 160, "estimada")).toBe(100);
  });

  it("modo 'tipica' usa la estándar aunque la estimada sea mayor", () => {
    expect(calcularWUsado(200, 160, "tipica")).toBe(160);
  });
});
