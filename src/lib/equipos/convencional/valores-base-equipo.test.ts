import { describe, expect, it } from "vitest";
import {
  CAMPOS_BASE_CAE,
  CAMPOS_BASE_MTF,
  campoDosisBasePorPrograma,
  calcularPrecarga,
  extraerValoresBaseParaEquipo,
  mapearBase29AEquipo,
  precargarBase29DesdeEquipo,
} from "./valores-base-equipo";

describe("extraerValoresBaseParaEquipo (#110)", () => {
  it("devuelve null si fields no toca ningún campo base", () => {
    expect(extraerValoresBaseParaEquipo({ toma_numero: 3 }, CAMPOS_BASE_CAE)).toBeNull();
  });

  it("extrae solo los campos base presentes en fields", () => {
    const out = extraerValoresBaseParaEquipo({ mas_base_217: 5, toma_numero: 3 }, CAMPOS_BASE_CAE);
    expect(out).toEqual({ mas_base_217: 5 });
  });

  it("propaga undefined explícito (borrado de un campo)", () => {
    const out = extraerValoresBaseParaEquipo({ mas_base_217: undefined }, CAMPOS_BASE_CAE);
    expect(out).toEqual({ mas_base_217: undefined });
  });

  it("funciona igual para los campos de MTF", () => {
    const out = extraerValoresBaseParaEquipo({ mtf50_base_horizontal: 1.8 }, CAMPOS_BASE_MTF);
    expect(out).toEqual({ mtf50_base_horizontal: 1.8 });
  });
});

describe("calcularPrecarga (#110)", () => {
  it("devuelve null si no hay valores base de equipo", () => {
    expect(calcularPrecarga(null, {}, CAMPOS_BASE_CAE)).toBeNull();
  });

  it("devuelve null si la visita ya tiene todos los campos que el equipo tiene", () => {
    const out = calcularPrecarga({ mas_base_217: 5 }, { mas_base_217: 3 }, CAMPOS_BASE_CAE);
    expect(out).toBeNull();
  });

  it("precarga solo los campos que la visita no tiene", () => {
    const out = calcularPrecarga(
      { mas_base_217: 5, ei_base_217: 10 },
      { mas_base_217: 3 },
      CAMPOS_BASE_CAE
    );
    expect(out).toEqual({ ei_base_217: 10 });
  });

  it("no precarga un campo si el equipo tampoco lo tiene", () => {
    const out = calcularPrecarga({ mas_base_217: undefined }, {}, CAMPOS_BASE_CAE);
    expect(out).toBeNull();
  });
});

describe("mapearBase29AEquipo / precargarBase29DesdeEquipo (2.9, #110)", () => {
  it("mapea ei_base/di_base de la visita a ei_base_29/di_base_29 del equipo", () => {
    expect(mapearBase29AEquipo({ ei_base: 500, di_base: 4 })).toEqual({
      ei_base_29: 500,
      di_base_29: 4,
    });
  });

  it("devuelve null si no viene ninguno de los dos campos", () => {
    expect(mapearBase29AEquipo({})).toBeNull();
  });

  it("precarga ei_base/di_base desde el equipo cuando la visita los tiene vacíos", () => {
    const out = precargarBase29DesdeEquipo({ ei_base_29: 500, di_base_29: 4 }, {});
    expect(out).toEqual({ ei_base: 500, di_base: 4 });
  });

  it("no precarga un campo que la visita ya tiene", () => {
    const out = precargarBase29DesdeEquipo({ ei_base_29: 500, di_base_29: 4 }, { ei_base: 100 });
    expect(out).toEqual({ di_base: 4 });
  });

  it("devuelve null si no hay valores base de equipo", () => {
    expect(precargarBase29DesdeEquipo(null, {})).toBeNull();
  });
});

describe("campoDosisBasePorPrograma (2.21, #110)", () => {
  it("mapea los 3 programas clínicos fijos a su campo de equipo", () => {
    expect(campoDosisBasePorPrograma("Extremidad")).toBe("dosis_base_extremidades_mgy");
    expect(campoDosisBasePorPrograma("Tórax AP")).toBe("dosis_base_torax_mgy");
    expect(campoDosisBasePorPrograma("Columna AP")).toBe("dosis_base_columna_mgy");
  });

  it("devuelve undefined para un programa desconocido o vacío", () => {
    expect(campoDosisBasePorPrograma("Otro")).toBeUndefined();
    expect(campoDosisBasePorPrograma(undefined)).toBeUndefined();
  });
});
