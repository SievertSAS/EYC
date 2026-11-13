import { describe, it, expect, vi, beforeEach } from "vitest";

const pushSingle = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...args: unknown[]) => pushSingle(...args),
}));

import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import type { UbicacionFlotanteCatalogo } from "@/lib/db/types";
import {
  crearUbicacionFlotante,
  guardarCategoriaUbicacion,
  guardarUbicacionesFlotantes,
  listarCatalogoFlotantes,
} from "./catalogo-service";

// ============================================================
//  #188 — catálogo de ubicaciones flotantes + categoría de la visita
// ============================================================

function entrada(
  id: string,
  nombre: string,
  extra: Partial<UbicacionFlotanteCatalogo> = {}
): UbicacionFlotanteCatalogo {
  return {
    id,
    nombre,
    activo: true,
    sync_status: "synced",
    last_modified: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

beforeEach(async () => {
  await resetTestDb();
  pushSingle.mockClear();
});

describe("listarCatalogoFlotantes", () => {
  it("solo activas y no borradas, sin duplicados normalizados, ordenadas", async () => {
    await db.catalogo_ubicaciones_flotantes.bulkAdd([
      entrada("1", "Urgencias"),
      entrada("2", "UCI adultos"),
      entrada("3", "Inactiva", { activo: false }),
      entrada("4", "Borrada", { deleted_at: "2026-01-02" }),
      // Duplicado creado offline por otro técnico antes de sincronizar.
      entrada("5", "urgencias"),
    ]);
    const nombres = (await listarCatalogoFlotantes()).map((e) => e.nombre);
    expect(nombres).toEqual(["UCI adultos", "Urgencias"]);
  });
});

describe("crearUbicacionFlotante ('Otro')", () => {
  it("crea la entrada pendiente de sync con el creador y la empuja", async () => {
    const r = await crearUbicacionFlotante("  Sala  de partos ", "usr-1");
    expect(r).toEqual({ ok: true, nombre: "Sala de partos", creada: true });
    const filas = await db.catalogo_ubicaciones_flotantes.toArray();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      nombre: "Sala de partos",
      activo: true,
      creado_por: "usr-1",
      sync_status: "pending",
    });
    expect(pushSingle).toHaveBeenCalledWith("catalogo_ubicaciones_flotantes", filas[0].id);
  });

  it("no duplica: si ya existe (mayúsculas/tildes) devuelve el nombre del catálogo", async () => {
    await db.catalogo_ubicaciones_flotantes.add(entrada("1", "UCI pediátrica"));
    const r = await crearUbicacionFlotante("uci PEDIATRICA", "usr-1");
    expect(r).toEqual({ ok: true, nombre: "UCI pediátrica", creada: false });
    expect(await db.catalogo_ubicaciones_flotantes.count()).toBe(1);
    expect(pushSingle).not.toHaveBeenCalled();
  });

  it("rechaza un nombre vacío", async () => {
    const r = await crearUbicacionFlotante("   ", "usr-1");
    expect(r.ok).toBe(false);
    expect(await db.catalogo_ubicaciones_flotantes.count()).toBe(0);
  });
});

describe("categoría de ubicación de la visita", () => {
  it("flotante → guarda la categoría y las áreas; pasar a fija limpia las áreas", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const id = visita!.id!;

    await guardarCategoriaUbicacion(id, "flotante");
    const areas = [
      { nombre: "UCI adultos", descripcion: "Cama 3" },
      { nombre: "Reanimación", descripcion: "" },
    ];
    await guardarUbicacionesFlotantes(id, areas);
    let v = await db.visitas.get(id);
    expect(v?.categoria_ubicacion).toBe("flotante");
    expect(v?.ubicaciones_flotantes).toEqual(areas);
    expect(v?.sync_status).toBe("pending");

    // Un informe nunca mezcla fija y flotante.
    await guardarCategoriaUbicacion(id, "fija");
    v = await db.visitas.get(id);
    expect(v?.categoria_ubicacion).toBe("fija");
    // null (no undefined): el push tiene que limpiar la columna en Supabase.
    expect(v?.ubicaciones_flotantes).toBeNull();
    expect(pushSingle).toHaveBeenCalledWith("visitas", id);
  });
});
