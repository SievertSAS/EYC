import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import type { Sede } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  SedeFormDialog
//
//  Misma regresión que UbicacionFormDialog: el reset del form vivía en
//  handleOpenChange, que Radix nunca dispara cuando el padre abre el
//  modal seteando `open=true` desde afuera.
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));

import { SedeFormDialog } from "./sede-form-dialog";

async function seedSede(overrides: Partial<Sede> = {}): Promise<Sede> {
  const sede: Sede = {
    id: randomUUID(),
    cliente_id: "cliente-1",
    nombre_sede: "Sede Principal",
    ...overrides,
  };
  await db.sedes.add(sede);
  return sede;
}

describe("SedeFormDialog", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("repuebla el nombre de la sede al reabrir la misma instancia con datos actualizados", async () => {
    const sedeV1 = await seedSede({ nombre_sede: "Sede Principal" });

    const { rerender } = render(
      <SedeFormDialog open={false} onOpenChange={vi.fn()} clienteId="cliente-1" sede={sedeV1} />
    );

    rerender(
      <SedeFormDialog open={true} onOpenChange={vi.fn()} clienteId="cliente-1" sede={sedeV1} />
    );
    expect(screen.getByDisplayValue("Sede Principal")).toBeTruthy();

    const sedeV2: Sede = { ...sedeV1, nombre_sede: "Sede Laureles" };
    rerender(
      <SedeFormDialog open={false} onOpenChange={vi.fn()} clienteId="cliente-1" sede={sedeV2} />
    );
    rerender(
      <SedeFormDialog open={true} onOpenChange={vi.fn()} clienteId="cliente-1" sede={sedeV2} />
    );

    expect(screen.getByDisplayValue("Sede Laureles")).toBeTruthy();
    expect(screen.queryByDisplayValue("Sede Principal")).toBeNull();
  });

  it("guarda cambios sobre la sede existente en vez de crear una nueva", async () => {
    const sede = await seedSede({ nombre_sede: "Sede Principal" });
    const onSaved = vi.fn();

    render(
      <SedeFormDialog
        open={true}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        sede={sede}
        onSaved={onSaved}
      />
    );

    const input = screen.getByDisplayValue("Sede Principal");
    fireEvent.change(input, { target: { value: "Sede Laureles" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(sede.id));
    const todas = await db.sedes.toArray();
    expect(todas).toHaveLength(1);
    expect(todas[0].nombre_sede).toBe("Sede Laureles");
  });

  it("no permite guardar sin nombre de sede", () => {
    render(
      <SedeFormDialog open={true} onOpenChange={vi.fn()} clienteId="cliente-1" sede={undefined} />
    );

    const boton = screen.getByRole("button", { name: /agregar sede/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
