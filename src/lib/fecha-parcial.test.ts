import { describe, expect, it } from "vitest";
import {
  componerFechaParcial,
  esFechaParcialValida,
  formatFechaParcial,
  parseFechaParcial,
} from "./fecha-parcial";

describe("parseFechaParcial", () => {
  it("parses year only", () => {
    expect(parseFechaParcial("2019")).toEqual({ anio: "2019", mes: "", dia: "" });
  });

  it("parses year and month", () => {
    expect(parseFechaParcial("2019-03")).toEqual({ anio: "2019", mes: "03", dia: "" });
  });

  it("parses full date", () => {
    expect(parseFechaParcial("2019-03-15")).toEqual({ anio: "2019", mes: "03", dia: "15" });
  });

  it("returns empty parts for empty or unrecognized values", () => {
    expect(parseFechaParcial(undefined)).toEqual({ anio: "", mes: "", dia: "" });
    expect(parseFechaParcial("")).toEqual({ anio: "", mes: "", dia: "" });
    expect(parseFechaParcial("hace mucho")).toEqual({ anio: "", mes: "", dia: "" });
  });
});

describe("componerFechaParcial", () => {
  it("composes year only", () => {
    expect(componerFechaParcial({ anio: "2019", mes: "", dia: "" })).toBe("2019");
  });

  it("composes year and month", () => {
    expect(componerFechaParcial({ anio: "2019", mes: "03", dia: "" })).toBe("2019-03");
  });

  it("composes full date", () => {
    expect(componerFechaParcial({ anio: "2019", mes: "03", dia: "15" })).toBe("2019-03-15");
  });

  it("ignores the day when there is no month", () => {
    expect(componerFechaParcial({ anio: "2019", mes: "", dia: "15" })).toBe("2019");
  });

  it("returns empty when the year is empty", () => {
    expect(componerFechaParcial({ anio: "", mes: "03", dia: "15" })).toBe("");
  });

  it("returns null when the year is incomplete", () => {
    expect(componerFechaParcial({ anio: "201", mes: "", dia: "" })).toBeNull();
  });

  it("returns null for a day that does not exist in that month", () => {
    expect(componerFechaParcial({ anio: "2019", mes: "02", dia: "29" })).toBeNull();
    expect(componerFechaParcial({ anio: "2020", mes: "02", dia: "29" })).toBe("2020-02-29");
  });
});

describe("esFechaParcialValida", () => {
  it("accepts the three precisions", () => {
    expect(esFechaParcialValida("2019")).toBe(true);
    expect(esFechaParcialValida("2019-12")).toBe(true);
    expect(esFechaParcialValida("2019-12-31")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(esFechaParcialValida("2019-13")).toBe(false);
    expect(esFechaParcialValida("2019-04-31")).toBe(false);
    expect(esFechaParcialValida("19")).toBe(false);
    expect(esFechaParcialValida("15/03/2019")).toBe(false);
  });
});

describe("formatFechaParcial", () => {
  it("formats each precision for display", () => {
    expect(formatFechaParcial("2019")).toBe("2019");
    expect(formatFechaParcial("2019-03")).toBe("03/2019");
    expect(formatFechaParcial("2019-03-15")).toBe("15/03/2019");
  });

  it("uses the fallback for empty values", () => {
    expect(formatFechaParcial(undefined)).toBe("—");
    expect(formatFechaParcial("", "No reporta")).toBe("No reporta");
  });

  it("returns unrecognized values as is", () => {
    expect(formatFechaParcial("hace mucho")).toBe("hace mucho");
  });
});
