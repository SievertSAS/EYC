import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ============================================================
//  /dashboard/sync — botón "Resetear datos locales" (#36)
//
//  Cualquiera puede borrar el IndexedDB de su dispositivo desde acá, con un
//  modal que advierte el riesgo. NO toca el servidor (usa resetAndReopen).
// ============================================================

const resetAndReopen = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/recovery", () => ({ resetAndReopen: () => resetAndReopen() }));

const state = { online: true, authenticated: true, pendingCount: 0, errorCount: 0 };
vi.mock("@/lib/supabase/sync-engine", () => ({
  fullSync: vi.fn().mockResolvedValue({ pushed: 0, pulled: 0, errors: [], timestamp: Date.now() }),
  checkSyncStatus: vi.fn(async () => ({ ...state })),
  getErrorRecords: vi.fn().mockResolvedValue([]),
  getPendingRecords: vi.fn().mockResolvedValue([]),
  retryErrorRecords: vi.fn().mockResolvedValue(undefined),
  retryRecord: vi.fn().mockResolvedValue(undefined),
}));

import SyncPage from "./page";

const reload = vi.fn();

beforeEach(() => {
  resetAndReopen.mockClear();
  reload.mockClear();
  state.online = true;
  state.pendingCount = 0;
  state.errorCount = 0;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});
afterEach(() => cleanup());

describe("SyncPage — resetear datos locales", () => {
  it("el modal exige tildar el aviso antes de borrar, y llama resetAndReopen", async () => {
    render(<SyncPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Resetear$/i }));

    const confirmar = await screen.findByRole("button", { name: /Borrar y recargar/i });
    expect(confirmar).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmar).toBeEnabled();

    fireEvent.click(confirmar);
    await waitFor(() => expect(resetAndReopen).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("avisa que se pierden los registros sin subir cuando hay pendientes/errores", async () => {
    state.pendingCount = 3;
    state.errorCount = 1;
    render(<SyncPage />);
    await screen.findByRole("button", { name: /Resetear$/i });
    fireEvent.click(screen.getByRole("button", { name: /Resetear$/i }));

    expect(await screen.findByText(/Se van a perder/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pendientes y 1 con error/i)).toBeInTheDocument();
  });
});
