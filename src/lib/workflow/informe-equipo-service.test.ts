import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { makeUbicacion } from "@/test/factories";

const pushSingle = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...a: unknown[]) => pushSingle(...a),
}));

import { crearInformeDesdeVisita } from "./informe-service";
import { trasladarEquipo } from "./equipo-service";

beforeEach(async () => {
  await resetTestDb();
  pushSingle.mockClear();
});

// ─── informe-service ───

describe("crearInformeDesdeVisita", () => {
  it("numera EYC-{año}-001 el primer informe del año", async () => {
    const { visita } = await seedGraph();
    const inf = await crearInformeDesdeVisita(visita!.id!, "ing-1", "tec-1");
    expect(inf.numero_informe).toBe(`EYC-${new Date().getFullYear()}-001`);
    expect(inf.version_actual).toBe(1);
    expect(await db.informe_versiones.where("informe_id").equals(inf.id!).count()).toBe(1);
  });

  it("incrementa el secuencial con informes previos del año", async () => {
    const year = new Date().getFullYear();
    await db.informes.add({
      id: "prev",
      visita_id: "otra",
      equipo_id: "e",
      ubicacion_id: "u",
      numero_informe: `EYC-${year}-007`,
      version_actual: 1,
      concepto_general: "FAVORABLE",
      qr_token: "t",
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2028-01-01",
      estado: "aprobado",
      creado_en: "2026-01-01",
    });
    const { visita } = await seedGraph();
    const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
    expect(inf.numero_informe).toBe(`EYC-${year}-008`);
  });

  it("concepto NO_FAVORABLE si alguna prueba lo es (equipo sin paquete dedicado, flujo legacy)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CT" });
    await db.prueba_resultados.bulkAdd([
      {
        id: "p1",
        visita_id: visita!.id!,
        prueba_definicion_id: "d1",
        equipo_id: "e",
        completado: true,
        concepto: "FAVORABLE",
        sync_status: "synced",
        last_modified: "x",
      },
      {
        id: "p2",
        visita_id: visita!.id!,
        prueba_definicion_id: "d2",
        equipo_id: "e",
        completado: true,
        concepto: "NO_FAVORABLE",
        sync_status: "synced",
        last_modified: "x",
      },
    ]);
    const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
    expect(inf.concepto_general).toBe("NO_FAVORABLE");
  });

  it("vencimiento a 2 años de la emisión", async () => {
    const { visita } = await seedGraph();
    const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
    const emis = new Date(inf.fecha_emision);
    const venc = new Date(inf.fecha_vencimiento);
    expect(venc.getFullYear() - emis.getFullYear()).toBe(2);
  });

  it("re-aprobación: nueva versión sobre el MISMO informe, no uno nuevo", async () => {
    const { visita } = await seedGraph();
    const inf1 = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
    const inf2 = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");

    expect(inf2.id).toBe(inf1.id);
    expect(inf2.version_actual).toBe(2);
    expect(await db.informes.count()).toBe(1);
    expect(await db.informe_versiones.where("informe_id").equals(inf1.id!).count()).toBe(2);
  });

  it("visita inexistente → lanza", async () => {
    await expect(crearInformeDesdeVisita("no-existe", "i", "t")).rejects.toThrow();
  });

  // #153: un equipo CONVENCIONAL evalúa sus pruebas con conv_informe_secciones
  // + evaluarConceptoPrueba()/conceptoEfectivoSeccion() -- NO con
  // prueba_resultados (flujo legacy, siempre vacía para estos equipos). Sin
  // esta rama, el concepto general salía FAVORABLE sin importar el resultado
  // real de las 21 pruebas.
  describe("#153 — equipo CONVENCIONAL usa conv_informe_secciones, no prueba_resultados", () => {
    it("una prueba No_conforme (evaluada por evaluarConceptoPrueba) → concepto general NO_FAVORABLE", async () => {
      const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
      await db.conv_informe_secciones.add({
        id: "s21",
        visita_id: visita!.id!,
        prueba_codigo: "2.1",
        orden: 1,
        incluida: true,
      });
      await db.conv_mediciones.add({
        id: "m1",
        visita_id: visita!.id!,
        punto_numero: 1,
        ubicacion_descripcion: "Consola",
        concepto: "No_conforme",
      });

      const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
      expect(inf.concepto_general).toBe("NO_FAVORABLE");
    });

    it("todas las pruebas Conforme → concepto general FAVORABLE, aunque haya basura en prueba_resultados", async () => {
      const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
      await db.conv_informe_secciones.add({
        id: "s21",
        visita_id: visita!.id!,
        prueba_codigo: "2.1",
        orden: 1,
        incluida: true,
      });
      await db.conv_mediciones.add({
        id: "m1",
        visita_id: visita!.id!,
        punto_numero: 1,
        ubicacion_descripcion: "Consola",
        concepto: "Conforme",
      });
      // Fila legacy que NO debe influir en un equipo con paquete dedicado.
      await db.prueba_resultados.add({
        id: "p-legacy",
        visita_id: visita!.id!,
        prueba_definicion_id: "d1",
        equipo_id: "e",
        completado: true,
        concepto: "NO_FAVORABLE",
        sync_status: "synced",
        last_modified: "x",
      });

      const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
      expect(inf.concepto_general).toBe("FAVORABLE");
    });

    it("una sección marcada 'No_favorable_no_ejecutada' (#120) también vuelve el concepto general NO_FAVORABLE", async () => {
      const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
      await db.conv_informe_secciones.add({
        id: "s211",
        visita_id: visita!.id!,
        prueba_codigo: "2.11",
        orden: 1,
        incluida: true,
        concepto: "No_favorable_no_ejecutada",
      });

      const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
      expect(inf.concepto_general).toBe("NO_FAVORABLE");
    });
  });

  // #154: informes/informe_versiones eran MASTER_TABLES (solo pull) — el
  // informe creado/publicado localmente nunca llegaba a Supabase, así que
  // /verificar/[token] (que consulta Supabase directo) nunca lo encontraba.
  it("#154: sube el informe y luego su versión, en ese orden (FK informe_versiones -> informes)", async () => {
    const { visita } = await seedGraph();
    const inf = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");

    expect(pushSingle).toHaveBeenCalledWith("informes", inf.id);
    expect(pushSingle).toHaveBeenCalledWith("informe_versiones", expect.any(String));
    const ordenInformes = pushSingle.mock.calls.findIndex((c) => c[0] === "informes");
    const ordenVersiones = pushSingle.mock.calls.findIndex((c) => c[0] === "informe_versiones");
    expect(ordenInformes).toBeLessThan(ordenVersiones);

    const informeLocal = await db.informes.get(inf.id!);
    expect(informeLocal?.sync_status).toBe("pending");
  });

  it("#154: re-aprobación también sube el informe (actualizado) y la nueva versión", async () => {
    const { visita } = await seedGraph();
    const inf1 = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");
    pushSingle.mockClear();

    const inf2 = await crearInformeDesdeVisita(visita!.id!, "ing", "tec");

    expect(pushSingle).toHaveBeenCalledWith("informes", inf1.id);
    expect(pushSingle).toHaveBeenCalledWith("informe_versiones", expect.any(String));
    const ordenInformes = pushSingle.mock.calls.findIndex((c) => c[0] === "informes");
    const ordenVersiones = pushSingle.mock.calls.findIndex((c) => c[0] === "informe_versiones");
    expect(ordenInformes).toBeLessThan(ordenVersiones);
    expect(inf2.version_actual).toBe(2);
  });
});

