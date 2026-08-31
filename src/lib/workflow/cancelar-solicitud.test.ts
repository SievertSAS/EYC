import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { randomUUID } from "@/lib/uuid";

const pushSingle = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...a: unknown[]) => pushSingle(...a),
}));

import { cancelarSolicitud } from "./cancelar-solicitud";
import { crearVisitaDesdeSolicitud } from "./visita-service";

beforeEach(async () => {
  await resetTestDb();
  pushSingle.mockClear();
});

describe("cancelarSolicitud (#64)", () => {
  it("pasa la solicitud a 'cancelada' con traza y soft-deletea las visitas asignadas", async () => {
    const { solicitud, visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const r = await cancelarSolicitud(solicitud!.id!, {
      motivo: "  El cliente ya no lo necesita  ",
      usuarioId: "coord-1",
    });
    expect(r.success).toBe(true);
    expect(r.visitasCanceladas).toBe(1);

    const s = await db.solicitudes.get(solicitud!.id!);
    expect(s?.pipeline_estado).toBe("cancelada");
    expect(s?.cancelada_motivo).toBe("El cliente ya no lo necesita");
    expect(s?.cancelada_por_id).toBe("coord-1");
    expect(s?.cancelada_en).toBeTruthy();

    const v = await db.visitas.get(visita!.id!);
    expect(v?.deleted_at).toBeTruthy();
    expect(v?.sync_status).toBe("pending");

    expect(pushSingle).toHaveBeenCalledWith("solicitudes", solicitud!.id!);
    expect(pushSingle).toHaveBeenCalledWith("visitas", visita!.id!);
  });

  it("cancela sin visitas y no reporta cascada", async () => {
    const { solicitud } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conVisita: false });
    const r = await cancelarSolicitud(solicitud!.id!, { motivo: "duplicada", usuarioId: "u" });
    expect(r.success).toBe(true);
    expect(r.visitasCanceladas).toBe(0);
  });

  it("bloquea si hay una visita ya iniciada — no toca nada", async () => {
    const { solicitud, visita } = await seedGraph({
      tipoEquipo: "CONVENCIONAL",
      estadoVisita: "en_progreso",
    });
    const r = await cancelarSolicitud(solicitud!.id!, { motivo: "tarde", usuarioId: "u" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/iniciada/i);

    const s = await db.solicitudes.get(solicitud!.id!);
    expect(s?.pipeline_estado).not.toBe("cancelada");
    const v = await db.visitas.get(visita!.id!);
    expect(v?.deleted_at).toBeFalsy();
  });

  it("exige motivo", async () => {
    const { solicitud } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conVisita: false });
    const r = await cancelarSolicitud(solicitud!.id!, { motivo: "  ", usuarioId: "u" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/motivo/i);
  });

  it("no se puede cancelar dos veces", async () => {
    const { solicitud } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conVisita: false });
    await cancelarSolicitud(solicitud!.id!, { motivo: "x", usuarioId: "u" });
    const r = await cancelarSolicitud(solicitud!.id!, { motivo: "y", usuarioId: "u" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ya está cancelada/i);
  });

  it("solicitud inexistente → error", async () => {
    const r = await cancelarSolicitud("no-existe", { motivo: "x", usuarioId: "u" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no encontrada/i);
  });

  it("crearVisitaDesdeSolicitud rechaza una solicitud cancelada", async () => {
    const { solicitud, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conVisita: false });
    await cancelarSolicitud(solicitud!.id!, { motivo: "x", usuarioId: "u" });

    const r = await crearVisitaDesdeSolicitud(solicitud!.id!, equipo.id!);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/cancelada/i);
  });

  it("no cancela visitas de OTRA solicitud", async () => {
    const g1 = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const otraVisitaId = randomUUID();
    await db.visitas.add({
      id: otraVisitaId,
      solicitud_id: "otra-solicitud",
      estado_visita: "asignada",
      sync_status: "pending",
      last_modified: new Date().toISOString(),
    });
    await cancelarSolicitud(g1.solicitud!.id!, { motivo: "x", usuarioId: "u" });
    const otra = await db.visitas.get(otraVisitaId);
    expect(otra?.deleted_at).toBeFalsy();
  });
});
