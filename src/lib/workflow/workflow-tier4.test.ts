import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

// executeTransition hace imports dinámicos de sync-engine, informe-service y
// publicar-informe — se mockean para no tocar red ni el cliente Supabase.
const pushSingle = vi.fn().mockResolvedValue(true);
const crearInformeDesdeVisita = vi.fn();
const publicarVersionOficial = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...a: unknown[]) => pushSingle(...a),
}));
vi.mock("./informe-service", () => ({
  crearInformeDesdeVisita: (...a: unknown[]) => crearInformeDesdeVisita(...a),
}));
vi.mock("./publicar-informe", () => ({
  publicarVersionOficial: (...a: unknown[]) => publicarVersionOficial(...a),
}));

import { executeTransition, checkGate, checkVisitConsistency } from "./visit-state-machine";
import { crearVisitaDesdeSolicitud } from "./visita-service";
import { NoPackageError } from "@/lib/equipos";

beforeEach(async () => {
  await resetTestDb();
  pushSingle.mockClear();
  crearInformeDesdeVisita.mockClear();
  publicarVersionOficial.mockClear();
  crearInformeDesdeVisita.mockResolvedValue({ id: "inf-1", numero_informe: "EYC-2026-001" });
});

// ─── #8: aprobar ahora tiene gate de completitud ───

describe("#8 — aprobar tiene gate de completitud", () => {
  it("aprobar con módulos incompletos → bloqueado, no publica informe", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "en_revision" });

    const gate = await checkGate(visita!.id!, "aprobar");
    expect(gate.canProceed).toBe(false);

    const res = await executeTransition(visita!.id!, "aprobar", "coordinador", {
      usuarioId: "u1",
    });
    expect(res.success).toBe(false);
    expect(res.gateResult?.canProceed).toBe(false);
    expect(crearInformeDesdeVisita).not.toHaveBeenCalled();
    expect((await db.visitas.get(visita!.id!))?.estado_visita).toBe("en_revision");
  });

  it("aprobar con todo excluido (completo) → aprueba y dispara la creación del informe", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "en_revision" });
    // Excluir todas las secciones → completitud 100%.
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: `s-${i}`,
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: false,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );

    const res = await executeTransition(visita!.id!, "aprobar", "coordinador", { usuarioId: "u1" });
    expect(res.success).toBe(true);
    expect(res.newState).toBe("aprobada");
    expect(crearInformeDesdeVisita).toHaveBeenCalledWith(visita!.id!, "u1", expect.any(String));
    expect(publicarVersionOficial).toHaveBeenCalledWith("inf-1", visita!.id!);
  });
});

// ─── #9 interino: transacción + reconciliación ───

describe("#9 interino — estado consistente", () => {
  it("iniciar_visita: visita y solicitud avanzan juntas", async () => {
    const { visita, solicitud } = await seedGraph({ estadoVisita: "asignada" });

    const res = await executeTransition(visita!.id!, "iniciar_visita", "tecnico");
    expect(res.success).toBe(true);
    expect((await db.visitas.get(visita!.id!))?.estado_visita).toBe("en_progreso");
    expect((await db.solicitudes.get(solicitud!.id!))?.pipeline_estado).toBe("ejecucion");
  });

  it("checkVisitConsistency detecta visita aprobada sin informe", async () => {
    const { visita } = await seedGraph({ estadoVisita: "aprobada" });
    const issues = await checkVisitConsistency(visita!.id!);
    expect(issues.some((i) => i.problema.includes("sin informe"))).toBe(true);
  });

  it("checkVisitConsistency detecta pipeline de solicitud divergente", async () => {
    const { visita, solicitud } = await seedGraph({ estadoVisita: "en_progreso" });
    await db.solicitudes.update(solicitud!.id!, { pipeline_estado: "solicitudes" });
    const issues = await checkVisitConsistency(visita!.id!);
    expect(issues.some((i) => i.problema.includes("solicitud"))).toBe(true);
  });

  it("visita consistente → sin issues", async () => {
    const { visita } = await seedGraph({ estadoVisita: "asignada" });
    expect(await checkVisitConsistency(visita!.id!)).toEqual([]);
  });
});

// ─── #6 / #7: crearVisitaDesdeSolicitud ───

describe("#6 / #7 — crearVisitaDesdeSolicitud", () => {
  it("#7: equipo de tipo sin paquete → falla con NoPackageError, no crea visita", async () => {
    const { equipo, solicitud } = await seedGraph({ conVisita: false });
    await db.equipos.update(equipo.id!, { tipo_equipo: "MAMOGRAFO" });

    const res = await crearVisitaDesdeSolicitud(solicitud!.id!, equipo.id!);
    expect(res.success).toBe(false);
    expect(res.error).toContain("MAMOGRAFO");
    expect(await db.visitas.count()).toBe(0);
  });

  it("#6: CONVENCIONAL sin catálogo grupo_pruebas → crea la visita con 0 pruebas (warn), success igual", async () => {
    const { equipo, solicitud } = await seedGraph({ conVisita: false });

    const res = await crearVisitaDesdeSolicitud(solicitud!.id!, equipo.id!);
    expect(res.success).toBe(true);
    expect(res.pruebasCreadas).toBe(0);
    expect(await db.visitas.count()).toBe(1);
  });

  it("#6: la visita usa el id que ya tiene (no regenera otro)", async () => {
    const { equipo, solicitud } = await seedGraph({ conVisita: false });
    const res = await crearVisitaDesdeSolicitud(solicitud!.id!, equipo.id!);
    const visitas = await db.visitas.toArray();
    expect(visitas).toHaveLength(1);
    expect(visitas[0].id).toBe(res.visitaId);
  });

  it("solicitud inexistente → success:false", async () => {
    const res = await crearVisitaDesdeSolicitud("no-existe", "tampoco");
    expect(res.success).toBe(false);
  });
});

describe("NoPackageError", () => {
  it("es una instancia de Error con tipoEquipo", () => {
    const e = new NoPackageError("CT");
    expect(e).toBeInstanceOf(Error);
    expect(e.tipoEquipo).toBe("CT");
  });
});