// ─── equipo-service ───

describe("trasladarEquipo", () => {
  it("cambia ubicacion_id y registra el movimiento en una transacción", async () => {
    const { equipo, sede } = await seedGraph({ conVisita: false });
    const destino = makeUbicacion(sede.id!);
    await db.ubicaciones_rx.add(destino);

    const res = await trasladarEquipo(equipo.id!, destino.id!, {
      motivo: "  mudanza  ",
      registradoPorId: "u1",
    });

    expect(res.success).toBe(true);
    expect((await db.equipos.get(equipo.id!))?.ubicacion_id).toBe(destino.id);
    const mov = await db.equipo_movimientos.get(res.movimientoId!);
    expect(mov).toMatchObject({
      equipo_id: equipo.id,
      ubicacion_nueva_id: destino.id,
      motivo: "mudanza", // trim
      registrado_por_id: "u1",
    });
  });

  it("misma ubicación → rechaza", async () => {
    const { equipo, ubicacion } = await seedGraph({ conVisita: false });
    const res = await trasladarEquipo(equipo.id!, ubicacion.id!);
    expect(res.success).toBe(false);
    expect(res.error).toContain("ya está");
  });

  it("destino inexistente → rechaza y no toca el equipo", async () => {
    const { equipo, ubicacion } = await seedGraph({ conVisita: false });
    const res = await trasladarEquipo(equipo.id!, "no-existe");
    expect(res.success).toBe(false);
    expect((await db.equipos.get(equipo.id!))?.ubicacion_id).toBe(ubicacion.id);
  });

  it("equipo inexistente → rechaza", async () => {
    expect((await trasladarEquipo("no-existe", "tampoco")).success).toBe(false);
  });
});
