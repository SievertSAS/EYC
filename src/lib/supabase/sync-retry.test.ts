import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import {
  computeBackoffDelayMs,
  isDue,
  isPermanent,
  MAX_ATTEMPTS,
  recordFailure,
  recordSuccess,
} from "./sync-retry";

// ============================================================
//  sync-retry — backoff exponencial + clasificación de errores
//  (PR2: sync-engine-entrega-garantizada)
// ============================================================

const TABLE = "clientes";
const RECORD_ID = "id-0001";
const NOW = new Date("2026-01-01T00:00:00.000Z");

function setOnline(online: boolean): void {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

function expectWithinJitter(actualMs: number, baseMs: number): void {
  expect(actualMs).toBeGreaterThanOrEqual(Math.floor(baseMs * 0.8));
  expect(actualMs).toBeLessThanOrEqual(Math.ceil(baseMs * 1.2));
}

describe("sync-retry", () => {
  beforeEach(async () => {
    await resetTestDb();
    // Solo se mockea `Date` — fake-indexeddb depende de macrotasks reales
    // (setTimeout/queueMicrotask) para resolver sus transacciones, así
    // que faltear el reloj completo (`vi.useFakeTimers()`) cuelga los
    // tests que tocan Dexie.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("backoff exacto", () => {
    it("intento 1 falla → próximo intento en ~1min (±20% jitter)", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(1);
      expect(retry?.status).toBe("retrying");

      const deltaMs = new Date(retry!.next_attempt_at).getTime() - NOW.getTime();
      expectWithinJitter(deltaMs, 60_000);
    });

    it("intento 2 falla → próximo intento en ~4min (±20% jitter)", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(2);
      expect(retry?.status).toBe("retrying");

      const deltaMs = new Date(retry!.next_attempt_at).getTime() - NOW.getTime();
      expectWithinJitter(deltaMs, 240_000);
    });

    it("intento 3 falla → próximo intento en ~16min (±20% jitter)", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(3);
      expect(retry?.status).toBe("retrying");

      const deltaMs = new Date(retry!.next_attempt_at).getTime() - NOW.getTime();
      expectWithinJitter(deltaMs, 960_000);
    });

    it("intento 4 falla → próximo intento en ~60min (tope, ±20% jitter)", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(4);
      expect(retry?.status).toBe("retrying");

      const deltaMs = new Date(retry!.next_attempt_at).getTime() - NOW.getTime();
      expectWithinJitter(deltaMs, 3_600_000);
    });

    it("intento 5 falla → sync_status pasa a 'failed', sin más reintentos automáticos", async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      }

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(MAX_ATTEMPTS);
      expect(retry?.status).toBe("failed");
    });
  });

  describe("clasificación de códigos de error", () => {
    const PERMANENT_CODES = ["23505", "23502", "22P02", "42703", "PGRST204", "42501"];

    it.each(PERMANENT_CODES)(
      "código permanente %s → 'failed' directo en el intento 1",
      async (code) => {
        expect(isPermanent(code)).toBe(true);

        await recordFailure(TABLE, RECORD_ID, { message: "constraint violation", code });

        const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
        expect(retry?.attempts).toBe(1);
        expect(retry?.status).toBe("failed");
      }
    );

    const TRANSIENT_CODES = ["fetch failed", "500", "503", "429", "PGRST301", "23503"];

    it.each(TRANSIENT_CODES)(
      "código transitorio %s → consume un intento y programa retry",
      async (code) => {
        expect(isPermanent(code)).toBe(false);

        await recordFailure(TABLE, RECORD_ID, { message: "transient error", code });

        const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
        expect(retry?.attempts).toBe(1);
        expect(retry?.status).toBe("retrying");
      }
    );

    it("código desconocido/no mapeado → se trata como transitorio por defecto", async () => {
      expect(isPermanent("XX999")).toBe(false);

      await recordFailure(TABLE, RECORD_ID, { message: "unknown error", code: "XX999" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(1);
      expect(retry?.status).toBe("retrying");
    });

    it("error sin código → se trata como transitorio por defecto", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network drop" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry?.attempts).toBe(1);
      expect(retry?.status).toBe("retrying");
    });
  });

  describe("éxito", () => {
    it("recordSuccess borra la fila correspondiente de sync_retry", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await expect(db.sync_retry.get([TABLE, RECORD_ID])).resolves.toBeDefined();

      await recordSuccess(TABLE, RECORD_ID);

      await expect(db.sync_retry.get([TABLE, RECORD_ID])).resolves.toBeUndefined();
    });

    it("recordSuccess sobre un registro sin fila de retry no falla", async () => {
      await expect(recordSuccess(TABLE, RECORD_ID)).resolves.not.toThrow();
    });
  });

  describe("offline", () => {
    it("no incrementa el contador de intentos cuando navigator.onLine es false", async () => {
      setOnline(false);

      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const retry = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(retry).toBeUndefined();
    });

    it("no incrementa el contador de intentos si ya existía una fila y se cae offline", async () => {
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });
      const before = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(before?.attempts).toBe(1);

      setOnline(false);
      await recordFailure(TABLE, RECORD_ID, { message: "network error" });

      const after = await db.sync_retry.get([TABLE, RECORD_ID]);
      expect(after?.attempts).toBe(1);
    });
  });

  describe("isDue", () => {
    it("retorna true cuando next_attempt_at ya pasó", () => {
      const past = new Date(NOW.getTime() - 1000).toISOString();
      expect(isDue({ next_attempt_at: past })).toBe(true);
    });

    it("retorna false cuando next_attempt_at está en el futuro", () => {
      const future = new Date(NOW.getTime() + 60_000).toISOString();
      expect(isDue({ next_attempt_at: future })).toBe(false);
    });
  });

  describe("computeBackoffDelayMs", () => {
    it("respeta el tope de 60 minutos incluso en intentos altos", () => {
      const delay = computeBackoffDelayMs(10);
      expectWithinJitter(delay, 3_600_000);
    });
  });
});
