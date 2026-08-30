import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// sync-engine importa `./client` → `@/lib/env` (que lanza sin env vars).
vi.mock("./client", () => ({ createClient: () => ({}) }));

import {
  SYNC_TABLES,
  LOCAL_ONLY_FIELDS,
  EXTRA_LOCAL_FIELDS,
  prepareForRemote,
} from "./sync-engine";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { db } from "@/lib/db";

// ============================================================
//  #39 — guard de columnas: toda columna que el push manda a Supabase
//  tiene que existir del lado Supabase. `LOCAL_ONLY_FIELDS` /
//  `EXTRA_LOCAL_FIELDS` se mantienen a mano — si alguien agrega una
//  columna Dexie que no existe en Supabase y no la clasifica, el push
//  la envía → PGRST204 / 42703 → la fila va a `failed`.
//
//  Este test parsea los tipos generados de Supabase (`Insert` por tabla)
//  y compara contra lo que `prepareForRemote` produciría para una fila
//  representativa sembrada por `seedGraph`.
// ============================================================

/** { tabla → Set<columnas del tipo Insert> } parseado de types.ts */
function parseSupabaseInsertColumns(): Map<string, Set<string>> {
  const src = readFileSync(resolve(__dirname, "types.ts"), "utf8");
  const out = new Map<string, Set<string>>();

  // Bloques:  <indent6>tabla: {  ...  Insert: {  <cols>  };
  const tableRe = /^ {6}([a-z_][a-z0-9_]*): \{$/gm;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(src))) {
    const table = m[1];
    const rest = src.slice(m.index);
    const insertStart = rest.indexOf("Insert: {");
    if (insertStart === -1) continue;
    const insertBody = rest.slice(insertStart + "Insert: {".length);
    const end = insertBody.indexOf("\n        };");
    if (end === -1) continue;
    const cols = new Set<string>();
    for (const line of insertBody.slice(0, end).split("\n")) {
      const cm = line.match(/^\s{10}([a-z_][a-z0-9_]*)\??:/);
      if (cm) cols.add(cm[1]);
    }
    if (cols.size > 0) out.set(table, cols);
  }
  return out;
}

const supaCols = parseSupabaseInsertColumns();

// Tablas que `seedGraph` produce con una fila representativa.
const SEEDED = [
  "clientes",
  "contactos",
  "sedes",
  "ubicaciones_rx",
  "equipos",
  "tubos",
  "solicitudes",
  "visitas",
] as const;

describe("sync — parseo de columnas Supabase (sanity)", () => {
  it("encuentra las tablas de sync principales en types.ts con columnas", () => {
    for (const t of SEEDED) {
      expect(supaCols.get(t), `types.ts sin Insert para "${t}"`).toBeTruthy();
      expect((supaCols.get(t) as Set<string>).size).toBeGreaterThan(2);
    }
  });
});

describe("#39 — toda columna pusheada existe en Supabase", () => {
  it("las filas de seedGraph no envían columnas desconocidas ni sin clasificar", async () => {
    await resetTestDb();
    const g = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const asRow = (o: unknown) => o as Record<string, unknown> | undefined;
    const rows: Record<string, Record<string, unknown> | undefined> = {
      clientes: asRow(g.cliente),
      sedes: asRow(g.sede),
      ubicaciones_rx: asRow(g.ubicacion),
      equipos: asRow(g.equipo),
      tubos: asRow(g.tubo),
      solicitudes: asRow(g.solicitud),
      visitas: asRow(g.visita),
      contactos: asRow(
        (await db.contactos.where("cliente_id").equals(g.cliente.id!).first()) ?? undefined
      ),
    };

    const problemas: string[] = [];

    for (const { local } of SYNC_TABLES) {
      if (!SEEDED.includes(local as (typeof SEEDED)[number])) continue;
      const row = rows[local];
      if (!row) continue;
      const remota = supaCols.get(local);
      if (!remota) continue;

      const enviadas = Object.keys(prepareForRemote(row, local));
      for (const col of enviadas) {
        if (!remota.has(col)) {
          problemas.push(
            `${local}.${col} — el push la manda pero no existe en Supabase. ` +
              `Agregala a LOCAL_ONLY_FIELDS/EXTRA_LOCAL_FIELDS o a la tabla remota.`
          );
        }
      }
    }

    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("LOCAL_ONLY_FIELDS y EXTRA_LOCAL_FIELDS siguen exportados (no romper el guard)", () => {
    expect(LOCAL_ONLY_FIELDS.has("blob_local")).toBe(true);
    expect(EXTRA_LOCAL_FIELDS.solicitudes).toContain("suitecrm_id");
  });
});
