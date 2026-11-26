import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import type { EstadoVisita } from "@/lib/db/types";
import {
  CORTE_CONCEPTO_REFERENCIA_28,
  resolverConceptoReferencia28,
  usaConceptoReferencia28,
} from "./concepto-referencia-28";

// ============================================================
//  Gate del concepto "Referencia" de la prueba 2.8.
//  Legado = se re-renderiza una versión de informe YA emitida antes del corte:
//  conserva el "NO APLICA" con el que se emitió. Todo lo demás (pre-informe,
//  versión nueva, re-aprobación tras corrección del cliente) usa "Referencia".
// ============================================================

describe("usaConceptoReferencia28 (función pura)", () => {
  it("el corte es una fecha ISO (YYYY-MM-DD)", () => {
    expect(CORTE_CONCEPTO_REFERENCIA_28).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("visita no emitida (pre-informe / en progreso / corrección del cliente) → lógica nueva", () => {
    expect(usaConceptoReferencia28({ visitaEmitida: false })).toBe(true);
    expect(
      usaConceptoReferencia28({ visitaEmitida: false, fechaGeneracionVersion: "2026-01-01" })
    ).toBe(true);
  });

  it("visita emitida sin versión de informe todavía → lógica nueva", () => {
    expect(usaConceptoReferencia28({ visitaEmitida: true })).toBe(true);
    expect(usaConceptoReferencia28({ visitaEmitida: true, fechaGeneracionVersion: null })).toBe(
      true
    );
  });

  it("versión emitida antes del corte → legado (NO APLICA)", () => {
    expect(
      usaConceptoReferencia28({
        visitaEmitida: true,
        fechaGeneracionVersion: "2026-11-25T23:59:59.000Z",
      })
    ).toBe(false);
    expect(
      usaConceptoReferencia28({ visitaEmitida: true, fechaGeneracionVersion: "2026-01-01" })
    ).toBe(false);
  });

  it("versión generada el día del corte o después → lógica nueva", () => {
    expect(
      usaConceptoReferencia28({
        visitaEmitida: true,
        fechaGeneracionVersion: `${CORTE_CONCEPTO_REFERENCIA_28}T00:00:00.000Z`,
      })
    ).toBe(true);
    expect(
      usaConceptoReferencia28({
        visitaEmitida: true,
        fechaGeneracionVersion: "2027-03-01T10:00:00.000Z",
      })
    ).toBe(true);
  });
});

describe("resolverConceptoReferencia28 (lee visita + versión vigente)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  async function seed(
    estadoVisita: EstadoVisita,
    versiones: { numero: number; fecha: string }[],
    versionActual = versiones.length
  ) {
    const { visita, equipo, ubicacion } = await seedGraph({ estadoVisita });
    if (versiones.length === 0) return visita!.id!;
    await db.informes.add({
      id: "inf-1",
      visita_id: visita!.id!,
      equipo_id: equipo.id!,
      ubicacion_id: ubicacion.id!,
      numero_informe: "EYC-2026-001",
      version_actual: versionActual,
      qr_token: "qr",
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2028-01-01",
      estado: "aprobado",
      creado_en: versiones[0].fecha,
    });
    for (const v of versiones) {
      await db.informe_versiones.add({
        id: `ver-${v.numero}`,
        informe_id: "inf-1",
        numero_version: v.numero,
        fecha_generacion: v.fecha,
      });
    }
    return visita!.id!;
  }

  it("visita sin informe → lógica nueva", async () => {
    const visitaId = await seed("en_progreso", []);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(true);
  });

  it("visita inexistente → lógica nueva", async () => {
    expect(await resolverConceptoReferencia28("no-existe")).toBe(true);
  });

  it("informe aprobado y emitido antes del corte → legado", async () => {
    const visitaId = await seed("aprobada", [{ numero: 1, fecha: "2026-05-01T12:00:00.000Z" }]);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(false);
  });

  it("informe enviado y emitido antes del corte → legado", async () => {
    const visitaId = await seed("enviada", [{ numero: 1, fecha: "2026-05-01T12:00:00.000Z" }]);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(false);
  });

  it("devuelto por el cliente (visita de vuelta en progreso) → lógica nueva aunque la versión sea vieja", async () => {
    const visitaId = await seed("en_progreso", [{ numero: 1, fecha: "2026-05-01T12:00:00.000Z" }]);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(true);
  });

  it("re-aprobación tras corrección: decide la versión VIGENTE (nueva), no la v1", async () => {
    const visitaId = await seed("aprobada", [
      { numero: 1, fecha: "2026-05-01T12:00:00.000Z" },
      { numero: 2, fecha: "2026-12-01T12:00:00.000Z" },
    ]);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(true);
  });

  it("sin fila de la versión vigente: cae a `creado_en` del informe", async () => {
    // version_actual = 2 pero solo existe la v1 localmente.
    const visitaId = await seed("aprobada", [{ numero: 1, fecha: "2026-05-01T12:00:00.000Z" }], 2);
    expect(await resolverConceptoReferencia28(visitaId)).toBe(false);
  });
});
