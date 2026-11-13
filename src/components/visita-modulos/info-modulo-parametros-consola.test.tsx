import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

// ============================================================
//  #189 (paso 1) — checklist "Parámetros nominales que muestra la consola"
//  en Información General → Colimador y Sistema de Adquisición. Solo
//  CONVENCIONAL; se persiste en `equipos.parametros_consola` y se encola sync.
// ============================================================

const useDb = vi.fn();
vi.mock("@/components/db-provider", () => ({ useDb: () => useDb() }));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({ role: "tecnico", cargo: "tecnico", usuarioId: "u1", nombre: "Tec" }),
}));
const pushSingle = vi.fn();
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: (...args: unknown[]) => pushSingle(...args),
  updateAndSync: vi.fn().mockResolvedValue(undefined),
  deleteAndSync: vi.fn().mockResolvedValue(undefined),
}));

import { InfoModulo } from "./info-modulo";

const GRUPO = "Parámetros nominales que muestra la consola";

describe("InfoModulo — #189 parámetros nominales de la consola", () => {
  beforeEach(async () => {
    await resetTestDb();
    pushSingle.mockClear();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("CONVENCIONAL: marcar un parámetro lo persiste en el equipo con sync pendiente", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { sync_status: "synced" });
    render(<InfoModulo visitaId={visita!.id!} />);

    const grupo = await screen.findByRole("group", { name: GRUPO });
    fireEvent.click(within(grupo).getByRole("button", { name: "mAs" }));

    await waitFor(async () => {
      const fresh = await db.equipos.get(equipo.id!);
      expect(fresh!.parametros_consola).toEqual(["mas"]);
      expect(fresh!.sync_status).toBe("pending");
    });
    expect(pushSingle).toHaveBeenCalledWith("equipos", equipo.id);

    // Re-render desde Dexie: el botón queda marcado; desmarcar el último → null.
    const mas = await waitFor(() => {
      const b = within(screen.getByRole("group", { name: GRUPO })).getByRole("button", {
        name: "mAs",
      });
      expect(b.getAttribute("aria-pressed")).toBe("true");
      return b;
    });
    fireEvent.click(mas);
    await waitFor(async () => {
      expect((await db.equipos.get(equipo.id!))!.parametros_consola).toBeNull();
    });
  });

  it("otros tipos de equipo no muestran el checklist", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "MAMOGRAFO" });
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);
    expect(screen.queryByRole("group", { name: GRUPO })).toBeNull();
  });
});
