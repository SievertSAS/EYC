import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import {
  createFakeSupabaseClient,
  type FakeRow,
  type FakeSupabaseClient,
} from "@/test/fake-supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeClient: any;

// El módulo bajo prueba importa `createClient` desde "./client" — lo
// reemplazamos por nuestro stub para no depender de env vars reales ni de
// un backend Supabase real.
vi.mock("./client", () => ({
  createClient: () => fakeClient,
}));

// Import estático: `vi.mock` se hoistea sobre los imports, así que el mock
// de "./client" ya está activo cuando `sync-engine.ts` se evalúa.
import { fullSync, pullSyncTable, pushAllPending, retryRecord } from "./sync-engine";

// ============================================================
//  pullSyncTable — paginación keyset (PR1: sync-engine-entrega-garantizada)
//
//  PostgREST trunca silenciosamente las respuestas a `max_rows` (1000,
//  ver supabase/config.toml:18) sin devolver error. Antes de esta fase,
//  `pullSyncTable` no paginaba, así que tablas con más de 1000 filas
//  modificadas perdían filas silenciosamente en cada pull.
// ============================================================

function buildRemoteRows(count: number, opts?: { qualifyEvenOnly?: boolean }): FakeRow[] {
  return Array.from({ length: count }, (_, i) => {
    const qualifies = opts?.qualifyEvenOnly ? i % 2 === 0 : true;
    return {
      id: `id-${String(i).padStart(4, "0")}`,
      nit: `NIT-${i}`,
      nombre_cliente: `Cliente ${i}`,
      last_modified: qualifies ? "2026-02-01T00:00:00.000Z" : "2025-01-01T00:00:00.000Z",
      sync_status: "synced",
    };
  });
}

describe("sync-engine — pullSyncTable (paginación keyset)", () => {
  beforeEach(async () => {
    await resetTestDb();
    fakeClient = createFakeSupabaseClient() as FakeSupabaseClient;
  });

  it("descarga las 1200 filas remotas paginando más allá del límite max_rows=1000 de PostgREST", async () => {
    const remoteRows = buildRemoteRows(1200);
    fakeClient.seedTable("clientes", remoteRows, { maxRows: 1000 });

    const pulled = await pullSyncTable(fakeClient, "clientes", "clientes");

    expect(pulled).toBe(1200);
    await expect(db.clientes.count()).resolves.toBe(1200);
  });

  it("no avanza el watermark si una página intermedia falla, aunque páginas previas ya se hayan persistido", async () => {
    const remoteRows = buildRemoteRows(1200);
    fakeClient.seedTable("clientes", remoteRows);
    fakeClient.failOnCall("clientes", "select", 2, { message: "network drop en página 2" });

    await expect(pullSyncTable(fakeClient, "clientes", "clientes")).rejects.toBeTruthy();

    // La página 1 (500 filas) sí llegó a persistirse localmente...
    await expect(db.clientes.count()).resolves.toBe(500);
    // ...pero el watermark de sync_meta NUNCA avanzó porque el pull no
    // terminó con éxito (setLastSyncTimestamp no se alcanza si hay throw).
    const meta = await db.sync_meta.get("clientes");
    expect(meta).toBeUndefined();
  });

  it("mantiene el filtro last_modified y la regla de conflicto de forma consistente en todas las páginas", async () => {
    const watermark = "2026-01-01T12:00:00.000Z";
    await db.sync_meta.put({ table_name: "clientes", last_pulled_at: watermark });

    // 1100 filas remotas: las de índice par (550) tienen last_modified
    // posterior al watermark y califican; las impares (550) son anteriores
    // y deben quedar excluidas en TODAS las páginas, no solo en la primera.
    const remoteRows = buildRemoteRows(1100, { qualifyEvenOnly: true });
    fakeClient.seedTable("clientes", remoteRows);

    // Conflictos locales: uno cae en la página 1 (id-0500) y otro en la
    // página 2 (id-1050) según el cursor keyset por id, PAGE_SIZE=500.
    await db.clientes.put({
      id: "id-0500",
      nombre_cliente: "Local pendiente pag1",
      nit: "LOCAL-1",
      sync_status: "pending",
      last_modified: "2026-01-05T00:00:00.000Z",
    });
    await db.clientes.put({
      id: "id-1050",
      nombre_cliente: "Local pendiente pag2",
      nit: "LOCAL-2",
      sync_status: "pending",
      last_modified: "2026-01-05T00:00:00.000Z",
    });

    const pulled = await pullSyncTable(fakeClient, "clientes", "clientes");

    // 550 filas califican por el filtro last_modified; 2 de ellas son
    // conflictos locales (no se sobrescriben) → 548 se cuentan como "pulled".
    expect(pulled).toBe(548);

    // Las filas impares (anteriores al watermark) nunca llegan a Dexie,
    // ni las de la página 1 (id-0501) ni las de la página 2 (id-1051).
    await expect(db.clientes.get("id-0501")).resolves.toBeUndefined();
    await expect(db.clientes.get("id-1051")).resolves.toBeUndefined();

    // El conflicto se resuelve igual en ambas páginas: se conserva la
    // versión local y se marca sync_status="conflict".
    const conflictPage1 = await db.clientes.get("id-0500");
    expect(conflictPage1?.sync_status).toBe("conflict");
    expect(conflictPage1?.nombre_cliente).toBe("Local pendiente pag1");

    const conflictPage2 = await db.clientes.get("id-1050");
    expect(conflictPage2?.sync_status).toBe("conflict");
    expect(conflictPage2?.nombre_cliente).toBe("Local pendiente pag2");
  });
});

