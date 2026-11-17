import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeRole, type RoleContextValue } from "@/test/roles";
import { makeCliente, makeSolicitud } from "@/test/factories";
import { fijarUrl } from "@/test/search-params";

// ============================================================
//  /dashboard/solicitudes — vista Tabla | Kanban + filtros combinables en la URL
// ============================================================

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let role: RoleContextValue = makeRole("coordinador");
vi.mock("@/components/db-provider", () => ({ useDb: () => ({ isReady: true }) }));
vi.mock("@/components/role-provider", () => ({ useRole: () => role }));
vi.mock("next/navigation", async () => {
  const { useSearchParamsDeVentana } = await import("@/test/search-params");
  return { useSearchParams: useSearchParamsDeVentana, useRouter: () => ({ push }) };
});
// El diálogo de creación no participa en estos tests.
vi.mock("@/components/solicitud-form-dialog", () => ({ SolicitudFormDialog: () => null }));

import SolicitudesPage from "./page";

async function sembrar() {
  const norte = makeCliente({ nombre_cliente: "Clínica Norte" });
  const sur = makeCliente({ nombre_cliente: "Hospital Sur" });
  await db.clientes.bulkAdd([norte, sur]);
  const s1 = makeSolicitud(norte.id!, {
    numero_solicitud: "SOL-2026-001",
    pipeline_estado: "solicitudes",
    pago_recibido: true,
    tipo_servicio: "control_calidad",
  });
  const s2 = makeSolicitud(sur.id!, {
    numero_solicitud: "SOL-2026-002",
    pipeline_estado: "programacion",
    pago_recibido: false,
    tipo_servicio: "control_calidad",
  });
  const s3 = makeSolicitud(sur.id!, {
    numero_solicitud: "SOL-2026-003",
    pipeline_estado: "programacion",
    pago_recibido: true,
    tipo_servicio: "levantamiento",
  });
  const s4 = makeSolicitud(norte.id!, {
    numero_solicitud: "SOL-2026-004",
    pipeline_estado: "cancelada",
  });
  await db.solicitudes.bulkAdd([s1, s2, s3, s4]);
  return { norte, sur, s1, s2, s3, s4 };
}

beforeEach(async () => {
  await resetTestDb();
  role = makeRole("coordinador");
  push.mockReset();
  fijarUrl("/dashboard/solicitudes");
});

describe("SolicitudesPage — vistas y filtros", () => {
  it("Kanban: columnas del pipeline con conteo; canceladas solo con la opción activa", async () => {
    await sembrar();
    render(<SolicitudesPage />);
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("radio", { name: "Kanban" }));
    expect(await screen.findByRole("region", { name: "Por programar (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Programación (2)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Enviado (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Cancelada/ })).toBeNull();
    expect(screen.queryByRole("tablist", { name: /Filtro de solicitudes/ })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /Mostrar canceladas/ }));
    expect(await screen.findByRole("region", { name: "Cancelada (1)" })).toBeInTheDocument();
    expect(window.location.search).toBe("?vista=kanban&canceladas=1");
  });

  it("dos filtros desde la URL acotan la tabla y el kanban", async () => {
    const { sur } = await sembrar();
    fijarUrl(`/dashboard/solicitudes?cliente=${sur.id}&pago=si`);
    render(<SolicitudesPage />);
    const t = await screen.findByRole("table");
    expect(within(t).getByText("SOL-2026-003")).toBeInTheDocument();
    expect(within(t).queryByText("SOL-2026-002")).toBeNull();
    expect(within(t).queryByText("SOL-2026-001")).toBeNull();
    expect(screen.getByText("Pago: Sí")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Kanban" }));
    expect(await screen.findByRole("region", { name: "Programación (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Por programar (0)" })).toBeInTheDocument();
  });

  it("'Limpiar filtros' quita los filtros pero conserva la vista", async () => {
    const { sur } = await sembrar();
    fijarUrl(`/dashboard/solicitudes?vista=kanban&cliente=${sur.id}`);
    render(<SolicitudesPage />);
    expect(await screen.findByRole("region", { name: "Por programar (0)" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Limpiar filtros" })[0]);
    expect(await screen.findByRole("region", { name: "Por programar (1)" })).toBeInTheDocument();
    expect(window.location.search).toBe("?vista=kanban");
  });

  it("clic en una tarjeta navega al detalle como la fila", async () => {
    const { s2 } = await sembrar();
    fijarUrl("/dashboard/solicitudes?vista=kanban");
    render(<SolicitudesPage />);
    fireEvent.click(await screen.findByRole("link", { name: /Abrir solicitud SOL-2026-002/ }));
    expect(push).toHaveBeenCalledWith(`/dashboard/solicitudes/${s2.id}`);
  });
});
