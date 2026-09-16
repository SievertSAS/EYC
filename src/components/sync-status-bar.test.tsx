import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// ============================================================
//  SyncStatusBar — franja fija de estado de sincronización
//
//  Reemplaza a ConnectionBadge (chips condicionales dentro del <main>)
//  por una franja fija de ancho completo con confianza visual real de
//  que el sync está funcionando. Se mockean los tres hooks de los que
//  depende (useOnlineStatus, useDb, useSyncCounters) siguiendo el mismo
//  patrón de mocking que use-sync-counters.test.tsx usa para Dexie.
// ============================================================

const useOnlineStatus = vi.fn();
const useDb = vi.fn();
const useSyncCounters = vi.fn();

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => useOnlineStatus(),
}));
vi.mock("@/components/db-provider", () => ({
  useDb: () => useDb(),
}));
vi.mock("@/hooks/use-sync-counters", () => ({
  useSyncCounters: () => useSyncCounters(),
}));

import { SyncStatusBar } from "./sync-status-bar";

const LAST_SYNC_KEY = "ultima-sync-exitosa";

function mockState({
  isOnline,
  isReady = true,
  error = null,
  pendingCount,
  errorCount,
}: {
  isOnline: boolean;
  isReady?: boolean;
  error?: string | null;
  pendingCount: number;
  errorCount: number;
}) {
  useOnlineStatus.mockReturnValue(isOnline);
  useDb.mockReturnValue({ isReady, error });
  useSyncCounters.mockReturnValue({ pendingCount, errorCount });
}

describe("SyncStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("estado offline con pendientes muestra el conteo", () => {
    mockState({ isOnline: false, pendingCount: 3, errorCount: 0 });

    render(<SyncStatusBar />);

    expect(screen.getByText(/sin conexión/i)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
  });

  it("estado offline sin pendientes no menciona cambios", () => {
    mockState({ isOnline: false, pendingCount: 0, errorCount: 0 });

    render(<SyncStatusBar />);

    const status = screen.getByRole("status", { name: "" }) ?? screen.getByText(/sin conexión/i);
    expect(status.textContent?.toLowerCase()).toContain("sin conexión");
    expect(status.textContent).not.toMatch(/cambio/i);
  });

  it("no muestra nada solo por cambios pendientes, sin importar cuántos (online, sin errores)", () => {
    mockState({ isOnline: true, pendingCount: 5, errorCount: 0 });
    const { container, rerender } = render(<SyncStatusBar />);

    expect(container.firstChild).toBeNull();

    mockState({ isOnline: true, pendingCount: 40, errorCount: 0 });
    rerender(<SyncStatusBar />);

    expect(container.firstChild).toBeNull();
  });

  it("no muestra nada en el camino feliz (online, 0 pendientes, sin errores)", () => {
    mockState({ isOnline: true, pendingCount: 0, errorCount: 0 });

    const { container } = render(<SyncStatusBar />);

    expect(container.firstChild).toBeNull();
  });

  it("no muestra nada con un solo pendiente online — evita el parpadeo por cada guardado", () => {
    mockState({ isOnline: true, pendingCount: 1, errorCount: 0 });

    const { container } = render(<SyncStatusBar />);

    expect(container.firstChild).toBeNull();
  });

  it("se muestra si hay errores aunque no haya pendientes", () => {
    mockState({ isOnline: true, pendingCount: 0, errorCount: 1 });

    render(<SyncStatusBar />);

    expect(screen.getByText(/1 con error/i)).toBeTruthy();
  });

  it("se muestra igual si hay un solo pendiente pero también hay errores", () => {
    mockState({ isOnline: true, pendingCount: 1, errorCount: 1 });

    render(<SyncStatusBar />);

    expect(screen.getByText(/1 con error/i)).toBeTruthy();
  });

  it("el chip de error aparece en paralelo al estado sincronizado (base) cuando errorCount > 0", () => {
    mockState({ isOnline: true, pendingCount: 4, errorCount: 2 });

    render(<SyncStatusBar />);

    expect(screen.getByText(/sincronizado/i)).toBeTruthy();
    expect(screen.getByText(/2 con error/i)).toBeTruthy();
  });

  it("el error de DB se prioriza incluso sobre el estado sincronizado", () => {
    mockState({
      isOnline: true,
      isReady: true,
      error: "boom",
      pendingCount: 0,
      errorCount: 0,
    });

    render(<SyncStatusBar />);

    expect(screen.queryByText(/sincronizado/i)).toBeNull();
    expect(screen.getByText(/error db/i)).toBeTruthy();
  });

  it("es 'fixed' (superpuesta), no 'sticky' — no debe reservar espacio en el flujo del documento", () => {
    mockState({ isOnline: false, pendingCount: 0, errorCount: 0 });

    const { container } = render(<SyncStatusBar />);

    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain("fixed");
    expect(bar.className).not.toContain("sticky");
  });

  it("persiste el timestamp de última sync exitosa en localStorage al llegar a sincronizado", async () => {
    expect(localStorage.getItem(LAST_SYNC_KEY)).toBeNull();

    mockState({ isOnline: true, pendingCount: 1, errorCount: 0 });
    const { rerender } = render(<SyncStatusBar />);

    mockState({ isOnline: true, pendingCount: 0, errorCount: 0 });
    rerender(<SyncStatusBar />);

    await waitFor(() => {
      expect(localStorage.getItem(LAST_SYNC_KEY)).not.toBeNull();
    });
  });
});
