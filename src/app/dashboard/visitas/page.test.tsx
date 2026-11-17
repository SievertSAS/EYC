import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeRole, type RoleContextValue } from "@/test/roles";
import { seedGraph } from "@/test/seed";
import { fijarUrl } from "@/test/search-params";

// ============================================================
//  /dashboard/visitas — vista Tabla | Kanban + filtros combinables en la URL
// ============================================================

const { irAVisita } = vi.hoisted(() => ({ irAVisita: vi.fn() }));
let role: RoleContextValue = makeRole("coordinador");
vi.mock("@/components/db-provider", () => ({ useDb: () => ({ isReady: true }) }));
vi.mock("@/components/role-provider", () => ({ useRole: () => role }));
vi.mock("@/lib/visita-nav", () => ({ irAVisita }));
vi.mock("next/navigation", async () => {
  const { useSearchParamsDeVentana } = await import("@/test/search-params");
  return { useSearchParams: useSearchParamsDeVentana };
});

import VisitasPage from "./page";

async function sembrar() {
  await db.usuarios.bulkAdd([
    { id: "tec-1", nombre: "Ana Pérez", cedula: "1", cargo: "tecnico", activo: true },
    { id: "tec-2", nombre: "Luis Gómez", cedula: "2", cargo: "tecnico", activo: true },
  ]);
  const norte = await seedGraph({ estadoVisita: "asignada" });
  await db.clientes.update(norte.cliente.id!, { nombre_cliente: "Clínica Norte" });
  await db.visitas.update(norte.visita!.id!, { tecnico_id: "tec-1", fecha_visita: "2026-03-01" });

  const sur = await seedGraph({ estadoVisita: "en_progreso", tipoEquipo: "CT" });
  await db.clientes.update(sur.cliente.id!, { nombre_cliente: "Hospital Sur" });
  await db.sedes.update(sur.sede.id!, { ciudad: "Medellín" });
  await db.visitas.update(sur.visita!.id!, { tecnico_id: "tec-2", fecha_visita: "2026-03-10" });

  const sur2 = await seedGraph({ estadoVisita: "aprobada", tipoEquipo: "CT" });
  await db.clientes.update(sur2.cliente.id!, { nombre_cliente: "Hospital Sur Dos" });
  await db.visitas.update(sur2.visita!.id!, { tecnico_id: "tec-1" });

  return { norte, sur, sur2 };
}

function tabla() {
  return screen.getByRole("table");
}

beforeEach(async () => {
  await resetTestDb();
  role = makeRole("coordinador");
  irAVisita.mockReset();
  fijarUrl("/dashboard/visitas");
});

describe("VisitasPage — vistas y filtros", () => {
  it("el toggle pasa a Kanban: columnas por estado con conteo, sin pestañas de estado", async () => {
    await sembrar();
    render(<VisitasPage />);
    await screen.findByRole("table");
    expect(screen.getByRole("tablist", { name: /Filtro de visitas/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Kanban" }));

    expect(await screen.findByRole("region", { name: "Asignada (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "En Progreso (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "En Revisión (0)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Aprobada (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("tablist", { name: /Filtro de visitas/ })).toBeNull();
    expect(window.location.search).toBe("?vista=kanban");
  });

  it("dos filtros desde la URL acotan la tabla y el kanban (AND)", async () => {
    await sembrar();
    fijarUrl("/dashboard/visitas?tipo=CT&tecnico=tec-1");
    render(<VisitasPage />);
    const t = await screen.findByRole("table");
    expect(within(t).getByText("Hospital Sur Dos")).toBeInTheDocument();
    expect(within(t).queryByText("Hospital Sur")).toBeNull();
    expect(within(t).queryByText("Clínica Norte")).toBeNull();
    expect(screen.getByText("Tipo de equipo: CT (Tomógrafo)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Kanban" }));
    expect(await screen.findByRole("region", { name: "Aprobada (1)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Asignada (0)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "En Progreso (0)" })).toBeInTheDocument();
    // Los filtros persisten al cambiar de vista
    expect(window.location.search).toBe("?vista=kanban&tecnico=tec-1&tipo=CT");
  });

  it("quitar un chip amplía los resultados y la búsqueda ignora tildes", async () => {
    await sembrar();
    fijarUrl("/dashboard/visitas?tipo=CT");
    render(<VisitasPage />);
    await screen.findByRole("table");
    expect(within(tabla()).queryByText("Clínica Norte")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Quitar filtro Tipo de equipo/ }));
    expect(await within(tabla()).findByText("Clínica Norte")).toBeInTheDocument();
    expect(window.location.search).toBe("");

    fireEvent.change(screen.getByPlaceholderText(/Buscar por cliente/), {
      target: { value: "clinica" },
    });
    expect(await within(tabla()).findByText("Clínica Norte")).toBeInTheDocument();
    expect(within(tabla()).queryByText("Hospital Sur")).toBeNull();
  });

  it("el técnico no ve el filtro de técnico y solo sus visitas", async () => {
    await sembrar();
    role = makeRole("tecnico", { usuarioId: "tec-2" });
    render(<VisitasPage />);
    const t = await screen.findByRole("table");
    expect(within(t).getByText("Hospital Sur")).toBeInTheDocument();
    expect(within(t).queryByText("Clínica Norte")).toBeNull();
    expect(screen.queryByRole("combobox", { name: /^Técnico/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: /^Cliente/ })).toBeInTheDocument();
  });

  it("clic en una tarjeta del kanban abre la visita con irAVisita", async () => {
    const { sur } = await sembrar();
    fijarUrl("/dashboard/visitas?vista=kanban");
    render(<VisitasPage />);
    const card = await screen.findByRole("link", { name: /Abrir visita: Hospital Sur,/ });
    fireEvent.click(card);
    expect(irAVisita).toHaveBeenCalledWith(sur.visita!.id);
  });
});
