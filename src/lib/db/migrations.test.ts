// Tests de las migraciones del esquema (src/lib/db/index.ts).
//
// Cubren:
//  - Instalación nueva: la DB abre en la versión declarada y las tablas
//    migradas a UUID tienen PK string (no auto-increment).
//  - El catálogo DIVIPOLA (departamentos/municipios) conserva PK numérica.
//  - v13 (cambio de PK ++id -> id): comportamiento FIJADO. Un upgrade con
//    datos sin .upgrade() lanza UpgradeError en Dexie 4.x — la app queda
//    sin abrir hasta que el usuario borre el IndexedDB. Ver
//    docs/modules/01-db.md §4.

import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { db } from "./index";
import { resetTestDb } from "@/test/db-reset";

describe("esquema — instalación nueva", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("abre en la versión 15", () => {
    expect(db.verno).toBe(15);
  });

  it("las tablas de dominio tienen PK string 'id' (migración v13 a UUID)", () => {
    for (const name of ["clientes", "sedes", "equipos", "visitas", "prueba_resultados"]) {
      const pk = db.table(name).schema.primKey;
      expect(pk.name, `${name}.primKey.name`).toBe("id");
      // auto es true cuando Dexie genera la clave (++id). Con UUID de cliente
      // debe ser false.
      expect(pk.auto, `${name}.primKey.auto`).toBe(false);
    }
  });

  it("departamentos/municipios conservan PK numérica (código DANE, no migran)", () => {
    for (const name of ["departamentos", "municipios"]) {
      const pk = db.table(name).schema.primKey;
      expect(pk.name).toBe("id");
      expect(pk.auto).toBe(false);
    }
  });

  it("las tablas bidireccionales tienen índice sync_status", () => {
    for (const name of ["clientes", "visitas", "conv_mediciones", "equipo_movimientos"]) {
      const idx = db.table(name).schema.indexes.map((i) => i.name);
      expect(idx, `${name} indexes`).toContain("sync_status");
    }
  });

  it("db-S08: v15 agregó sync_retry con clave compuesta [table_name+record_id]", () => {
    const pk = db.table("sync_retry").schema.primKey;
    expect(pk.keyPath).toEqual(["table_name", "record_id"]);
    expect(pk.auto).toBe(false);
  });

  it("db-S08: v14 dejó equipo_movimientos con índice sync_status (aditivo, sin perder datos)", async () => {
    await db.equipo_movimientos.add({
      id: "m1",
      equipo_id: "e1",
      ubicacion_nueva_id: "u2",
      fecha_movimiento: new Date().toISOString(),
      sync_status: "pending",
      last_modified: new Date().toISOString(),
    });
    const pendientes = await db.equipo_movimientos.where("sync_status").equals("pending").toArray();
    expect(pendientes).toHaveLength(1);
  });
});

describe("esquema — migración v13 (cambio de PK) con datos", () => {
  it("FIJADO: upgrade ++id -> id sin .upgrade() lanza UpgradeError (app no abre)", async () => {
    const name = "mig-v13-" + Math.random().toString(36).slice(2);

    // Estado previo: tabla con PK auto-increment y datos.
    const dbOld = new Dexie(name);
    dbOld.version(12).stores({ foo: "++id, name" });
    await dbOld.open();
    await dbOld.table("foo").bulkAdd([{ name: "A" }, { name: "B" }]);
    dbOld.close();

    // Nuevo esquema: misma tabla, PK ahora 'id' string, sin .upgrade().
    const dbNew = new Dexie(name);
    dbNew.version(12).stores({ foo: "++id, name" });
    dbNew.version(13).stores({ foo: "id, name" });

    await expect(dbNew.open()).rejects.toThrow(/changing primary key/i);

    dbNew.close();
    await Dexie.delete(name);
  });

  it("DB vacía sí migra sin problema (camino de instalación nueva)", async () => {
    const name = "mig-v13-empty-" + Math.random().toString(36).slice(2);
    const d = new Dexie(name);
    d.version(12).stores({ foo: "++id, name" });
    d.version(13).stores({ foo: "id, name" });

    await expect(d.open()).resolves.toBeDefined();
    expect(d.table("foo").schema.primKey.auto).toBe(false);

    d.close();
    await Dexie.delete(name);
  });
});
