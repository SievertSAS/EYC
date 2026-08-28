import { describe, it, expect } from "vitest";
import {
  getPackage,
  hasPackage,
  getPackagedEquipmentTypes,
  getModules,
  getDefaultModules,
  getRequiredModules,
  canCreateVisitFor,
  assertCanCreateVisitFor,
  NoPackageError,
} from "./registry";
import { TIPOS_EQUIPO } from "@/lib/db/types";

describe("registry — paquetes por tipo de equipo", () => {
  it("solo CONVENCIONAL tiene paquete hoy", () => {
    expect(getPackagedEquipmentTypes()).toEqual(["CONVENCIONAL"]);
    expect(hasPackage("CONVENCIONAL")).toBe(true);
    expect(getPackage("CONVENCIONAL")).toBeDefined();
  });

  it("los demás tipos no tienen paquete", () => {
    for (const tipo of TIPOS_EQUIPO) {
      if (tipo === "CONVENCIONAL") continue;
      expect(hasPackage(tipo), tipo).toBe(false);
      expect(getPackage(tipo), tipo).toBeUndefined();
    }
  });

  it("getModules cae a MODULOS_DEFAULT para tipos sin paquete", () => {
    const conv = getModules("CONVENCIONAL").map((m) => m.id);
    const ct = getModules("CT").map((m) => m.id);
    expect(conv).not.toEqual(ct);
    expect(ct).toEqual(getDefaultModules().map((m) => m.id));
  });

  it("getRequiredModules de CONVENCIONAL", () => {
    const req = getRequiredModules("CONVENCIONAL");
    expect(req.length).toBeGreaterThan(0);
    // los requeridos del paquete CONVENCIONAL son grupo-a/b/d/e (no info ni pre-informe)
    expect(req).toContain("grupo-a");
  });
});

describe("registry — guard del hallazgo #7 (canCreateVisitFor)", () => {
  it("permite CONVENCIONAL", () => {
    expect(canCreateVisitFor("CONVENCIONAL")).toBe(true);
    expect(() => assertCanCreateVisitFor("CONVENCIONAL")).not.toThrow();
  });

  it("rechaza cualquier tipo sin paquete con NoPackageError", () => {
    for (const tipo of ["CT", "MAMOGRAFO", "PANORAMICO"] as const) {
      expect(canCreateVisitFor(tipo), tipo).toBe(false);
      let caught: unknown;
      try {
        assertCanCreateVisitFor(tipo);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(NoPackageError);
      expect((caught as NoPackageError).tipoEquipo).toBe(tipo);
      expect((caught as Error).message).toContain("#7");
    }
  });
});
