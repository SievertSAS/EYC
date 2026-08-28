// Invariante deleted_at (borrado suave). Escenarios db-S16 / db-S18.
//
// El sync-engine escribe `deleted_at` sobre cualquier tabla vía deleteAndSync.
// La regla es "toda lectura que arma una lista filtra !deleted_at". Hoy eso
// NO se cumple para las tablas maestras: `db.clientes.toArray()` y similares
// devuelven las filas borradas. Este test FIJA ese comportamiento imperfecto
// para que cualquier cambio (bueno o malo) sea visible. Ver hallazgo #14.

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./index";
import { resetTestDb } from "@/test/db-reset";
import { makeCliente } from "@/test/factories";

describe("deleted_at — comportamiento actual (pin)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("db-S16: db.clientes.toArray() DEVUELVE las filas con deleted_at (no filtra)", async () => {
    await db.clientes.add(makeCliente({ id: "vivo", nombre_cliente: "Vivo" }));
    await db.clientes.add(
      makeCliente({
        id: "borrado",
        nombre_cliente: "Borrado",
        deleted_at: new Date().toISOString(),
      })
    );

    const todos = await db.clientes.toArray();

    // Comportamiento ACTUAL: devuelve las 2. Cuando se arregle el hallazgo
    // #14, este test debe actualizarse a `toHaveLength(1)`.
    expect(todos).toHaveLength(2);
    expect(todos.map((c) => c.id).sort()).toEqual(["borrado", "vivo"]);
  });

  it("un filtro manual !deleted_at sí las excluye (patrón que usan los conv_*)", async () => {
    await db.clientes.add(makeCliente({ id: "vivo" }));
    await db.clientes.add(makeCliente({ id: "borrado", deleted_at: new Date().toISOString() }));

    const vivos = (await db.clientes.toArray()).filter((c) => !c.deleted_at);

    expect(vivos).toHaveLength(1);
    expect(vivos[0].id).toBe("vivo");
  });

  it("db-S18: deleted_at es parte del tipo (opcional) en filas sincronizables", async () => {
    // Compila ⇒ el campo existe en el tipo. En runtime, se persiste y se lee.
    const c = makeCliente({ id: "x", deleted_at: "2026-01-01T00:00:00.000Z" });
    await db.clientes.add(c);
    const back = await db.clientes.get("x");
    expect(back?.deleted_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
