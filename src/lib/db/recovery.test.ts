import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { db } from "./index";
import { resetTestDb } from "@/test/db-reset";
import { needsLocalReset, resetAndReopen } from "./recovery";

describe("needsLocalReset", () => {
  it("reconoce el UpgradeError real de cambio de PK (v13)", async () => {
    const name = "rec-" + Math.random().toString(36).slice(2);
    const dbOld = new Dexie(name);
    dbOld.version(12).stores({ foo: "++id" });
    await dbOld.open();
    await dbOld.table("foo").add({ x: 1 });
    dbOld.close();

    const dbNew = new Dexie(name);
    dbNew.version(12).stores({ foo: "++id" });
    dbNew.version(13).stores({ foo: "id" });

    let caught: unknown;
    try {
      await dbNew.open();
    } catch (e) {
      caught = e;
    }
    dbNew.close();
    await Dexie.delete(name);

    expect(caught).toBeInstanceOf(Error);
    expect(needsLocalReset(caught)).toBe(true);
  });

  it("por name (UpgradeError / VersionError) y por mensaje", () => {
    const up = new Error("boom");
    up.name = "UpgradeError";
    expect(needsLocalReset(up)).toBe(true);

    const ver = new Error("boom");
    ver.name = "VersionError";
    expect(needsLocalReset(ver)).toBe(true);

    expect(needsLocalReset(new Error("Not yet support for changing primary key"))).toBe(true);
  });

  it("NO marca errores ajenos (cuota, red, undefined)", () => {
    const quota = new Error("quota exceeded");
    quota.name = "QuotaExceededError";
    expect(needsLocalReset(quota)).toBe(false);
    expect(needsLocalReset(new Error("network"))).toBe(false);
    expect(needsLocalReset(undefined)).toBe(false);
    expect(needsLocalReset("string")).toBe(false);
  });
});

describe("resetAndReopen", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("borra el contenido y deja la DB abierta en la versión actual", async () => {
    await db.clientes.add({ id: "c1", nombre_cliente: "X", nit: "1" });
    expect(await db.clientes.count()).toBe(1);

    await resetAndReopen();

    expect(db.isOpen()).toBe(true);
    expect(db.verno).toBe(15);
    expect(await db.clientes.count()).toBe(0);
  });
});