describe("sync-engine — fullSync (integración con pullSyncTable)", () => {
  beforeEach(async () => {
    await resetTestDb();
    fakeClient = createFakeSupabaseClient() as FakeSupabaseClient;
  });

  it("integra la paginación de pullSyncTable en el ciclo completo y persiste el watermark tras un pull exitoso", async () => {
    const remoteRows = buildRemoteRows(3);
    fakeClient.seedTable("clientes", remoteRows);

    const result = await fullSync();

    // Solo nos interesa el pull de "clientes" (tabla SYNC_TABLES bajo
    // prueba). Las tablas MASTER_TABLES usan `.range()`, fuera del alcance
    // del stub de este PR (paginación keyset de pullSyncTable únicamente).
    const clientesErrors = result.errors.filter((e) => e.table === "clientes");
    expect(clientesErrors).toEqual([]);
    await expect(db.clientes.count()).resolves.toBe(3);
    const meta = await db.sync_meta.get("clientes");
    expect(meta?.last_pulled_at).toBeDefined();
  });
});

// ============================================================
//  Push con schedule de retry (PR2: sync-engine-entrega-garantizada)
//
//  Un registro con una fila en `sync_retry` cuyo `next_attempt_at` está
//  en el futuro no debe volver a pushearse en el ciclo automático hasta
//  que llegue esa hora. `retryRecord` permite al técnico saltarse ese
//  schedule y forzar el push inmediato de un registro puntual.
// ============================================================

