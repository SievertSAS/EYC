import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

const generarPreInforme = vi.fn();
vi.mock("@/lib/pdf/generar-pre-informe", () => ({
  generarPreInforme: (...a: unknown[]) => generarPreInforme(...a),
}));

const storageUpload = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: storageUpload }) },
  }),
}));

// #154: informes/informe_versiones pasaron a ser tablas de sync — el fix
// real es que este archivo use `updateAndSync` (que marca sync_status
// "pending" y empuja el cambio) en vez de `db.informes.update`/
// `db.informe_versiones.update` sueltos, que nunca llegaban a Supabase.
// El mock replica el efecto local real de `updateAndSync` sin tocar la red.
const updateAndSync = vi.fn(
  async (table: "informes" | "informe_versiones", id: string, patch: Record<string, unknown>) => {
    const dexieTable = table === "informes" ? db.informes : db.informe_versiones;
    await dexieTable.update(id, {
      ...patch,
      sync_status: "pending",
      last_modified: new Date().toISOString(),
    });
  }
);
vi.mock("@/lib/supabase/sync-engine", () => ({
  updateAndSync: (...a: unknown[]) =>
    updateAndSync(...(a as [never, never, Record<string, unknown>])),
}));

import { publicarVersionOficial } from "./publicar-informe";

beforeEach(async () => {
  await resetTestDb();
  generarPreInforme.mockReset().mockResolvedValue(new Blob(["contenido-pdf"]));
  storageUpload.mockClear().mockResolvedValue({ error: null });
  updateAndSync.mockClear();
});

async function seedInforme() {
  const { visita, equipo, ubicacion } = await seedGraph();
  const informeId = "inf-1";
  await db.informes.add({
    id: informeId,
    visita_id: visita!.id!,
    equipo_id: equipo.id!,
    ubicacion_id: ubicacion.id!,
    numero_informe: "EYC-2026-001",
    version_actual: 1,
    concepto_general: "FAVORABLE",
    qr_token: "qr-token-1",
    fecha_emision: "2026-01-01",
    fecha_vencimiento: "2028-01-01",
    estado: "aprobado",
    creado_en: "2026-01-01",
    sync_status: "synced",
    last_modified: "2026-01-01",
  });
  const versionId = "ver-1";
  await db.informe_versiones.add({
    id: versionId,
    informe_id: informeId,
    numero_version: 1,
    motivo_cambio: "emision_inicial",
    fecha_generacion: "2026-01-01",
    estado: "aprobado",
    creado_en: "2026-01-01",
    sync_status: "synced",
    last_modified: "2026-01-01",
  });
  return { visita: visita!, informeId, versionId };
}

describe("publicarVersionOficial", () => {
  it("éxito: sube el PDF, calcula el hash y actualiza informe_versiones/informes vía updateAndSync (#154)", async () => {
    const { visita, informeId, versionId } = await seedInforme();

    const result = await publicarVersionOficial(informeId, visita.id!);

    expect(result).toEqual({ success: true });
    expect(storageUpload).toHaveBeenCalledTimes(1);

    expect(updateAndSync).toHaveBeenCalledWith(
      "informe_versiones",
      versionId,
      expect.objectContaining({ pdf_url: expect.stringContaining(informeId) })
    );
    expect(updateAndSync).toHaveBeenCalledWith(
      "informes",
      informeId,
      expect.objectContaining({ qr_url: expect.stringContaining("qr-token-1") })
    );

    const version = await db.informe_versiones.get(versionId);
    expect(version?.pdf_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(version?.sync_status).toBe("pending");

    const informe = await db.informes.get(informeId);
    expect(informe?.qr_url).toContain("qr-token-1");
    expect(informe?.sync_status).toBe("pending");
  });

  it("no reescribe qr_url si el informe ya tenía uno (no llama a updateAndSync para informes)", async () => {
    const { visita, informeId } = await seedInforme();
    await db.informes.update(informeId, { qr_url: "https://ya-existe/verificar/qr-token-1" });
    updateAndSync.mockClear();

    await publicarVersionOficial(informeId, visita.id!);

    const llamadasInformes = updateAndSync.mock.calls.filter((c) => c[0] === "informes");
    expect(llamadasInformes).toHaveLength(0);
  });

  it("informe inexistente → success:false sin generar el PDF", async () => {
    const result = await publicarVersionOficial("no-existe", "visita-x");
    expect(result).toEqual({ success: false, error: "Informe no encontrado" });
    expect(generarPreInforme).not.toHaveBeenCalled();
  });

  it("generarPreInforme devuelve null (p.ej. pruebas pendientes) → success:false, no sube nada", async () => {
    const { visita, informeId } = await seedInforme();
    generarPreInforme.mockResolvedValue(null);

    const result = await publicarVersionOficial(informeId, visita.id!);

    expect(result).toEqual({ success: false, error: "No se pudo generar el PDF" });
    expect(storageUpload).not.toHaveBeenCalled();
    expect(updateAndSync).not.toHaveBeenCalled();
  });

  it("falla la subida a Storage → success:false con el mensaje de Supabase, no actualiza nada", async () => {
    const { visita, informeId } = await seedInforme();
    storageUpload.mockResolvedValue({ error: { message: "bucket lleno" } });

    const result = await publicarVersionOficial(informeId, visita.id!);

    expect(result).toEqual({ success: false, error: "bucket lleno" });
    expect(updateAndSync).not.toHaveBeenCalled();
  });
});
