import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import {
  getModuleStatuses,
  getVisitCompleteness,
  getVisitCompletenessBulk,
} from "./module-completeness";

// module-completeness decide si una visita puede avanzar ("enviar a revisión").
// Tests con una base sembrada real (conv_* vía Dexie).

const CODIGOS = [
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "2.5",
  "2.6",
  "2.7",
  "2.8",
  "2.9",
  "2.10",
  "2.11",
  "2.12",
  "2.13",
  "2.14",
  "2.15",
  "2.16",
  "2.17",
  "2.18",
  "2.19",
  "2.20",
  "2.21",
];

async function excluirTodasLasSecciones(visitaId: string) {
  // incluida: false → getEstadoPruebasPorGrupo trata cada prueba como resuelta.
  await db.conv_informe_secciones.bulkAdd(
    CODIGOS.map((codigo, i) => ({
      id: `${visitaId}-${codigo}`,
      visita_id: visitaId,
      prueba_codigo: codigo,
      orden: i + 1,
      incluida: false,
      sync_status: "synced" as const,
      last_modified: new Date().toISOString(),
    }))
  );
}

describe("module-completeness — visita CONVENCIONAL", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("visita recién creada (sin datos conv_*) → grupos requeridos bloquean", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const status = await getModuleStatuses(visita!.id!);
    expect(status["grupo-a"].status).toBe("sin_iniciar");

    const comp = await getVisitCompleteness(visita!.id!);
    // grupo-a/b/d/e son requeridos en MODULOS_CONVENCIONAL
    expect(comp.blocking).toEqual(
      expect.arrayContaining(["grupo-a", "grupo-b", "grupo-d", "grupo-e"])
    );
    expect(comp.percentage).toBeLessThan(100);
  });

  it("todas las secciones excluidas del informe → nada bloquea", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await excluirTodasLasSecciones(visita!.id!);

    const comp = await getVisitCompleteness(visita!.id!);
    expect(comp.blocking).toEqual([]);
    expect(comp.percentage).toBe(100);
  });

  it("visita inexistente → estructura vacía, sin bloqueos", async () => {
    expect(await getModuleStatuses("no-existe")).toEqual({});
    const comp = await getVisitCompleteness("no-existe");
    expect(comp).toMatchObject({ total: 0, completed: 0, blocking: [] });
  });
});

describe("module-completeness — hallazgo #7 (visita sin paquete)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("PIN: equipo de tipo sin paquete → módulos default nunca coinciden con getModuleStatuses → bloqueo permanente", async () => {
    // El guard de registry (Tier 3) impide crear estas visitas; si igual
    // existiera una, getVisitCompleteness la deja bloqueada para siempre.
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { tipo_equipo: "CT" });

    const comp = await getVisitCompleteness(visita!.id!);
    // getDefaultModules ids (condiciones/levantamiento/pruebas) no están en
    // progressMap → todos sin_iniciar → los requeridos bloquean.
    expect(comp.blocking).toEqual(
      expect.arrayContaining(["condiciones", "levantamiento", "pruebas"])
    );
  });
});

describe("module-completeness — #15 getVisitCompletenessBulk", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("PIN: es un loop secuencial de getVisitCompleteness (no una versión batch)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
      ids.push(visita!.id!);
    }

    const map = await getVisitCompletenessBulk(ids);
    expect(map.size).toBe(3);
    for (const id of ids) {
      expect(map.get(id)?.blocking.length).toBeGreaterThan(0);
    }
    // El costo es O(visitas × ~15 scans conv_*). Optimización → issue.
  });

  it("lista vacía → Map vacío", async () => {
    expect((await getVisitCompletenessBulk([])).size).toBe(0);
  });
});
