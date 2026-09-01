import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

// ============================================================
//  Condiciones Ambientales — Departamento / Ciudad
//
//  Antes eran dos campos de texto libre (sede.departamento / sede.ciudad).
//  Ahora traen lo que la sede ya tenga y ofrecen la lista del catálogo
//  DIVIPOLA. Sin catálogo sincronizado, caen al texto libre de siempre.
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

import { InfoModulo } from "./info-modulo";

describe("InfoModulo — Condiciones Ambientales: Departamento / Ciudad", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("sin catálogo sincronizado usa el texto libre de la sede", async () => {
    const { visita } = await seedGraph(); // sede: departamento "Cundinamarca", ciudad "Bogotá"
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    expect(screen.getByText("Departamento")).toBeInTheDocument();
    expect(screen.getByText("Ciudad")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cundinamarca")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bogotá")).toBeInTheDocument();
  });

  it("con catálogo sincronizado precarga el departamento/ciudad de la sede por nombre", async () => {
    const { visita } = await seedGraph();
    await db.departamentos.bulkAdd([
      { id: 25, codigo_dane: "25", nombre: "Cundinamarca" },
      { id: 5, codigo_dane: "05", nombre: "Antioquia" },
    ]);
    await db.municipios.bulkAdd([
      { id: 25001, departamento_id: 25, codigo_dane: "25001", nombre: "Bogotá" },
      { id: 5001, departamento_id: 5, codigo_dane: "05001", nombre: "Medellín" },
    ]);

    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    // El valor seleccionado del combobox se muestra como texto, no como <input>.
    expect(await screen.findByText("Cundinamarca")).toBeInTheDocument();
    expect(await screen.findByText("Bogotá")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Cundinamarca")).not.toBeInTheDocument();
  });

  it("con catálogo sincronizado precarga por *_id aunque el nombre plano difiera", async () => {
    const { sede, visita } = await seedGraph();
    await db.sedes.update(sede.id!, {
      departamento_id: 5,
      municipio_id: 5001,
      departamento: "texto viejo",
      ciudad: "otra cosa",
    });
    await db.departamentos.bulkAdd([{ id: 5, codigo_dane: "05", nombre: "Antioquia" }]);
    await db.municipios.bulkAdd([
      { id: 5001, departamento_id: 5, codigo_dane: "05001", nombre: "Medellín" },
    ]);

    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    expect(await screen.findByText("Antioquia")).toBeInTheDocument();
    expect(await screen.findByText("Medellín")).toBeInTheDocument();
  });
});
