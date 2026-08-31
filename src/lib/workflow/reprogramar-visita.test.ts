import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

const pushSingle = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...a: unknown[]) => pushSingle(...a),
}));

import { reprogramarVisita } from "./reprogramar-visita";

beforeEach(async () => {
  await resetTestDb();
  pushSingle.mockClear();
});

describe("reprogramarVisita (#64)", () => {
  it("cambia fecha + técnico, deja traza y propaga a la solicitud", async () => {
    const { visita, solicitud } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const r = await reprogramarVisita(visita!.id!, {
      fechaVisita: "2026-09-15",
      tecnicoId: "tec-nuevo",
      motivo: "  El cliente pidió otra fecha  ",
      usuarioId: "prog-1",
    });
    expect(r.success).toBe(true);

    const v = await db.visitas.get(visita!.id!);
    expect(v?.fecha_visita).toBe("2026-09-15");
    expect(v?.tecnico_id).toBe("tec-nuevo");
    expect(v?.reprogramacion_motivo).toBe("El cliente pidió otra fecha");
    expect(v?.reprogramada_por_id).toBe("prog-1");
    expect(v?.reprogramada_en).toBeTruthy();
    expect(v?.sync_status).toBe("pending");
    expect(v?.estado_visita).toBe("asignada"); // no cambia el estado

    const s = await db.solicitudes.get(solicitud!.id!);
    expect(s?.fecha_estimada_visita).toBe("2026-09-15");
    expect(s?.tecnico_asignado_id).toBe("tec-nuevo");

    expect(pushSingle).toHaveBeenCalledWith("visitas", visita!.id!);
    expect(pushSingle).toHaveBeenCalledWith("solicitudes", solicitud!.id!);
  });

  it("exige motivo", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const r = await reprogramarVisita(visita!.id!, {
      fechaVisita: "2026-09-15",
      tecnicoId: "tec-1",
      motivo: "   ",
      usuarioId: "prog-1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/motivo/i);
    // no tocó nada
    expect(pushSingle).not.toHaveBeenCalled();
  });

  it("rechaza una visita que ya no está 'asignada'", async () => {
    const { visita } = await seedGraph({
      tipoEquipo: "CONVENCIONAL",
      estadoVisita: "en_progreso",
    });
    const r = await reprogramarVisita(visita!.id!, {
      fechaVisita: "2026-09-15",
      tecnicoId: "tec-1",
      motivo: "tarde",
      usuarioId: "prog-1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/asignada/i);
  });

  it("visita inexistente → error", async () => {
    const r = await reprogramarVisita("no-existe", {
      fechaVisita: "2026-09-15",
      tecnicoId: "tec-1",
      motivo: "x",
      usuarioId: "prog-1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no encontrada/i);
  });
});
