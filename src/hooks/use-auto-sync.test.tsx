// #21 — useAutoSync debe debouncear el reconnect: un parpadeo de red
// (online→offline→online rápido) no debe disparar un ciclo de sync.
// Ver docs/modules/04-sync.md.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

const pushAllPending = vi.fn().mockResolvedValue({ pushed: 0, errors: 0 });
const pullAllPending = vi.fn().mockResolvedValue({ pulled: 0, errors: 0 });
let online = true;

vi.mock("@/lib/supabase/sync-engine", () => ({
  pushAllPending: () => pushAllPending(),
  pullAllPending: () => pullAllPending(),
}));
vi.mock("./use-online-status", () => ({ useOnlineStatus: () => online }));

import { useAutoSync } from "./use-auto-sync";

function Harness() {
  useAutoSync();
  return null;
}

describe("useAutoSync — debounce del reconnect (#21)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushAllPending.mockClear();
    pullAllPending.mockClear();
    online = true;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("no sincroniza dentro de los primeros 3s tras montar online", () => {
    render(<Harness />);
    vi.advanceTimersByTime(2000);
    expect(pushAllPending).not.toHaveBeenCalled();
  });

  it("sincroniza una vez pasado el debounce", async () => {
    render(<Harness />);
    await vi.advanceTimersByTimeAsync(3500);
    expect(pushAllPending).toHaveBeenCalledTimes(1);
    expect(pullAllPending).toHaveBeenCalledTimes(1);
  });

  it("un parpadeo online→offline→online antes del debounce NO dispara sync", async () => {
    const { rerender } = render(<Harness />);
    vi.advanceTimersByTime(1000);

    online = false;
    rerender(<Harness />);
    vi.advanceTimersByTime(500);

    online = true;
    rerender(<Harness />);
    // Solo pasaron 1.5s del segundo "online" — todavía dentro del debounce.
    await vi.advanceTimersByTimeAsync(2000);
    expect(pushAllPending).not.toHaveBeenCalled();

    // Ahora sí, completado el debounce del último reconnect.
    await vi.advanceTimersByTimeAsync(1500);
    expect(pushAllPending).toHaveBeenCalledTimes(1);
  });

  it("offline limpia el timer: no sincroniza aunque pase el tiempo", async () => {
    online = false;
    render(<Harness />);
    await vi.advanceTimersByTimeAsync(10000);
    expect(pushAllPending).not.toHaveBeenCalled();
  });
});
