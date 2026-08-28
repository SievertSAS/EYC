// Escenarios db-S23 / db-S24: ante un UpgradeError al iniciar, DbProvider
// muestra la pantalla "Borrar datos locales y recargar" (no el mensaje crudo),
// y el botón dispara resetAndReopen() + reload().

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const open = vi.fn();
const resetAndReopen = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({ db: { open: () => open(), backendDB: () => null } }));
vi.mock("@/lib/db/seed", () => ({ seedPruebaDefiniciones: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/hooks/use-auto-sync", () => ({ useAutoSync: vi.fn() }));
vi.mock("@/lib/db/recovery", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/db/recovery")>();
  return { ...actual, resetAndReopen: () => resetAndReopen() };
});

import { DbProvider } from "./db-provider";

function upgradeError() {
  const e = new Error("Not yet support for changing primary key");
  e.name = "UpgradeError";
  return e;
}

describe("DbProvider — recuperación ante migración imposible", () => {
  beforeEach(() => {
    open.mockReset();
    resetAndReopen.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("db-S23: UpgradeError → pantalla de reset, no mensaje crudo", async () => {
    open.mockRejectedValue(upgradeError());

    render(
      <DbProvider>
        <div>contenido app</div>
      </DbProvider>
    );

    expect(await screen.findByText(/Hay que actualizar los datos locales/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Borrar datos locales y recargar/i })
    ).toBeInTheDocument();
    // No debe mostrar el string crudo de Dexie
    expect(screen.queryByText(/changing primary key/i)).not.toBeInTheDocument();
    // Y no renderiza los children
    expect(screen.queryByText("contenido app")).not.toBeInTheDocument();
  });

  it("db-S24: el botón dispara resetAndReopen()", async () => {
    open.mockRejectedValue(upgradeError());
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <DbProvider>
        <div>x</div>
      </DbProvider>
    );

    const btn = await screen.findByRole("button", { name: /Borrar datos locales y recargar/i });
    await userEvent.click(btn);

    await waitFor(() => expect(resetAndReopen).toHaveBeenCalledOnce());
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("un error ajeno (no UpgradeError) NO muestra la pantalla de reset", async () => {
    open.mockRejectedValue(new Error("QuotaExceededError"));

    render(
      <DbProvider>
        <div>y</div>
      </DbProvider>
    );

    // Cae al comportamiento previo: no hay pantalla de reset. Los children
    // se renderizan (isReady queda false pero el provider no bloquea salvo
    // needsReload/needsReset).
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(screen.queryByText(/Borrar datos locales y recargar/i)).not.toBeInTheDocument();
  });
});
