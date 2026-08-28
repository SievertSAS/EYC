// Tests de los seeds de catálogo (src/lib/db/seed.ts).
// Escenarios db-S11..S15 (ver docs/modules/01-db.scenarios.md).

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./index";
import { resetTestDb } from "@/test/db-reset";
import { seedRolPermisos, seedPruebaDefiniciones } from "./seed";
import { ROLES_DISPONIBLES, MODULOS_APP } from "./types";

describe("seedRolPermisos", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("db-S11: DB vacía → escribe una fila por (rol × módulo)", async () => {
    await seedRolPermisos();

    const total = await db.rol_permisos.count();
    expect(total).toBe(ROLES_DISPONIBLES.length * MODULOS_APP.length);

    // spot check: coordinador.configuracion.ver = true; tecnico.clientes.ver = false
    const coordCfg = await db.rol_permisos
      .where({ rol: "coordinador", modulo: "configuracion" })
      .first();
    expect(coordCfg?.activo).toBe(true);
    const tecCli = await db.rol_permisos.where({ rol: "tecnico", modulo: "clientes" }).first();
    expect(tecCli?.activo).toBe(false);
  });

  it("db-S12: segunda llamada es no-op (no duplica)", async () => {
    await seedRolPermisos();
    const after1 = await db.rol_permisos.count();
    await seedRolPermisos();
    const after2 = await db.rol_permisos.count();
    expect(after2).toBe(after1);
  });

  it("db-S13 (pin): con datos parciales NO completa lo que falta", async () => {
    // Simula un seed interrumpido: solo 1 fila.
    await db.rol_permisos.add({
      id: "solo-una",
      rol: "coordinador",
      modulo: "dashboard",
      activo: true,
    });

    await seedRolPermisos();

    // El guard `count > 0` lo da por completo → sigue con 1 fila.
    expect(await db.rol_permisos.count()).toBe(1);
  });
});

describe("seedPruebaDefiniciones", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("db-S11: DB vacía → siembra el catálogo genérico y los permisos", async () => {
    await seedPruebaDefiniciones();

    expect(await db.prueba_definiciones.count()).toBeGreaterThan(0);
    expect(await db.rol_permisos.count()).toBe(ROLES_DISPONIBLES.length * MODULOS_APP.length);
  });

  it("db-S12: segunda llamada no duplica pruebas", async () => {
    await seedPruebaDefiniciones();
    const after1 = await db.prueba_definiciones.count();
    await seedPruebaDefiniciones();
    expect(await db.prueba_definiciones.count()).toBe(after1);
  });

  it("db-S14: rol_permisos ya poblada → siembra pruebas, permisos no-op", async () => {
    await seedRolPermisos();
    const permisosAntes = await db.rol_permisos.count();

    await seedPruebaDefiniciones();

    expect(await db.prueba_definiciones.count()).toBeGreaterThan(0);
    expect(await db.rol_permisos.count()).toBe(permisosAntes);
  });

  it("db-S15 (pin): el catálogo agrupado (grupo_pruebas) NO se siembra", async () => {
    await seedPruebaDefiniciones();
    // seedFromPackage está comentado → grupo_pruebas queda vacío.
    expect(await db.grupo_pruebas.count()).toBe(0);
  });

  it("codigo es único en el catálogo sembrado", async () => {
    await seedPruebaDefiniciones();
    const rows = await db.prueba_definiciones.toArray();
    const codigos = rows.map((r) => r.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});
