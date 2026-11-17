import { describe, expect, it } from "vitest";
import {
  agruparPorEstado,
  dentroDeRango,
  normalizar,
  opcionesDistintas,
  parseFecha,
  parseMultiple,
  parseVista,
} from "./comun";

describe("normalizar", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalizar("Bogotá CLÍNICA Ñandú")).toBe("bogota clinica nandu");
  });
});

describe("parseFecha", () => {
  it("acepta YYYY-MM-DD válidas", () => {
    expect(parseFecha("2026-03-05")).toBe("2026-03-05");
  });
  it("rechaza formatos y fechas imposibles", () => {
    expect(parseFecha("2026-3-5")).toBeNull();
    expect(parseFecha("2026-02-30")).toBeNull();
    expect(parseFecha("hoy")).toBeNull();
    expect(parseFecha(null)).toBeNull();
  });
});

describe("dentroDeRango", () => {
  it("sin límites deja pasar todo, incluso sin fecha", () => {
    expect(dentroDeRango(undefined, null, null)).toBe(true);
  });
  it("los límites son inclusivos", () => {
    expect(dentroDeRango("2026-03-01", "2026-03-01", "2026-03-31")).toBe(true);
    expect(dentroDeRango("2026-03-31", "2026-03-01", "2026-03-31")).toBe(true);
    expect(dentroDeRango("2026-02-28", "2026-03-01", null)).toBe(false);
    expect(dentroDeRango("2026-04-01", null, "2026-03-31")).toBe(false);
  });
  it("compara solo el día aunque la fecha traiga hora", () => {
    expect(dentroDeRango("2026-03-31T23:00:00Z", null, "2026-03-31")).toBe(true);
  });
  it("con algún límite activo, un registro sin fecha queda fuera", () => {
    expect(dentroDeRango(undefined, "2026-01-01", null)).toBe(false);
    expect(dentroDeRango("", null, "2026-01-01")).toBe(false);
  });
});

describe("parseMultiple", () => {
  it("lee claves repetidas, sin vacíos ni duplicados", () => {
    const p = new URLSearchParams("c=a&c=b&c=&c=a");
    expect(parseMultiple(p, "c")).toEqual(["a", "b"]);
  });
  it("con validador, descarta valores inválidos", () => {
    const p = new URLSearchParams("t=CT&t=NOPE");
    expect(parseMultiple(p, "t", (v) => v === "CT")).toEqual(["CT"]);
  });
});

describe("parseVista", () => {
  it("default tabla; solo acepta kanban", () => {
    expect(parseVista(new URLSearchParams(""))).toBe("tabla");
    expect(parseVista(new URLSearchParams("vista=kanban"))).toBe("kanban");
    expect(parseVista(new URLSearchParams("vista=grilla"))).toBe("tabla");
  });
});

describe("opcionesDistintas", () => {
  it("deduplica por valor, ordena por etiqueta sin importar tildes y omite vacíos", () => {
    const ops = opcionesDistintas([
      { value: "2", label: "Zeta" },
      { value: "1", label: "Álvaro" },
      { value: "2", label: "Zeta" },
      { value: "", label: "Vacío" },
      undefined,
      { value: "3", label: "beta" },
    ]);
    expect(ops).toEqual([
      { value: "1", label: "Álvaro" },
      { value: "3", label: "beta" },
      { value: "2", label: "Zeta" },
    ]);
  });
});

describe("agruparPorEstado", () => {
  it("respeta el orden dado, incluye columnas vacías y descarta estados fuera del orden", () => {
    const items = [
      { id: "a", e: "c" },
      { id: "b", e: "a" },
      { id: "c", e: "x" },
      { id: "d", e: "a" },
    ];
    const grupos = agruparPorEstado(items, (i) => i.e, ["a", "b", "c"] as const);
    expect(grupos.map((g) => g.estado)).toEqual(["a", "b", "c"]);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["b", "d"]);
    expect(grupos[1].items).toEqual([]);
    expect(grupos[2].items.map((i) => i.id)).toEqual(["a"]);
  });
});
