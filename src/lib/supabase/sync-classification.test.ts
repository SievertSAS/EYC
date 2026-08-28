// Guarda de clasificación de tablas.
//
// Toda tabla de Dexie tiene que estar clasificada como:
//   - SYNC_TABLES     → sube y baja de Supabase (bidireccional)
//   - MASTER_TABLES   → solo baja (catálogo de referencia)
//   - LOCAL_ONLY      → nunca toca Supabase (bookkeeping de sync)
//
// Si alguien agrega una tabla nueva al esquema y no la clasifica, este test
// falla. Es la red que evita que vuelvan los hallazgos #14 (una tabla queda
// fuera del sync sin que nadie lo note) y #20 (columnas/tablas locales que
// llegan a PostgREST y mandan la fila a `failed`).

import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";

// sync-engine importa @/lib/supabase/client, que valida env vars y lanza
// sin .env.local. Mismo mock que usa sync-engine.test.ts.
vi.mock("./client", () => ({ createClient: () => ({}) }));

import { SYNC_TABLES, MASTER_TABLES } from "./sync-engine";

// Tablas que viven SOLO en el dispositivo — no tienen contraparte en
// Supabase por diseño. Si agregás una acá, dejá el motivo.
const LOCAL_ONLY = new Set<string>([
  "sync_meta", // watermark de pull por tabla
  "sync_retry", // backoff de reintentos de push
  "change_logs", // auditoría local (change-tracker) — revisar en Tier 4 si debe sincronizar
  // ── Deuda detectada por este guard (no es local-only "por diseño") ──
  // `elementos_proteccion`: tabla legacy. Tiene contraparte en Supabase
  // (types.ts) pero NO está en SYNC_TABLES, así que nunca sincroniza. Ya
  // nada le escribe (el camino de escritura pasó a `conv_elementos_proteccion`),
  // pero generar-pre-informe.ts:140 TODAVÍA la lee. Resolver en Tier 5 (PDF):
  // o el PDF lee `conv_elementos_proteccion`, o se cablea al sync, o se borra
  // la tabla. Hasta entonces se marca local-only para no romper el guard.
  "elementos_proteccion",
]);

describe("clasificación de tablas de sync", () => {
  const classified = new Set<string>([
    ...SYNC_TABLES.map((t) => t.local),
    ...MASTER_TABLES,
    ...LOCAL_ONLY,
  ]);

  it("toda tabla de Dexie está clasificada (SYNC / MASTER / LOCAL_ONLY)", () => {
    const dexieTables = db.tables.map((t) => t.name).sort();
    const sinClasificar = dexieTables.filter((name) => !classified.has(name));

    expect(
      sinClasificar,
      `Tablas de Dexie sin clasificar: ${sinClasificar.join(", ")}. ` +
        `Agregala a SYNC_TABLES, MASTER_TABLES (sync-engine.ts) o a LOCAL_ONLY (este archivo).`
    ).toEqual([]);
  });

  it("no hay tablas clasificadas que ya no existan en el esquema", () => {
    const dexieTables = new Set(db.tables.map((t) => t.name));
    const fantasma = [...classified].filter((name) => !dexieTables.has(name));

    expect(fantasma, `Clasificadas pero inexistentes en Dexie: ${fantasma.join(", ")}`).toEqual([]);
  });

  it("ninguna tabla está en SYNC y MASTER a la vez", () => {
    const master = new Set(MASTER_TABLES as readonly string[]);
    const solapadas = SYNC_TABLES.map((t) => t.local).filter((l) => master.has(l));
    expect(solapadas).toEqual([]);
  });
});
