import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { irAVisita, isVisitaDetailPath, volverAVisitas } from "./visita-nav";

describe("isVisitaDetailPath", () => {
  it("es true para el detalle de una visita", () => {
    expect(isVisitaDetailPath("/dashboard/visitas/abc123")).toBe(true);
  });

  it("es false para el listado de visitas sin id", () => {
    expect(isVisitaDetailPath("/dashboard/visitas")).toBe(false);
  });

  it("es false para subrutas dentro del detalle de una visita", () => {
    expect(isVisitaDetailPath("/dashboard/visitas/abc/sub")).toBe(false);
  });

  it("es false para rutas fuera de /dashboard/visitas", () => {
    expect(isVisitaDetailPath("/dashboard")).toBe(false);
  });
});

describe("irAVisita / volverAVisitas", () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: assignMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    assignMock.mockClear();
  });

  it("irAVisita navega al workspace de la visita sin módulo", () => {
    irAVisita("visita-1");
    expect(assignMock).toHaveBeenCalledWith("/dashboard/visitas/visita-1");
  });

  it("irAVisita navega al workspace con el módulo indicado", () => {
    irAVisita("visita-1", "grupo-a");
    expect(assignMock).toHaveBeenCalledWith("/dashboard/visitas/visita-1?modulo=grupo-a");
  });

  it("volverAVisitas navega al listado de visitas", () => {
    volverAVisitas();
    expect(assignMock).toHaveBeenCalledWith("/dashboard/visitas");
  });
});
