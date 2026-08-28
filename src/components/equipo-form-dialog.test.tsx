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

  it("#10: soft-borra el tubo cuando el usuario limpia todos sus campos", async () => {
    const equipo = await seedEquipo({ marca: "Siemens" });
    const tubo: Tubo = {
      id: randomUUID(),
      equipo_id: equipo.id!,
      marca: "Varian",
      modelo: "A-100",
      numero_serie: "SN-1",
    };
    await db.tubos.add(tubo);

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
    const marcaInput = await waitFor(() => screen.getByDisplayValue("Varian"));
    fireEvent.change(marcaInput, { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("A-100"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("SN-1"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const row = await db.tubos.get(tubo.id);
    expect(row).toBeTruthy();
    expect(row!.deleted_at).toBeTruthy();
    expect(row!.sync_status).toBe("pending");
  });

  it("#10: si falla un write hijo, el update del equipo también se revierte", async () => {
    const equipo = await seedEquipo({ marca: "Siemens", modelo: "OLD" });
    const addSpy = vi.spyOn(db.gantry, "add").mockRejectedValueOnce(new Error("boom"));

    render(
      <EquipoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        ubicacionId="ubicacion-1"
        equipo={equipo}
        onSaved={vi.fn()}
      />
    );

    const modeloInput = await waitFor(() => screen.getByDisplayValue("OLD"));
    fireEvent.change(modeloInput, { target: { value: "NEW" } });

    fireEvent.click(screen.getByText("Gantry (CT)"));
    const gantrySection = screen.getByText("Gantry (CT)").closest("div")!;
    fireEvent.change(within(gantrySection).getAllByRole("textbox")[0], {
      target: { value: "GantryX" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(addSpy).toHaveBeenCalled());
    await waitFor(async () => {
      const fresh = await db.equipos.get(equipo.id!);
      expect(fresh!.modelo).toBe("OLD");
    });
    expect(await db.gantry.where("equipo_id").equals(equipo.id!).count()).toBe(0);
    addSpy.mockRestore();
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
