import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import type { UbicacionRx } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  UbicacionFormDialog
//
//  Regresión: el diálogo reusaba la misma instancia (React no la
//  desmonta salvo que cambie `key`) y solo repoblaba sus campos en
//  handleOpenChange, que Radix dispara únicamente en cierres internos
//  (Esc, overlay, botón) — nunca cuando el padre abre el modal seteando
//  `open=true` desde afuera. Resultado: reabrir "Editar" mostraba el
//  nombre con el que se abrió la primera vez, ignorando cambios
//  posteriores (ej: editados vía el módulo de precarga de la visita).
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));

import { UbicacionFormDialog } from "./ubicacion-form-dialog";

async function seedUbicacion(overrides: Partial<UbicacionRx> = {}): Promise<UbicacionRx> {
  const ubicacion: UbicacionRx = {
    id: randomUUID(),
    sede_id: "sede-1",
    nombre_servicio: "rayos x",
    ...overrides,
  };
  await db.ubicaciones_rx.add(ubicacion);
  return ubicacion;
}

describe("UbicacionFormDialog", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("repuebla el nombre del servicio al reabrir la misma instancia con datos actualizados", async () => {
    const ubicacionV1 = await seedUbicacion({ nombre_servicio: "rayos x" });

    const { rerender } = render(
      <UbicacionFormDialog
        open={false}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={ubicacionV1}
      />
    );

    // Primera apertura: muestra el nombre original.
    rerender(
      <UbicacionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={ubicacionV1}
      />
    );
    expect(screen.getByDisplayValue("rayos x")).toBeTruthy();

    // El nombre cambia por otra vía (ej: campo editable del módulo de
    // precarga) mientras el diálogo está cerrado — misma instancia, sin
    // remount porque el `id` no cambió.
    const ubicacionV2: UbicacionRx = { ...ubicacionV1, nombre_servicio: "radiologia" };
    rerender(
      <UbicacionFormDialog
        open={false}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={ubicacionV2}
      />
    );

    // Reabrir debe mostrar el valor actualizado, no el viejo "rayos x".
    rerender(
      <UbicacionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={ubicacionV2}
      />
    );

    expect(screen.getByDisplayValue("radiologia")).toBeTruthy();
    expect(screen.queryByDisplayValue("rayos x")).toBeNull();
  });

  it("guarda cambios sobre la ubicación existente en vez de crear una nueva", async () => {
    const ubicacion = await seedUbicacion({ nombre_servicio: "rayos x" });
    const onSaved = vi.fn();

    render(
      <UbicacionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={ubicacion}
        onSaved={onSaved}
      />
    );

    const input = screen.getByDisplayValue("rayos x");
    fireEvent.change(input, { target: { value: "radiologia" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ubicacion.id));
    const todas = await db.ubicaciones_rx.toArray();
    expect(todas).toHaveLength(1);
    expect(todas[0].nombre_servicio).toBe("radiologia");
  });

  it("no permite guardar sin nombre de servicio", async () => {
    render(
      <UbicacionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        sedeId="sede-1"
        ubicacion={undefined}
      />
    );

    const boton = screen.getByRole("button", {
      name: /agregar ubicación/i,
    }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
