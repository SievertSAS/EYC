import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeCliente } from "@/test/factories";
import { generarNumeroSolicitud } from "./solicitud-numero";

function sol(over: Partial<Parameters<typeof db.solicitudes.add>[0]> = {}) {
  return {
    id: crypto.randomUUID(),
    cliente_id: "c1",
    pago_recibido: false,
    sync_status: "synced" as const,
    last_modified: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(async () => {
  await resetTestDb();
  await db.clientes.add(makeCliente({ id: "c1" }));
});

describe("generarNumeroSolicitud", () => {
  // `new Date(y, m, d)` (constructor local) — evita el corrimiento de zona
  // horaria de `new Date("2027-01-01")` (que se parsea como UTC).
  const dia = (y: number, m: number, d: number) => new Date(y, m - 1, d);

  it("SOL-{año}-001 para la primera del año", async () => {
    expect(await generarNumeroSolicitud(dia(2026, 5, 10))).toBe("SOL-2026-001");
  });

  it("incrementa sobre el máximo del año, ignorando otros años", async () => {
    await db.solicitudes.add(sol({ numero_solicitud: "SOL-2026-001" }));
    await db.solicitudes.add(sol({ numero_solicitud: "SOL-2026-007" }));
    await db.solicitudes.add(sol({ numero_solicitud: "SOL-2025-050" }));
    await db.solicitudes.add(sol({ numero_solicitud: undefined }));

    expect(await generarNumeroSolicitud(dia(2026, 9, 1))).toBe("SOL-2026-008");
    expect(await generarNumeroSolicitud(dia(2025, 9, 1))).toBe("SOL-2025-051");
    expect(await generarNumeroSolicitud(dia(2027, 1, 1))).toBe("SOL-2027-001");
  });

  it("padea a 3 dígitos pero no rompe con seq > 999", async () => {
    await db.solicitudes.add(sol({ numero_solicitud: "SOL-2026-999" }));
    expect(await generarNumeroSolicitud(dia(2026, 1, 1))).toBe("SOL-2026-1000");
  });
});
