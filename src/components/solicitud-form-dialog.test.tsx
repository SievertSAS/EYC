import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import type { Cliente, Solicitud } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";

// ============================================================
//  SolicitudFormDialog
//
//  Bug en modo creación: `handleOpenChange` solo llamaba `resetForm()`
//  cuando Radix dispara `onOpenChange` internamente (Esc/overlay/botón)
//  — nunca cuando el padre abre el modal seteando `open=true` desde
//  afuera (mismo mecanismo que en los otros 5 diálogos de esta sesión).
//  El modo edición sí tenía un `useEffect` correcto en [open,
//  editSolicitud]; el modo creación no tenía ningún equivalente.
//
//  Escenario reproducido acá sin depender de clicks reales sobre el
//  Select (inestables en jsdom/happy-dom): el usuario edita una
//  solicitud (el cliente queda precargado vía props), cierra, y abre
//  "Nueva Solicitud" — el cliente de la solicitud editada no debe
//  arrastrarse al formulario en blanco.
// ============================================================

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
}));
vi.mock("@/components/db-provider", () => ({
  useDb: () => ({ isReady: true }),
}));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({ role: { usuarioId: "user-1" } }),
}));

import { SolicitudFormDialog } from "./solicitud-form-dialog";

async function seedCliente(nombre: string): Promise<Cliente> {
  const cliente: Cliente = { id: randomUUID(), nombre_cliente: nombre, nit: "800000000" };
  await db.clientes.add(cliente);
  return cliente;
}

describe("SolicitudFormDialog — modo creación", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("no arrastra el cliente de una edición previa al abrir 'Nueva Solicitud' después", async () => {
    const clienteA = await seedCliente("Cliente A");
    const editSolicitud: Solicitud = {
      id: randomUUID(),
      cliente_id: clienteA.id!,
      pago_recibido: false,
    };

    const { rerender } = render(<SolicitudFormDialog open={false} onOpenChange={vi.fn()} />);

    // Se abre en modo edición sobre una solicitud existente — el cliente
    // se precarga desde `editSolicitud` (esto ya funcionaba antes del fix).
    rerender(
      <SolicitudFormDialog open={true} onOpenChange={vi.fn()} editSolicitud={editSolicitud} />
    );
    await waitFor(() => expect(screen.getByText("Cliente A")).toBeTruthy());

    // Se cierra la edición y se abre "Nueva Solicitud" (sin editSolicitud)
    // sobre la MISMA instancia del componente — sin remount.
    rerender(<SolicitudFormDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<SolicitudFormDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText("Cliente A")).toBeNull();
      expect(screen.getByText(/seleccionar cliente/i)).toBeTruthy();
    });
  });
});
