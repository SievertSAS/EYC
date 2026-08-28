import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import type { Contacto } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  ContactoFormDialog
//
//  Misma regresión que UbicacionFormDialog: el reset del form vivía en
//  handleOpenChange, que Radix nunca dispara cuando el padre abre el
//  modal seteando `open=true` desde afuera.
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));

import { ContactoFormDialog } from "./contacto-form-dialog";

async function seedContacto(overrides: Partial<Contacto> = {}): Promise<Contacto> {
  const contacto: Contacto = {
    id: randomUUID(),
    cliente_id: "cliente-1",
    nombre: "Juan Pérez",
    para_programar: false,
    ...overrides,
  };
  await db.contactos.add(contacto);
  return contacto;
}

describe("ContactoFormDialog", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("repuebla el nombre del contacto al reabrir la misma instancia con datos actualizados", async () => {
    const contactoV1 = await seedContacto({ nombre: "Juan Pérez" });

    const { rerender } = render(
      <ContactoFormDialog
        open={false}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={contactoV1}
      />
    );

    rerender(
      <ContactoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={contactoV1}
      />
    );
    expect(screen.getByDisplayValue("Juan Pérez")).toBeTruthy();

    const contactoV2: Contacto = { ...contactoV1, nombre: "Juan Carlos Pérez" };
    rerender(
      <ContactoFormDialog
        open={false}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={contactoV2}
      />
    );
    rerender(
      <ContactoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={contactoV2}
      />
    );

    expect(screen.getByDisplayValue("Juan Carlos Pérez")).toBeTruthy();
    expect(screen.queryByDisplayValue("Juan Pérez")).toBeNull();
  });

  it("guarda cambios sobre el contacto existente en vez de crear uno nuevo", async () => {
    const contacto = await seedContacto({ nombre: "Juan Pérez" });
    const onSaved = vi.fn();

    render(
      <ContactoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={contacto}
        onSaved={onSaved}
      />
    );

    const input = screen.getByDisplayValue("Juan Pérez");
    fireEvent.change(input, { target: { value: "Juan Carlos Pérez" } });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(contacto.id));
    const todos = await db.contactos.toArray();
    expect(todos).toHaveLength(1);
    expect(todos[0].nombre).toBe("Juan Carlos Pérez");
  });

  it("no permite guardar sin nombre de contacto", () => {
    render(
      <ContactoFormDialog
        open={true}
        onOpenChange={vi.fn()}
        clienteId="cliente-1"
        contacto={undefined}
      />
    );

    const boton = screen.getByRole("button", { name: /^agregar$/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
