// Smoke tests de las capacidades NUEVAS del FakeSupabaseClient (Tier 0).
// Las capacidades previas (paginación, maxRows, failOnCall) ya están
// cubiertas de forma indirecta por sync-engine.test.ts.

import { describe, it, expect } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";

describe("FakeSupabaseClient — capacidades nuevas", () => {
  it("throwOnCall hace que la llamada LANCE (no que devuelva {error})", async () => {
    const c = createFakeSupabaseClient();
    c.throwOnCall("clientes", "select", 1, { message: "network down", code: "ECONNREFUSED" });

    await expect(c.from("clientes").select("*")).rejects.toThrow("network down");
  });

  it("failOnCall hace que la llamada DEVUELVA {error} sin lanzar", async () => {
    const c = createFakeSupabaseClient();
    c.failOnCall("clientes", "upsert", 1, { message: "duplicate key", code: "23505" });

    const res = await c.from("clientes").upsert({ id: "a" });
    expect(res.error?.code).toBe("23505");
    expect(res.data).toBeNull();
  });

  it("stampServerTimestamps pisa last_modified con hora del servidor al upsert", async () => {
    const c = createFakeSupabaseClient({ stampServerTimestamps: true });
    const clienteClock = "2000-01-01T00:00:00.000Z"; // reloj del dispositivo atrasado

    await c.from("clientes").upsert({ id: "a", last_modified: clienteClock });

    const row = c.getServerRow("clientes", "a");
    expect(row?.last_modified).not.toBe(clienteClock);
    expect(new Date(row?.last_modified as string).getFullYear()).toBeGreaterThan(2000);
  });

  it("_version se incrementa en cada upsert de la misma fila", async () => {
    const c = createFakeSupabaseClient();
    await c.from("clientes").upsert({ id: "a", nombre_cliente: "v1" });
    await c.from("clientes").upsert({ id: "a", nombre_cliente: "v2" });

    expect(c.getServerRow("clientes", "a")?._version).toBe(2);
    expect(c.getServerRow("clientes", "a")?.nombre_cliente).toBe("v2");
  });

  it("patchServerRow deja una fila del servidor más nueva que la local", async () => {
    const c = createFakeSupabaseClient();
    c.seedTable("clientes", [{ id: "a", last_modified: "2026-01-01T00:00:00.000Z" }]);

    c.patchServerRow("clientes", "a", { last_modified: "2026-06-01T00:00:00.000Z" });

    expect(c.getServerRow("clientes", "a")?.last_modified).toBe("2026-06-01T00:00:00.000Z");
    expect(() => c.patchServerRow("clientes", "inexistente", {})).toThrow();
  });
});
