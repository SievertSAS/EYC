import { describe, it, expect } from "vitest";
import { buscarClienteDuplicado, normalizarNit, normalizarNombre } from "./cliente-duplicado";

const existentes = [
  { id: "1", nombre_cliente: "IMAGENES DIAGNOSTICAS", nit: "800.189.984" },
  { id: "2", nombre_cliente: "Virrey Solis IPS S.A.", nit: "800003765" },
];

describe("normalizarNit", () => {
  it("deja solo dígitos", () => {
    expect(normalizarNit("800.189.984-6")).toBe("8001899846");
    expect(normalizarNit(" 800 189 984 ")).toBe("800189984");
  });

  it("devuelve vacío para undefined", () => {
    expect(normalizarNit(undefined)).toBe("");
  });
});

describe("normalizarNombre", () => {
  it("ignora mayúsculas, tildes, puntuación y espacios repetidos", () => {
    expect(normalizarNombre("  Imágenes   Diagnósticas S.A.S ")).toBe("imagenes diagnosticas sas");
  });
});

describe("buscarClienteDuplicado", () => {
  it("detecta NIT duplicado aunque cambie el formato", () => {
    const r = buscarClienteDuplicado(existentes, { nombre_cliente: "Otro", nit: "800189984" });
    expect(r).toEqual({ campo: "nit", cliente: existentes[0] });
  });

  it("detecta nombre duplicado ignorando mayúsculas y tildes", () => {
    const r = buscarClienteDuplicado(existentes, {
      nombre_cliente: "imágenes diagnósticas",
      nit: "",
    });
    expect(r).toEqual({ campo: "nombre", cliente: existentes[0] });
  });

  it("prioriza el NIT cuando coinciden ambos", () => {
    const r = buscarClienteDuplicado(existentes, {
      nombre_cliente: "Virrey Solis IPS SA",
      nit: "800003765",
    });
    expect(r?.campo).toBe("nit");
  });

  it("no compara NIT vacío", () => {
    const r = buscarClienteDuplicado([{ id: "3", nombre_cliente: "A", nit: "" }], {
      nombre_cliente: "B",
      nit: "",
    });
    expect(r).toBeNull();
  });

  it("excluye al propio cliente al editar", () => {
    const r = buscarClienteDuplicado(
      existentes,
      { nombre_cliente: "IMAGENES DIAGNOSTICAS", nit: "800189984" },
      "1"
    );
    expect(r).toBeNull();
  });

  it("ignora clientes con soft-delete", () => {
    const r = buscarClienteDuplicado(
      [{ id: "9", nombre_cliente: "Ayudas", nit: "800225057", deleted_at: "2026-10-14" }],
      { nombre_cliente: "Ayudas", nit: "800225057" }
    );
    expect(r).toBeNull();
  });

  it("devuelve null si no hay coincidencias", () => {
    const r = buscarClienteDuplicado(existentes, { nombre_cliente: "Nuevo", nit: "123" });
    expect(r).toBeNull();
  });
});
