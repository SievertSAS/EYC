import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";

// `sync-engine.ts` importa `createClient` desde "@/lib/supabase/client",
// que valida variables de entorno de Supabase al cargarse — no relevante
// para estos tests (solo se ejercitan los contadores locales de Dexie),
// así que se stubea igual que en sync-engine.test.ts.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

import { countSyncStatuses } from "@/lib/supabase/sync-engine";
import { useSyncCounters } from "./use-sync-counters";

// ============================================================
//  Indicador global de pendientes/errores (PR4: sync-engine-entrega-garantizada)
//
//  countSyncStatuses() debe sumar "pending" en un contador y "error"+
//  "failed" juntos en otro, usando .count() indexado de Dexie (nunca
//  .toArray().length) sobre las mismas SYNC_TABLES que ya usa el motor.
// ============================================================

describe("countSyncStatuses", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("suma los registros pending en pendingCount", async () => {
    await db.clientes.put({
      id: "id-1",
      nombre_cliente: "Cliente 1",
      nit: "NIT-1",
      sync_status: "pending",
    });
    await db.sedes.put({
      id: "id-2",
      cliente_id: "id-1",
      nombre_sede: "Sede 1",
      sync_status: "pending",
    });
    await db.clientes.put({
      id: "id-3",
      nombre_cliente: "Cliente 3",
      nit: "NIT-3",
      sync_status: "synced",
    });

    const { pendingCount } = await countSyncStatuses();

    expect(pendingCount).toBe(2);
  });

  it("suma juntos los registros error y failed en errorCount", async () => {
    await db.clientes.put({
      id: "id-1",
      nombre_cliente: "Cliente 1",
      nit: "NIT-1",
      sync_status: "error",
    });
    await db.clientes.put({
      id: "id-2",
      nombre_cliente: "Cliente 2",
      nit: "NIT-2",
      sync_status: "failed",
    });
    await db.sedes.put({
      id: "id-3",
      cliente_id: "id-1",
      nombre_sede: "Sede 3",
      sync_status: "error",
    });
    await db.clientes.put({
      id: "id-4",
      nombre_cliente: "Cliente 4",
      nit: "NIT-4",
      sync_status: "synced",
    });

    const { errorCount } = await countSyncStatuses();

    expect(errorCount).toBe(3);
  });

  it("devuelve 0/0 cuando no hay registros pending/error/failed", async () => {
    await db.clientes.put({
      id: "id-1",
      nombre_cliente: "Cliente 1",
      nit: "NIT-1",
      sync_status: "synced",
    });

    const { pendingCount, errorCount } = await countSyncStatuses();

    expect(pendingCount).toBe(0);
    expect(errorCount).toBe(0);
  });
});

// ============================================================
//  useSyncCounters — expone {pendingCount, errorCount} reactivamente
//  vía useLiveQuery (dexie-react-hooks).
// ============================================================

function TestComponent() {
  const { pendingCount, errorCount } = useSyncCounters();
  return (
    <div>
      <span data-testid="pending-count">{pendingCount}</span>
      <span data-testid="error-count">{errorCount}</span>
    </div>
  );
}

describe("useSyncCounters", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    cleanup();
  });

  it("expone pendingCount y errorCount reactivamente tras sembrar datos", async () => {
    await db.clientes.put({
      id: "id-1",
      nombre_cliente: "Cliente 1",
      nit: "NIT-1",
      sync_status: "pending",
    });
    await db.clientes.put({
      id: "id-2",
      nombre_cliente: "Cliente 2",
      nit: "NIT-2",
      sync_status: "failed",
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("pending-count").textContent).toBe("1");
      expect(screen.getByTestId("error-count").textContent).toBe("1");
    });
  });
});
