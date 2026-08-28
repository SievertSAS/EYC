import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/lib/db";
import type { Equipo, Tubo, Colimador, Gantry } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  EquipoFormDialog
//
//  Dos bugs corregidos:
//  1. Misma regresión que UbicacionFormDialog: el modal no repoblaba
//     sus campos al reabrir la misma instancia (handleOpenChange nunca
//     se disparaba al abrir desde el padre).
//  2. Tubo/colimador/gantry no se cargaban al editar un equipo existente
//     y `handleSave` siempre hacía `.add()` — reeditar un equipo
//     duplicaba su tubo/colimador/gantry en vez de actualizarlos.
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));

import { EquipoFormDialog } from "./equipo-form-dialog";

async function seedEquipo(overrides: Partial<Equipo> = {}): Promise<Equipo> {
  const equipo: Equipo = {
    id: randomUUID(),
    ubicacion_id: "ubicacion-1",
    planilla_espacial: false,
    marca: "Siemens",
    ...overrides,
  };
  await db.equipos.add(equipo);
  return equipo;
}

describe("EquipoFormDialog", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("repuebla la marca del equipo al reabrir la misma instancia con datos actualizados", async () => {
    const equipoV1 = await seedEquipo({ marca: "Siemens" });

    const { rerender } = render(
      <EquipoFormDialog
        open={false}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipoV1}
      />
    );

    rerender(
      <EquipoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipoV1}
      />
    );
    await waitFor(() => expect(screen.getByDisplayValue("Siemens")).toBeTruthy());

    const equipoV2: Equipo = { ...equipoV1, marca: "GE Healthcare" };
    rerender(
      <EquipoFormDialog
        open={false}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipoV2}
      />
    );
    rerender(
      <EquipoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipoV2}
      />
    );

    await waitFor(() => expect(screen.getByDisplayValue("GE Healthcare")).toBeTruthy());
    expect(screen.queryByDisplayValue("Siemens")).toBeNull();
  });

  it("actualiza el tubo/colimador/gantry existentes al reeditar el equipo, sin duplicarlos", async () => {
    const equipo = await seedEquipo({ marca: "Siemens" });
    const tubo: Tubo = {
      id: randomUUID(),
      equipo_id: equipo.id!,
      marca: "Varian",
      modelo: "A-100",
    };
    const colimador: Colimador = {
      id: randomUUID(),
      equipo_id: equipo.id!,
      marca: "Collimator Co",
    };
    const gantry: Gantry = {
      id: randomUUID(),
      equipo_id: equipo.id!,
      marca: "GantryCo",
    };
    await db.tubos.add(tubo);
    await db.colimadores.add(colimador);
    await db.gantry.add(gantry);

    const onSaved = vi.fn();
    render(
      <EquipoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipo}
        onSaved={onSaved}
      />
    );

    // Expandir la sección "Tubo de Rayos X" (colapsada por defecto) y
    // esperar a que la carga async del tubo existente popule el campo.
    fireEvent.click(screen.getByText("Tubo de Rayos X"));
    const tuboModeloInput = await waitFor(() => screen.getByDisplayValue("A-100"));
    fireEvent.change(tuboModeloInput, { target: { value: "A-200" } });

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const tubos = await db.tubos.toArray();
    expect(tubos).toHaveLength(1);
    expect(tubos[0].id).toBe(tubo.id);
    expect(tubos[0].modelo).toBe("A-200");

    const colimadores = await db.colimadores.toArray();
    expect(colimadores).toHaveLength(1);
    expect(colimadores[0].id).toBe(colimador.id);

    const gantries = await db.gantry.toArray();
    expect(gantries).toHaveLength(1);
    expect(gantries[0].id).toBe(gantry.id);
  });

  it("crea el tubo cuando el equipo todavía no tiene uno", async () => {
    const equipo = await seedEquipo({ marca: "Siemens" });
    const onSaved = vi.fn();

    render(
      <EquipoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipo}
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByText("Tubo de Rayos X"));
    const tuboSection = screen.getByText("Tubo de Rayos X").closest("div")!;
    const tuboMarcaInput = await waitFor(() => within(tuboSection).getAllByRole("textbox")[0]);
    fireEvent.change(tuboMarcaInput, { target: { value: "Toshiba" } });

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const tubos = await db.tubos.toArray();
    expect(tubos).toHaveLength(1);
    expect(tubos[0].marca).toBe("Toshiba");
  });
});
