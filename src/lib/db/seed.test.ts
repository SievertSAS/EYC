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

  it("db-S13: con datos parciales completa SOLO los pares (rol, módulo) que faltan", async () => {
    // Simula un dispositivo con permisos ya sembrados (y uno editado desde
    // Configuración) antes de que existiera un módulo nuevo (#196: plantillas).
    await db.rol_permisos.add({
      id: "editada",
      rol: "tecnico",
      modulo: "clientes",
      activo: true, // override: por defecto el técnico NO ve clientes
    });

    await seedRolPermisos();

    expect(await db.rol_permisos.count()).toBe(ROLES_DISPONIBLES.length * MODULOS_APP.length);
    // El override existente no se pisa.
    expect((await db.rol_permisos.get("editada"))?.activo).toBe(true);
    // El módulo nuevo queda con su fila (si no, sería invisible para todos).
    const plantillas = await db.rol_permisos
      .where({ rol: "coordinador", modulo: "plantillas" })
      .first();
    expect(plantillas?.activo).toBe(true);
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

  it("db-S14: rol_permisos ya completa → siembra pruebas, permisos no-op", async () => {
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
