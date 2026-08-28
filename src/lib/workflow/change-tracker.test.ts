import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { trackChange, updateWithTracking, getChangeHistory } from "./change-tracker";

beforeEach(async () => {
  await resetTestDb();
});

describe("trackChange", () => {
  it("escribe una fila en change_logs", async () => {
    await trackChange("clientes", "c1", "nombre", "viejo", "nuevo", "u1");
    const logs = await db.change_logs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      tabla: "clientes",
      registro_id: "c1",
      campo: "nombre",
      valor_anterior: "viejo",
      valor_nuevo: "nuevo",
      modificado_por_id: "u1",
    });
  });
});

describe("updateWithTracking", () => {
  it("loguea SOLO los campos que cambiaron y aplica el update", async () => {
    await db.clientes.add({
      id: "c1",
      nombre_cliente: "ACME",
      nit: "1",
      telefono: "111",
      sync_status: "synced",
      last_modified: "x",
    });

    const changed = await updateWithTracking(
      "clientes",
      db.clientes as unknown as Parameters<typeof updateWithTracking>[1],
      "c1",
      { nombre_cliente: "ACME S.A.", telefono: "111" }, // solo nombre cambia
      "u1"
    );

    expect(changed).toEqual(["nombre_cliente"]);
    expect((await db.clientes.get("c1"))?.nombre_cliente).toBe("ACME S.A.");
    expect(await db.change_logs.count()).toBe(1);
  });

  it("registro inexistente → [] y no escribe nada", async () => {
    expect(
      await updateWithTracking(
        "clientes",
        db.clientes as unknown as Parameters<typeof updateWithTracking>[1],
        "no-existe",
        { nit: "9" },
        "u"
      )
    ).toEqual([]);
    expect(await db.change_logs.count()).toBe(0);
  });

  it("sin cambios reales → [] y no aplica update", async () => {
    await db.clientes.add({
      id: "c2",
      nombre_cliente: "X",
      nit: "1",
      sync_status: "synced",
      last_modified: "x",
    });
    const changed = await updateWithTracking(
      "clientes",
      db.clientes as unknown as Parameters<typeof updateWithTracking>[1],
      "c2",
      { nombre_cliente: "X" },
      "u"
    );
    expect(changed).toEqual([]);
    expect(await db.change_logs.count()).toBe(0);
  });
});

describe("getChangeHistory", () => {
  it("trae el historial de un registro (Dexie 4 resuelve el where compuesto con los índices simples)", async () => {
    // Verificado: aunque el schema no declara el índice compuesto
    // [tabla+registro_id], Dexie 4 lo resuelve usando los índices `tabla` y
    // `registro_id` que sí existen. getChangeHistory funciona.
    await trackChange("clientes", "c1", "nombre", "a", "b", "u1");
    await trackChange("clientes", "c1", "nit", "1", "2", "u1");
    await trackChange("clientes", "OTRO", "nombre", "x", "y", "u1");

    const history = await getChangeHistory("clientes", "c1");
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.campo).sort()).toEqual(["nit", "nombre"]);
  });

  it("sin historial → []", async () => {
    expect(await getChangeHistory("clientes", "nada")).toEqual([]);
  });
});
