// Invariante deleted_at (borrado suave). Escenarios db-S16 / db-S18.
//
// El sync-engine escribe `deleted_at` sobre cualquier tabla vía deleteAndSync.
// La regla es "toda lectura que arma una lista filtra !deleted_at".
//
// Resolución #34: Dexie NO filtra solo (una `reading` hook no puede descartar
// filas). El filtro es responsabilidad de cada lectura, encadenando el
// predicado `noBorrado` antes de `.toArray()` / `.count()`. Todas las listas
// de la app (maestras, visitas, solicitudes) lo hacen; este test fija el
// contrato del helper y el hecho de que `.toArray()` crudo NO filtra.

import { describe, it, expect, beforeEach } from "vitest";
import { db, noBorrado } from "./index";
import { resetTestDb } from "@/test/db-reset";
import { makeCliente } from "@/test/factories";

describe("deleted_at — invariante de borrado suave (#34)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("db-S16: `.toArray()` crudo NO filtra — hay que encadenar `noBorrado`", async () => {
    await db.clientes.add(makeCliente({ id: "vivo", nombre_cliente: "Vivo" }));
    await db.clientes.add(
      makeCliente({
        id: "borrado",
        nombre_cliente: "Borrado",
        deleted_at: new Date().toISOString(),
      })
    );

    // Crudo: devuelve las 2 (Dexie no filtra).
    expect(await db.clientes.toArray()).toHaveLength(2);

    // Con el predicado: solo la viva. Es el patrón que usan TODAS las listas.
    const vivos = (await db.clientes.toArray()).filter(noBorrado);
    expect(vivos).toHaveLength(1);
    expect(vivos[0].id).toBe("vivo");
  });

  it("`noBorrado` también encadena en la query de Dexie (.filter antes de .count/.toArray)", async () => {
    await db.clientes.add(makeCliente({ id: "a" }));
    await db.clientes.add(makeCliente({ id: "b", deleted_at: new Date().toISOString() }));

    expect(await db.clientes.filter(noBorrado).count()).toBe(1);
    expect((await db.clientes.filter(noBorrado).toArray()).map((c) => c.id)).toEqual(["a"]);
  });

  it("`noBorrado`: null / undefined / ausente → vivo; string → borrado", () => {
    expect(noBorrado({ deleted_at: null })).toBe(true);
    expect(noBorrado({ deleted_at: undefined })).toBe(true);
    expect(noBorrado({})).toBe(true);
    expect(noBorrado({ deleted_at: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });

  it("db-S18: deleted_at es parte del tipo (opcional) en filas sincronizables", async () => {
    // Compila ⇒ el campo existe en el tipo. En runtime, se persiste y se lee.
    const c = makeCliente({ id: "x", deleted_at: "2026-01-01T00:00:00.000Z" });
    await db.clientes.add(c);
    const back = await db.clientes.get("x");
    expect(back?.deleted_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
