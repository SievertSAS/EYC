import { describe, it, expect } from "vitest";
import { fechaIsoColombia, sumarAnios, fechasDelInforme, textoFechaLarga } from "./fecha-informe";

describe("fechaIsoColombia", () => {
  it("usa el día en Colombia, no el día UTC", () => {
    // 21/10/2026 02:30 UTC = 20/10/2026 21:30 en Bogotá
    expect(fechaIsoColombia(new Date("2026-10-21T02:30:00Z"))).toBe("2026-10-20");
  });
});

describe("sumarAnios", () => {
  it("suma años conservando mes y día", () => {
    expect(sumarAnios("2026-10-20", 2)).toBe("2028-10-20");
  });

  it("29 de febrero sin año bisiesto destino → 28 de febrero", () => {
    expect(sumarAnios("2028-02-29", 2)).toBe("2030-02-28");
  });
});

describe("fechasDelInforme", () => {
  it("emisión = fecha de visita y vencimiento = visita + 2 años", () => {
    expect(fechasDelInforme("2026-03-15", new Date(2026, 9, 20))).toEqual({
      fechaEmision: "2026-03-15",
      fechaVencimiento: "2028-03-15",
    });
  });

  it("toma solo el día si la fecha de visita trae hora", () => {
    expect(
      fechasDelInforme("2026-03-15T08:00:00Z", new Date("2026-10-20T15:00:00Z")).fechaEmision
    ).toBe("2026-03-15");
  });

  it("sin fecha de visita → usa el día de hoy en Colombia", () => {
    // 21/10/2026 03:00 UTC = 20/10/2026 22:00 en Bogotá
    expect(fechasDelInforme(undefined, new Date("2026-10-21T03:00:00Z"))).toEqual({
      fechaEmision: "2026-10-20",
      fechaVencimiento: "2028-10-20",
    });
  });
});

describe("textoFechaLarga", () => {
  it("formatea en español sin correr el día por la zona horaria", () => {
    expect(textoFechaLarga("2026-10-20")).toBe("20 de octubre de 2026");
  });

  it("vacía → 'No reporta'", () => {
    expect(textoFechaLarga(undefined)).toBe("No reporta");
    expect(textoFechaLarga("")).toBe("No reporta");
  });

  it("no reconocible → tal cual", () => {
    expect(textoFechaLarga("pendiente")).toBe("pendiente");
  });
});
