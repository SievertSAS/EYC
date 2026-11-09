import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

const useDb = vi.fn();
vi.mock("@/components/db-provider", () => ({ useDb: () => useDb() }));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({
    role: { usuarioId: "usr-tec", nombre: "Tec", cargo: "tecnico" },
    hasPermission: () => true,
  }),
}));
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
  updateAndSync: vi.fn().mockResolvedValue(undefined),
  deleteAndSync: vi.fn().mockResolvedValue(undefined),
}));

import { InfoModulo } from "./info-modulo";
import { UbicacionPortatil } from "./ubicacion-portatil";

// ============================================================
//  #188 — Categoría de ubicación del portátil (fija / flotante)
// ============================================================

beforeEach(async () => {
  await resetTestDb();
  useDb.mockReturnValue({ isReady: true });
});
afterEach(() => cleanup());

async function sembrar(tipoInstalacion: "fijo" | "portatil", visitaPatch = {}) {
  const g = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
  await db.equipos.update(g.equipo.id!, { tipo_instalacion: tipoInstalacion });
  await db.visitas.update(g.visita!.id!, visitaPatch);
  return g.visita!.id!;
}

describe("InfoModulo — categoría de ubicación", () => {
  it("equipo fijo: no muestra la categoría de ubicación (sin cambios)", async () => {
    const id = await sembrar("fijo");
    render(<InfoModulo visitaId={id} />);
    await screen.findByText(/Volver al workspace/i);
    expect(screen.queryByRole("radiogroup", { name: "Categoría de ubicación" })).toBeNull();
    expect(screen.getByText("Ubicación física del equipo")).toBeInTheDocument();
  });

  it("portátil: elegir 'Flotante' guarda la categoría en la visita", async () => {
    const id = await sembrar("portatil");
    render(<InfoModulo visitaId={id} />);
    const grupo = await screen.findByRole("radiogroup", { name: "Categoría de ubicación" });
    fireEvent.click(within(grupo).getByRole("radio", { name: "Flotante" }));
    await waitFor(async () => {
      expect((await db.visitas.get(id))?.categoria_ubicacion).toBe("flotante");
    });
  });

  it("portátil flotante: oculta el párrafo de ubicación física y muestra las áreas", async () => {
    const id = await sembrar("portatil", {
      categoria_ubicacion: "flotante",
      ubicaciones_flotantes: ["UCI adultos"],
    });
    render(<InfoModulo visitaId={id} />);
    await screen.findByText("UCI adultos");
    expect(screen.queryByText("Ubicación física del equipo")).toBeNull();
  });
});

describe("UbicacionPortatil — áreas flotantes", () => {
  it("quitar un área la saca de la visita", async () => {
    const id = await sembrar("portatil", {
      categoria_ubicacion: "flotante",
      ubicaciones_flotantes: ["UCI adultos", "Urgencias"],
    });
    render(
      <UbicacionPortatil
        visitaId={id}
        categoria="flotante"
        areas={["UCI adultos", "Urgencias"]}
        usuarioId="usr-tec"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Quitar Urgencias" }));
    await waitFor(async () => {
      expect((await db.visitas.get(id))?.ubicaciones_flotantes).toEqual(["UCI adultos"]);
    });
  });

  it("'Otro' agrega la ubicación al catálogo y a la visita; repetida no se duplica", async () => {
    const id = await sembrar("portatil", { categoria_ubicacion: "flotante" });
    await db.catalogo_ubicaciones_flotantes.add({
      id: "cat-1",
      nombre: "UCI pediátrica",
      activo: true,
      sync_status: "synced",
      last_modified: "2026-01-01",
    });
    render(<UbicacionPortatil visitaId={id} categoria="flotante" areas={[]} usuarioId="usr-tec" />);

    fireEvent.click(screen.getByRole("button", { name: "Otra ubicación" }));
    const input = screen.getByPlaceholderText("Nombre de la ubicación");
    fireEvent.change(input, { target: { value: "uci PEDIATRICA" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(async () => {
      expect((await db.visitas.get(id))?.ubicaciones_flotantes).toEqual(["UCI pediátrica"]);
    });
    expect(await db.catalogo_ubicaciones_flotantes.count()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Otra ubicación" }));
    fireEvent.change(screen.getByPlaceholderText("Nombre de la ubicación"), {
      target: { value: "Sala de partos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(async () => {
      const nueva = (await db.catalogo_ubicaciones_flotantes.toArray()).find(
        (f) => f.nombre === "Sala de partos"
      );
      expect(nueva?.creado_por).toBe("usr-tec");
    });
  });
});
