import { describe, it, expect } from "vitest";
import { convertirDap, convertirKerma } from "./unidades-raysafe";

describe("convertirDap — normaliza a mGy·cm²", () => {
  it("mgy_cm2 → identidad", () => {
    expect(convertirDap(100, "mgy_cm2")).toBe(100);
  });

  it("ugy_cm2 → divide por 1000", () => {
    expect(convertirDap(1000, "ugy_cm2")).toBeCloseTo(1, 10);
  });

  it("dgy_cm2 → multiplica por 10", () => {
    expect(convertirDap(1, "dgy_cm2")).toBeCloseTo(10, 10);
  });

  it("gy_m2 → multiplica por 10 000 000 (1000 mGy × 10 000 cm²)", () => {
    expect(convertirDap(1, "gy_m2")).toBeCloseTo(10_000_000, 5);
  });

  it("undefined → asume mgy_cm2 (comportamiento actual)", () => {
    expect(convertirDap(50, undefined)).toBe(50);
  });

  it("0 → 0 en cualquier unidad", () => {
    expect(convertirDap(0, "gy_m2")).toBe(0);
  });
});

describe("convertirKerma — normaliza a mGy", () => {
  it("mgy → identidad", () => {
    expect(convertirKerma(5, "mgy")).toBe(5);
  });

  it("ugy → divide por 1000", () => {
    expect(convertirKerma(1000, "ugy")).toBeCloseTo(1, 10);
  });

  it("cgy → multiplica por 10", () => {
    expect(convertirKerma(1, "cgy")).toBeCloseTo(10, 10);
  });

  it("dgy → multiplica por 100", () => {
    expect(convertirKerma(1, "dgy")).toBeCloseTo(100, 10);
  });

  it("gy → multiplica por 1000", () => {
    expect(convertirKerma(1, "gy")).toBeCloseTo(1000, 10);
  });

  it("undefined → asume mgy (comportamiento actual)", () => {
    expect(convertirKerma(3.5, undefined)).toBe(3.5);
  });

  it("consistencia cruzada: 1 gy == 1000 mgy == 1_000_000 ugy", () => {
    expect(convertirKerma(1, "gy")).toBeCloseTo(convertirKerma(1000, "mgy"), 10);
    expect(convertirKerma(1, "gy")).toBeCloseTo(convertirKerma(1_000_000, "ugy"), 5);
  });
});