describe("sync-engine — push respeta el schedule de sync_retry", () => {
  beforeEach(async () => {
    await resetTestDb();
    fakeClient = createFakeSupabaseClient() as FakeSupabaseClient;
  });

  it("no vuelve a pushear un registro con next_attempt_at en el futuro", async () => {
    await db.clientes.put({
      id: "id-pending",
      nombre_cliente: "Cliente pendiente",
      nit: "NIT-1",
      sync_status: "pending",
    });

    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.sync_retry.put({
      table_name: "clientes",
      record_id: "id-pending",
      attempts: 2,
      next_attempt_at: futureIso,
      status: "retrying",
      last_error: "network error",
      updated_at: new Date().toISOString(),
    });

    const { pushed } = await pushAllPending();

    expect(pushed).toBe(0);
    expect(fakeClient.callCount("clientes", "upsert")).toBe(0);
    const record = await db.clientes.get("id-pending");
    expect(record?.sync_status).toBe("pending");
  });

  it("retryRecord pushea inmediatamente saltándose el schedule de next_attempt_at futuro", async () => {
    await db.clientes.put({
      id: "id-pending",
      nombre_cliente: "Cliente pendiente",
      nit: "NIT-1",
      sync_status: "pending",
    });

    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.sync_retry.put({
      table_name: "clientes",
      record_id: "id-pending",
      attempts: 2,
      next_attempt_at: futureIso,
      status: "retrying",
      last_error: "network error",
      updated_at: new Date().toISOString(),
    });

    await retryRecord("clientes", "id-pending");

    expect(fakeClient.callCount("clientes", "upsert")).toBe(1);
    const record = await db.clientes.get("id-pending");
    expect(record?.sync_status).toBe("synced");
    await expect(db.sync_retry.get(["clientes", "id-pending"])).resolves.toBeUndefined();
  });

  it("retryRecord pasa por el lock de concurrencia: dos reintentos simultáneos del mismo registro pushean una sola vez", async () => {
    await db.clientes.put({
      id: "id-concurrent-retry",
      nombre_cliente: "Cliente reintento concurrente",
      nit: "NIT-CR",
      sync_status: "failed",
    });

    // Reintento manual del técnico "al mismo tiempo" que un reintento
    // automático de backoff sobre el mismo registro: el lock permite solo
    // un intento, el perdedor se salta sin lanzar error.
    await Promise.all([
      retryRecord("clientes", "id-concurrent-retry"),
      retryRecord("clientes", "id-concurrent-retry"),
    ]);

    expect(fakeClient.callCount("clientes", "upsert")).toBe(1);
    const record = await db.clientes.get("id-concurrent-retry");
    expect(record?.sync_status).toBe("synced");
  });
});

// ============================================================
//  Lock de concurrencia (PR3: sync-engine-entrega-garantizada)
//
//  fullSync/pushAllPending están envueltos con withSyncLock (ver
//  sync-lock.ts) para que solo un ciclo de sync corra a la vez —
//  necesario porque el Service Worker dispara SYNC_REQUESTED a cada
//  tab abierta (sw-register.tsx) y cada una corre fullSync() en su
//  propio contexto.
// ============================================================

describe("sync-engine — lock de concurrencia", () => {
  beforeEach(async () => {
    await resetTestDb();
    fakeClient = createFakeSupabaseClient() as FakeSupabaseClient;
  });

  it("fullSync: una segunda llamada concurrente se omite con un error _lock, sin duplicar el ciclo", async () => {
    const [first, second] = await Promise.all([fullSync(), fullSync()]);

    expect(first.errors.find((e) => e.table === "_lock")).toBeUndefined();
    expect(second.pushed).toBe(0);
    expect(second.pulled).toBe(0);
    expect(second.errors).toEqual([
      {
        table: "_lock",
        recordId: "0",
        error: "Sincronización omitida: ya hay otra sincronización en curso",
        action: "push",
      },
    ]);
  });

  it("pushAllPending: la segunda llamada concurrente se omite y no duplica el push del mismo registro pendiente", async () => {
    await db.clientes.put({
      id: "id-concurrent",
      nombre_cliente: "Cliente concurrente",
      nit: "NIT-CONC",
      sync_status: "pending",
    });

    const [first, second] = await Promise.all([pushAllPending(), pushAllPending()]);

    expect(fakeClient.callCount("clientes", "upsert")).toBe(1);
    expect(first.pushed + second.pushed).toBe(1);
    const record = await db.clientes.get("id-concurrent");
    expect(record?.sync_status).toBe("synced");
  });
});
