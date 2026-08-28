import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { recopilarDatosConv } from "./secciones-convencional";

// Las filas conv_* tienen muchos campos obligatorios que no importan acá;
// `row()` afloja el tipado para armar fixtures mínimos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const row = <T>(o: Partial<T> & Record<string, unknown>) => o as any;

// recopilarDatosConv es el CONTRATO DE DATOS del PDF convencional: qué
// tablas conv_* lee y cómo. Los render*() dibujan sobre eso.

beforeEach(async () => {
  await resetTestDb();
});

const V = "visita-test";
const del = { deleted_at: "2026-01-01T00:00:00Z", sync_status: "synced", last_modified: "x" };
const ok = { sync_status: "synced", last_modified: "x" };

describe("recopilarDatosConv — carga de tablas", () => {
  it("visita vacía → estructura con arrays vacíos y catálogo de secciones por defecto", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.mediciones).toEqual([]);
    expect(d.raysafeMediciones).toEqual([]);
    expect(d.caeMediciones).toEqual([]);
    expect(d.secciones).toHaveLength(21);
    expect(d.secciones.every((s) => s.incluida)).toBe(true);
  });

  it("usa conv_informe_secciones cuando existen (respeta el toggle 'incluida')", async () => {
    await db.conv_informe_secciones.bulkAdd([
      row({ id: "s1", visita_id: V, prueba_codigo: "2.1", orden: 1, incluida: true }),
      row({ id: "s2", visita_id: V, prueba_codigo: "2.2", orden: 2, incluida: false }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.secciones).toHaveLength(2);
    expect(d.secciones.find((s) => s.prueba_codigo === "2.2")?.incluida).toBe(false);
  });

  it("dedupe de conv_inspeccion_items por (seccion, item_numero) — gana la que tiene concepto", async () => {
    await db.conv_inspeccion_items.bulkAdd([
      row({ id: "i1", visita_id: V, seccion: "equipo", item_numero: 1 }),
      row({ id: "i2", visita_id: V, seccion: "equipo", item_numero: 1, concepto: "Conforme" }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.inspeccion).toHaveLength(1);
    expect(d.inspeccion[0].concepto).toBe("Conforme");
  });
});

describe("recopilarDatosConv — filtrado de deleted_at (INCONSISTENTE — finding)", () => {
  it("conv_mediciones SÍ filtra deleted_at", async () => {
    await db.conv_mediciones.bulkAdd([
      row({ id: "m1", visita_id: V, punto_numero: 1, ...ok }),
      row({ id: "m2", visita_id: V, punto_numero: 2, ...del }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.mediciones.map((m) => m.id)).toEqual(["m1"]);
  });

  it("PIN: conv_raysafe_mediciones NO filtra deleted_at (fila borrada aparece en el PDF)", async () => {
    await db.conv_raysafe_mediciones.bulkAdd([
      row({ id: "r1", visita_id: V, toma_numero: 1, ...ok }),
      row({ id: "r2", visita_id: V, toma_numero: 2, ...del }),
    ]);
    const d = await recopilarDatosConv(V);
    // Comportamiento ACTUAL (bug latente): devuelve las 2. → issue #51.
    expect(d.raysafeMediciones.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("PIN: conv_cae_mediciones y conv_ddi_mediciones tampoco filtran deleted_at", async () => {
    await db.conv_cae_mediciones.add(row({ id: "c1", visita_id: V, toma_numero: 1, ...del }));
    await db.conv_ddi_mediciones.add(
      row({ id: "dd1", visita_id: V, grupo: 1, toma_numero: 1, ...del })
    );
    const d = await recopilarDatosConv(V);
    expect(d.caeMediciones).toHaveLength(1);
    expect(d.ddiMediciones).toHaveLength(1);
  });
});
