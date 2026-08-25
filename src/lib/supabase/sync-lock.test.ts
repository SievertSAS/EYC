import { beforeEach, describe, expect, it, vi } from "vitest";
import { withSyncLock } from "./sync-lock";

// ============================================================
//  withSyncLock — lock de concurrencia (PR3: sync-engine-entrega-garantizada)
//
//  happy-dom (entorno de test de Vitest, ver vitest.config.ts) NO
//  implementa la Web Locks API — `navigator.locks` es falsy (`null` en
//  happy-dom) en todos estos tests, así que ejercitan el fallback en
//  memoria del módulo, no `navigator.locks.request`. Ver sync-lock.ts
//  para el camino real usado en navegadores que sí la soportan.
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("sync-lock — withSyncLock", () => {
  beforeEach(() => {
    expect(navigator.locks).toBeFalsy();
  });

  it("ejecuta el spy una sola vez con dos llamadas concurrentes; la segunda queda locked sin ejecutar el spy", async () => {
    const spy = vi.fn(async () => {
      await delay(20);
      return "ok";
    });

    const [first, second] = await Promise.all([withSyncLock(spy), withSyncLock(spy)]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ran: true, value: "ok" });
    expect(second).toEqual({ ran: false, reason: "locked" });
  });

  it("libera el lock si la función protegida lanza una excepción — un intento posterior puede correr", async () => {
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(withSyncLock(failing)).rejects.toThrow("boom");

    const recovering = vi.fn(async () => "recovered");
    const result = await withSyncLock(recovering);

    expect(recovering).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ran: true, value: "recovered" });
  });

  it("da single-flight vía el fallback en memoria cuando navigator.locks es undefined (happy-dom)", async () => {
    expect(navigator.locks).toBeFalsy();

    const spy = vi.fn(async () => {
      await delay(10);
      return "fallback-ok";
    });

    const results = await Promise.all([withSyncLock(spy), withSyncLock(spy), withSyncLock(spy)]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.ran)).toHaveLength(1);
    expect(results.filter((r) => !r.ran)).toHaveLength(2);
  });
});
