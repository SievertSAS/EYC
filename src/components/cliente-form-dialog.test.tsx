import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import type { Cliente } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  ClienteFormDialog
//
//  Misma regresión que UbicacionFormDialog: el reset del form vivía en
//  handleOpenChange, que Radix nunca dispara cuando el padre abre el
//  modal seteando `open=true` desde afuera.
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));

import { ClienteFormDialog } from "./cliente-form-dialog";

async function seedCliente(overrides: Partial<Cliente> = {}): Promise<Cliente> {
  const cliente: Cliente = {
    id: randomUUID(),
    nombre_cliente: "Virrey Solis IPS",
    nit: "800003765",
    ...overrides,
  };
  await db.clientes.add(cliente);
  return cliente;
}

describe("ClienteFormDialog", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("repuebla el nombre del cliente al reabrir la misma instancia con datos actualizados", async () => {
    const clienteV1 = await seedCliente({ nombre_cliente: "Virrey Solis IPS" });

    const { rerender } = render(
      <ClienteFormDialog open={false} onOpenChange={vi.fn()} cliente={clienteV1} />
    );

    rerender(<ClienteFormDialog open={true} onOpenChange={vi.fn()} cliente={clienteV1} />);
    expect(screen.getByDisplayValue("Virrey Solis IPS")).toBeTruthy();

    const clienteV2: Cliente = { ...clienteV1, nombre_cliente: "Virrey Solis IPS S.A." };
    rerender(<ClienteFormDialog open={false} onOpenChange={vi.fn()} cliente={clienteV2} />);
    rerender(<ClienteFormDialog open={true} onOpenChange={vi.fn()} cliente={clienteV2} />);

    expect(screen.getByDisplayValue("Virrey Solis IPS S.A.")).toBeTruthy();
    expect(screen.queryByDisplayValue("Virrey Solis IPS")).toBeNull();
  });

  it("guarda cambios sobre el cliente existente en vez de crear uno nuevo", async () => {
    const cliente = await seedCliente({ nombre_cliente: "Virrey Solis IPS" });
    const onSaved = vi.fn();

    render(
      <ClienteFormDialog open={true} onOpenChange={vi.fn()} cliente={cliente} onSaved={onSaved} />
    );

    const input = screen.getByDisplayValue("Virrey Solis IPS");
    fireEvent.change(input, { target: { value: "Virrey Solis IPS S.A." } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(cliente.id));
    const todos = await db.clientes.toArray();
    expect(todos).toHaveLength(1);
    expect(todos[0].nombre_cliente).toBe("Virrey Solis IPS S.A.");
  });

  it("no permite guardar sin nombre de cliente", () => {
    render(<ClienteFormDialog open={true} onOpenChange={vi.fn()} cliente={undefined} />);

    const boton = screen.getByRole("button", { name: /crear cliente/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
