// Tier 2 — fix-ahora del motor de sync (#17-#21, #3 interino).
// Ver docs/modules/04-sync.md.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "@/test/fake-supabase";
import { withClockSkew } from "@/test/net";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeClient: any;
vi.mock("./client", () => ({ createClient: () => fakeClient }));

import {
  retryErrorRecords,
  getFailingPullTables,
  pullAllPending,
  pullSyncTable,
  getPullConflictStats,
  resetPullConflictStats,
} from "./sync-engine";

beforeEach(async () => {
  await resetTestDb();
  fakeClient = createFakeSupabaseClient() as FakeSupabaseClient;
  resetPullConflictStats();
});
afterEach(() => vi.restoreAllMocks());

// ─── #18: retryErrorRecords recupera filas "failed" ───

describe("#18 — retryErrorRecords recupera registros terminales", () => {
  it("mueve una fila 'failed' a 'pending' y le borra la fila de sync_retry", async () => {
    await db.clientes.add({
      id: "c-failed",
      nombre_cliente: "X",
      nit: "1",
      sync_status: "failed",
      last_modified: "2026-01-01T00:00:00.000Z",
    });
    await db.sync_retry.put({
      table_name: "clientes",
      record_id: "c-failed",
      attempts: 5,
      next_attempt_at: "2026-01-01T00:00:00.000Z",
      status: "failed",
      last_error: "boom",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const count = await retryErrorRecords();

    expect(count).toBe(1);
    expect((await db.clientes.get("c-failed"))?.sync_status).toBe("pending");
    expect(await db.sync_retry.get(["clientes", "c-failed"])).toBeUndefined();
  });

  it("no toca filas 'synced'", async () => {
    await db.clientes.add({
      id: "ok",
      nombre_cliente: "X",
      nit: "1",
      sync_status: "synced",
      last_modified: "2026-01-01T00:00:00.000Z",
    });
    expect(await retryErrorRecords()).toBe(0);
    expect((await db.clientes.get("ok"))?.sync_status).toBe("synced");
  });
});

// ─── #19: errores de pull por tabla quedan visibles ───

describe("#19 — pullAllPending registra el error por tabla", () => {
  it("un fallo de pull queda en sync_meta y lo lista getFailingPullTables", async () => {
    fakeClient.throwOnCall("clientes", "select", 1, { message: "boom de red", code: "500" });

    await pullAllPending();

    const failing = await getFailingPullTables();
    const clientes = failing.find((f) => f.table === "clientes");
    expect(clientes?.error).toContain("boom de red");
    expect(clientes?.since).toBeTruthy();
  });

  it("un pull exitoso posterior limpia el error registrado", async () => {
    await db.sync_meta.put({
      table_name: "clientes",
      last_pulled_at: "",
      last_pull_error: "viejo error",
      last_pull_error_at: "2026-01-01T00:00:00.000Z",
    });

    await pullSyncTable(fakeClient, "clientes", "clientes");

    const meta = await db.sync_meta.get("clientes");
    expect(meta?.last_pull_error).toBeNull();
    expect((await getFailingPullTables()).length).toBe(0);
  });
});

// ─── #3 interino: colisión "servidor más nuevo que edición local" ───

describe("#3 interino — detección de colisión en el pull", () => {
  it("cuenta la colisión cuando el remoto es más nuevo que el local pendiente", async () => {
    await db.clientes.add({
      id: "c1",
      nombre_cliente: "edición local sin subir",
      nit: "1",
      sync_status: "pending",
      last_modified: "2026-01-01T00:00:00.000Z",
    });
    fakeClient.seedTable("clientes", [
      {
        id: "c1",
        nombre_cliente: "versión del servidor, más nueva",
        nit: "1",
        last_modified: "2026-06-01T00:00:00.000Z",
      },
    ]);

    await pullSyncTable(fakeClient, "clientes", "clientes");

    const stats = getPullConflictStats();
    expect(stats.count).toBe(1);
    expect(stats.sample[0]).toMatchObject({ table: "clientes", id: "c1" });
    // El local NO se pisa (se mantiene la edición pendiente).
    expect((await db.clientes.get("c1"))?.nombre_cliente).toBe("edición local sin subir");
    expect((await db.clientes.get("c1"))?.sync_status).toBe("pending");
  });

  it("NO cuenta colisión si el local pendiente es más nuevo que el remoto", async () => {
    await db.clientes.add({
      id: "c2",
      nombre_cliente: "local nuevo",
      nit: "1",
      sync_status: "pending",
      last_modified: "2026-06-01T00:00:00.000Z",
    });
    fakeClient.seedTable("clientes", [
      {
        id: "c2",
        nombre_cliente: "remoto viejo",
        nit: "1",
        last_modified: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await pullSyncTable(fakeClient, "clientes", "clientes");

    expect(getPullConflictStats().count).toBe(0);
  });
});

// ─── #5 interino: watermark a prueba de reloj desfasado ───
//
// La migración 016 hace que Supabase estampe `last_modified` server-side en
// cada UPDATE. Con eso, un dispositivo con el reloj adelantado NO rompe el
// pull incremental de otro: el filtro `.gt(last_modified, watermark)` usa
// timestamps del servidor, no del cliente.

describe("#5 interino — pull incremental con reloj de cliente desfasado", () => {
  it("un cliente con reloj +2h igual baja las filas nuevas (timestamps del servidor)", async () => {
    // El servidor estampa last_modified con SU reloj (stampServerTimestamps).
    fakeClient = createFakeSupabaseClient({ stampServerTimestamps: true }) as FakeSupabaseClient;

    // Fila en el servidor "recién" modificada (hora del servidor = ahora real).
    fakeClient.seedTable("clientes", [
      { id: "c-server", nombre_cliente: "del servidor", nit: "1" },
    ]);
    // Forzar el estampado server-side simulando un upsert.
    await fakeClient.from("clientes").upsert({ id: "c-server", nombre_cliente: "del servidor" });

    // Watermark local viejo (nunca sincronizó esta tabla).
    // El cliente corre el pull con el reloj +2h adelantado.
    const pulled = await withClockSkew(2 * 60 * 60 * 1000, () =>
      pullSyncTable(fakeClient, "clientes", "clientes")
    );

    expect(pulled).toBeGreaterThan(0);
    expect((await db.clientes.get("c-server"))?.sync_status).toBe("synced");
  });
});
