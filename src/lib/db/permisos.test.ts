import { describe, it, expect } from "vitest";
import {
  permisoDefault,
  accionesEfectivas,
  resolverPermiso,
  ROLES_DISPONIBLES,
  MODULOS_APP,
  ACCIONES_PERMISO,
} from "./types";
import type { RolPermiso } from "./types";

// ============================================================
//  Permisos granulares por rol y módulo
//  - permisoDefault: matriz de defaults por rol
//  - accionesEfectivas: registro + fallback a defaults
//  - resolverPermiso: regla "sin ver no hay acciones"
// ============================================================

describe("permisoDefault", () => {
  it("coordinador tiene acceso total a todos los módulos", () => {
    for (const modulo of MODULOS_APP) {
      const p = permisoDefault("coordinador", modulo);
      for (const accion of ACCIONES_PERMISO) {
        expect(p[accion], `coordinador.${modulo}.${accion}`).toBe(true);
      }
    }
  });

  it("eliminar es exclusivo del coordinador por defecto", () => {
    for (const rol of ROLES_DISPONIBLES) {
      if (rol === "coordinador") continue;
      for (const modulo of MODULOS_APP) {
        expect(permisoDefault(rol, modulo).eliminar, `${rol}.${modulo}.eliminar`).toBe(false);
      }
    }
  });

  it("comercial gestiona clientes y solicitudes (crear y editar)", () => {
    for (const modulo of ["clientes", "solicitudes"] as const) {
      const p = permisoDefault("comercial", modulo);
      expect(p.ver).toBe(true);
      expect(p.crear).toBe(true);
      expect(p.editar).toBe(true);
    }
  });

  it("comercial no accede a visitas, revision, informes ni configuracion", () => {
    for (const modulo of ["visitas", "revision", "informes", "configuracion"] as const) {
      expect(permisoDefault("comercial", modulo).ver, `comercial.${modulo}`).toBe(false);
    }
  });

  it("tecnico ejecuta visitas y equipos (editar sin crear)", () => {
    for (const modulo of ["visitas", "equipos"] as const) {
      const p = permisoDefault("tecnico", modulo);
      expect(p.ver).toBe(true);
      expect(p.editar).toBe(true);
      expect(p.crear).toBe(false);
    }
  });

  it("tecnico no accede a clientes ni solicitudes", () => {
    expect(permisoDefault("tecnico", "clientes").ver).toBe(false);
    expect(permisoDefault("tecnico", "solicitudes").ver).toBe(false);
  });

  it("programador gestiona solicitudes y visitas", () => {
    for (const modulo of ["solicitudes", "visitas"] as const) {
      const p = permisoDefault("programador", modulo);
      expect(p.ver).toBe(true);
      expect(p.crear).toBe(true);
      expect(p.editar).toBe(true);
    }
  });

  it("programador solo consulta clientes y equipos", () => {
    for (const modulo of ["clientes", "equipos"] as const) {
      const p = permisoDefault("programador", modulo);
      expect(p.ver).toBe(true);
      expect(p.crear).toBe(false);
      expect(p.editar).toBe(false);
    }
  });

  it("solo el coordinador ve configuracion por defecto", () => {
    expect(permisoDefault("coordinador", "configuracion").ver).toBe(true);
    for (const rol of ["programador", "tecnico", "comercial"] as const) {
      expect(permisoDefault(rol, "configuracion").ver).toBe(false);
    }
  });

  it("módulo sin acceso de ver tampoco tiene acciones (matriz consistente)", () => {
    for (const rol of ROLES_DISPONIBLES) {
      for (const modulo of MODULOS_APP) {
        const p = permisoDefault(rol, modulo);
        if (!p.ver) {
          expect(p.crear, `${rol}.${modulo}.crear`).toBe(false);
          expect(p.editar, `${rol}.${modulo}.editar`).toBe(false);
          expect(p.eliminar, `${rol}.${modulo}.eliminar`).toBe(false);
        }
      }
    }
  });
});

describe("accionesEfectivas", () => {
  it("sin registro, ver es false (no se confía en el default para ver)", () => {
    const e = accionesEfectivas(undefined, "comercial", "clientes");
    expect(e.ver).toBe(false);
  });

  it("acción sin definir cae al default del rol", () => {
    // Registro previo a permisos granulares: solo tiene activo
    const legacy: RolPermiso = { rol: "comercial", modulo: "clientes", activo: true };
    const e = accionesEfectivas(legacy, "comercial", "clientes");
    expect(e.ver).toBe(true);
    expect(e.crear).toBe(true); // default comercial.clientes
    expect(e.editar).toBe(true);
    expect(e.eliminar).toBe(false);
  });

  it("null se trata igual que sin definir (columnas de Supabase sin migrar)", () => {
    const p: RolPermiso = {
      rol: "comercial",
      modulo: "clientes",
      activo: true,
      crear: null,
      editar: null,
      eliminar: null,
    };
    const e = accionesEfectivas(p, "comercial", "clientes");
    expect(e.crear).toBe(true);
    expect(e.editar).toBe(true);
    expect(e.eliminar).toBe(false);
  });

  it("un override explícito false gana sobre un default true", () => {
    const p: RolPermiso = { rol: "comercial", modulo: "clientes", activo: true, crear: false };
    expect(accionesEfectivas(p, "comercial", "clientes").crear).toBe(false);
  });

  it("un override explícito true gana sobre un default false", () => {
    const p: RolPermiso = { rol: "tecnico", modulo: "equipos", activo: true, crear: true };
    expect(accionesEfectivas(p, "tecnico", "equipos").crear).toBe(true);
  });

  it("expone los valores crudos aunque ver esté apagado (para la UI de configuración)", () => {
    // Apagar "ver" no debe borrar los overrides guardados
    const p: RolPermiso = { rol: "comercial", modulo: "clientes", activo: false, crear: true };
    const e = accionesEfectivas(p, "comercial", "clientes");
    expect(e.ver).toBe(false);
    expect(e.crear).toBe(true);
  });
});

describe("resolverPermiso", () => {
  it("sin registro, ninguna acción está permitida", () => {
    for (const accion of ACCIONES_PERMISO) {
      expect(resolverPermiso(undefined, "coordinador", "clientes", accion)).toBe(false);
    }
  });

  it("sin ver, ninguna acción pasa aunque esté en true", () => {
    const p: RolPermiso = {
      rol: "comercial",
      modulo: "clientes",
      activo: false,
      crear: true,
      editar: true,
      eliminar: true,
    };
    for (const accion of ACCIONES_PERMISO) {
      expect(resolverPermiso(p, "comercial", "clientes", accion)).toBe(false);
    }
  });

  it("la acción por defecto es ver", () => {
    const p: RolPermiso = { rol: "tecnico", modulo: "visitas", activo: true };
    expect(resolverPermiso(p, "tecnico", "visitas")).toBe(true);
  });

  it("con ver activo, cada acción se resuelve por su valor efectivo", () => {
    const p: RolPermiso = {
      rol: "tecnico",
      modulo: "equipos",
      activo: true,
      crear: false,
      editar: true,
    };
    expect(resolverPermiso(p, "tecnico", "equipos", "crear")).toBe(false);
    expect(resolverPermiso(p, "tecnico", "equipos", "editar")).toBe(true);
    expect(resolverPermiso(p, "tecnico", "equipos", "eliminar")).toBe(false); // default tecnico
  });
});
