import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import type { ConvInformeSeccion } from "@/lib/equipos/convencional/db/types";

// ============================================================
//  2.8 — concepto "Referencia" en el editor del pre-informe.
//  Con el switch encendido (y sin regla automática ni "no ejecutada") la 2.8
//  muestra el badge "Referencia" y cuenta en su propio contador, no como
//  pendiente ni como N/A.
// ============================================================

const useDb = vi.fn();
vi.mock("@/components/db-provider", () => ({ useDb: () => useDb() }));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({ role: "tecnico", cargo: "tecnico", usuarioId: "u1", nombre: "Tec" }),
}));
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
  updateAndSync: vi.fn().mockResolvedValue(undefined),
  deleteAndSync: vi.fn().mockResolvedValue(undefined),
}));

import { PreInformeModulo } from "./pre-informe-modulo";

afterEach(cleanup);

beforeEach(async () => {
  await resetTestDb();
  useDb.mockReturnValue({ isReady: true });
});

async function seedVisitaCon28(campos: Partial<ConvInformeSeccion> = {}) {
  const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
  await db.conv_informe_secciones.add({
    id: randomUUID(),
    visita_id: visita!.id!,
    prueba_codigo: "2.8",
    orden: 8,
    incluida: true,
    sync_status: "synced",
    last_modified: new Date().toISOString(),
    ...campos,
  });
  return visita!.id!;
}

async function esperarTarjeta() {
  await screen.findByRole("button", { name: "Ver detalle de la prueba 2.8" });
}

describe("PreInformeModulo — 2.8 con concepto 'Referencia'", () => {
  it("2.8 encendida: badge 'Referencia' y contador propio, sin pendientes", async () => {
    const visitaId = await seedVisitaCon28();
    render(<PreInformeModulo visitaId={visitaId} />);
    await esperarTarjeta();
    expect(screen.getByTestId("badge-concepto-referencia")).toBeTruthy();
    expect(screen.getByTestId("stat-referencia").textContent).toContain("1");
    expect(screen.queryByText("Pendientes")).toBeNull();
    expect(screen.queryByText("N/A", { selector: "span" })).toBeNull();
  });

  it("2.8 apagada: no es Referencia (N/A)", async () => {
    const visitaId = await seedVisitaCon28({ incluida: false });
    render(<PreInformeModulo visitaId={visitaId} />);
    await esperarTarjeta();
    expect(screen.queryByTestId("badge-concepto-referencia")).toBeNull();
    expect(screen.queryByTestId("stat-referencia")).toBeNull();
  });

  it("2.8 'no se pudo ejecutar': gana N/E", async () => {
    const visitaId = await seedVisitaCon28({ concepto: "No_favorable_no_ejecutada" });
    render(<PreInformeModulo visitaId={visitaId} />);
    await esperarTarjeta();
    expect(screen.queryByTestId("badge-concepto-referencia")).toBeNull();
    expect(screen.getByText("N/E")).toBeTruthy();
  });

  it("2.8 en no aplica automático (equipo sin DAP): no es Referencia", async () => {
    const visitaId = await seedVisitaCon28();
    await db.conv_raysafe_setup.add({
      id: randomUUID(),
      visita_id: visitaId,
      unidad_dap: "no_aplica",
    });
    render(<PreInformeModulo visitaId={visitaId} />);
    await esperarTarjeta();
    expect(screen.queryByTestId("badge-concepto-referencia")).toBeNull();
  });
});
