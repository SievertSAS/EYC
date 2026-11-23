import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { resetTestDb } from "@/test/db-reset";

let isReady = false;
vi.mock("@/components/db-provider", () => ({ useDb: () => ({ isReady }) }));
vi.mock("@/components/role-provider", () => ({ useRole: () => ({ role: "coordinador" }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import VisitaWorkspacePage from "./page";

beforeEach(async () => {
  await resetTestDb();
  isReady = false;
});

describe("VisitaWorkspacePage — carga", () => {
  it("no muestra 'Visita no encontrada' en el instante en que la DB queda lista", async () => {
    // Promesa ya resuelta y marcada: `use(params)` la lee sin suspender.
    const params = Object.assign(Promise.resolve({ id: "v-1" }), {
      status: "fulfilled",
      value: { id: "v-1" },
    });
    const ui = () => (
      <Suspense fallback={null}>
        <VisitaWorkspacePage params={params} />
      </Suspense>
    );
    const { rerender } = render(ui());
    await act(async () => {});
    expect(await screen.findByText("Cargando visita...")).toBeInTheDocument();

    // DbProvider termina de abrir IndexedDB: el primer render con isReady=true
    // todavía no tiene el resultado de la nueva consulta → debe seguir cargando.
    isReady = true;
    rerender(ui());
    expect(screen.queryByText("Visita no encontrada")).not.toBeInTheDocument();
    expect(screen.getByText("Cargando visita...")).toBeInTheDocument();
  });
});
