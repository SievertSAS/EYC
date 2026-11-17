import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

// ============================================================
//  #190 — Resultados en vivo de la 2.4 en el Grupo B: si la consola no
//  muestra tiempo nominal, la exactitud (desviación) se muestra "N/A" y el
//  badge del grupo lo decide solo la repetibilidad (CV).
// ============================================================

const useDb = vi.fn();
vi.mock("@/components/db-provider", () => ({ useDb: () => useDb() }));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({ role: "tecnico", cargo: "tecnico", usuarioId: "u1", nombre: "Tec" }),
}));
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
  updateAndSync: vi.fn().mockResolvedValue(undefined),
  deleteAndSync: vi.fn().mockResolvedValue(undefined),
}));

import { GrupoBModulo } from "./grupo-b-modulo";

/** Desviación ~47 % respecto a 0,8 s nominal, con CV ~5 %. */
async function seed(parametros_consola: ("kv" | "ma" | "tiempo" | "mas")[] | null) {
  const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
  await db.equipos.update(equipo.id!, { parametros_consola });
  await db.conv_raysafe_mediciones.bulkAdd(
    [0.4, 0.42, 0.44].map((tiempo_medido_s, i) => ({
      id: randomUUID(),
      visita_id: visita!.id!,
      tipo_medicion: "principal" as const,
      grupo_numero: 1,
      toma_numero: i + 1,
      tiempo_nominal_s: 0.8,
      tiempo_medido_s,
      sync_status: "synced" as const,
      last_modified: new Date().toISOString(),
    }))
  );
  return visita!.id!;
}

async function fila24(): Promise<HTMLElement> {
  const label = await screen.findByText(/^Grupo 1 \(0,8\d*s nominal\)$/);
  return label.parentElement!;
}

describe("GrupoBModulo — 2.4 exactitud 'No aplica' sin tiempo nominal (#190)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("consola con tiempo: muestra la desviación y el grupo queda NC", async () => {
    render(<GrupoBModulo visitaId={await seed(null)} />);
    const fila = await fila24();
    expect(fila.textContent).toMatch(/desv \d+,\d%/);
    expect(fila.textContent).toContain("NC");
  });

  it("consola sin tiempo: desviación 'N/A' y el badge lo decide el CV (OK)", async () => {
    render(<GrupoBModulo visitaId={await seed(["kv", "mas"])} />);
    const fila = await fila24();
    expect(fila.textContent).toContain("desv N/A");
    expect(fila.textContent).toMatch(/CV \d+,\d%/);
    expect(fila.textContent).toContain("OK");
    expect(fila.textContent).not.toContain("NC");
    expect(
      screen.getByText(/Exactitud no aplica: el sistema no muestra tiempo nominal/)
    ).toBeInTheDocument();
  });
});
