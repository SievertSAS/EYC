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

  it("abre en la versión 20", () => {
    expect(db.verno).toBe(20);
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

describe("esquema — v19 deduplica conv_informe_secciones antes de v20 (índice único)", () => {
  it("conserva la fila editada por el usuario, borra la sobrante, y v20 rechaza nuevos duplicados", async () => {
    const name = "mig-v19-" + Math.random().toString(36).slice(2);
    const storeV18 = {
      conv_informe_secciones:
        "id, visita_id, prueba_codigo, [visita_id+prueba_codigo], sync_status",
    };

    // Estado previo: bug reproducido -- dos filas para el mismo
    // (visita_id, prueba_codigo), una sin tocar y otra editada a mano.
    const dbOld = new Dexie(name);
    dbOld.version(18).stores(storeV18);
    await dbOld.open();
    await dbOld.table("conv_informe_secciones").bulkAdd([
      {
        id: "sobrante",
        visita_id: "v1",
        prueba_codigo: "2.2",
        orden: 2,
        incluida: true,
        creado_en: "2026-01-01T00:00:00Z",
      },
      {
        id: "editada",
        visita_id: "v1",
        prueba_codigo: "2.2",
        orden: 2,
        incluida: true,
        creado_en: "2026-01-01T00:05:00Z",
        observaciones: "Nota del coordinador",
      },
      {
        id: "unica",
        visita_id: "v1",
        prueba_codigo: "2.3",
        orden: 3,
        incluida: true,
        creado_en: "2026-01-01T00:00:00Z",
      },
    ]);
    dbOld.close();

    // Mismo camino de migración que EyCDatabase (v19 dedupe + v20 índice único).
    const dbNew = new Dexie(name);
    dbNew.version(18).stores(storeV18);
    dbNew
      .version(19)
      .stores({})
      .upgrade(async (tx) => {
        const tabla = tx.table("conv_informe_secciones");
        const filas = await tabla.toArray();
        const porClave = new Map<string, typeof filas>();
        for (const fila of filas) {
          const clave = `${fila.visita_id}|${fila.prueba_codigo}`;
          const grupo = porClave.get(clave) ?? [];
          grupo.push(fila);
          porClave.set(clave, grupo);
        }
        for (const grupo of porClave.values()) {
          if (grupo.length <= 1) continue;
          grupo.sort((a, b) => {
            const editadaA =
              a.concepto != null || a.observaciones || a.acciones_correctivas ? 1 : 0;
            const editadaB =
              b.concepto != null || b.observaciones || b.acciones_correctivas ? 1 : 0;
            if (editadaA !== editadaB) return editadaB - editadaA;
            return (a.creado_en ?? "").localeCompare(b.creado_en ?? "");
          });
          await tabla.bulkDelete(grupo.slice(1).map((f) => f.id));
        }
      });
    dbNew.version(20).stores({
      conv_informe_secciones:
        "id, visita_id, prueba_codigo, &[visita_id+prueba_codigo], sync_status",
    });

    await expect(dbNew.open()).resolves.toBeDefined();

    const restantes = await dbNew.table("conv_informe_secciones").toArray();
    expect(restantes).toHaveLength(2);
    expect(restantes.find((r) => r.prueba_codigo === "2.2")?.id).toBe("editada");
    expect(restantes.find((r) => r.prueba_codigo === "2.3")?.id).toBe("unica");

    // El índice único ya está operativo: un intento nuevo de duplicar
    // (visita_id, prueba_codigo) debe fallar, no crear otra fila.
    await expect(
      dbNew.table("conv_informe_secciones").add({
        id: "nueva-duplicada",
        visita_id: "v1",
        prueba_codigo: "2.3",
        orden: 3,
        incluida: true,
        creado_en: "2026-01-01T00:10:00Z",
      })
    ).rejects.toThrow();

    dbNew.close();
    await Dexie.delete(name);
  });
});
