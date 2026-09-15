// ============================================================
//  Glue de Dexie/sync para `conv_equipo_valores_base` (#110)
//
//  Wrapper fino sobre `db.conv_equipo_valores_base` + el motor de sync,
//  usado por los módulos de captura (grupo-b/c/d/e) para persistir un
//  valor base a nivel de equipo. La decisión de QUÉ campos escribir o
//  precargar vive en `valores-base-equipo.ts` (funciones puras).
// ============================================================

import { randomUUID } from "@/lib/uuid";
import { db } from "@/lib/db";
import { pushSingle, updateAndSync } from "@/lib/supabase/sync-engine";
import type { ConvEquipoValoresBase } from "./db/types";

/** Trae el registro de valores base del equipo, o `null` si no existe/no aplica. */
export async function obtenerValoresBaseEquipo(
  equipoId: string | null | undefined
): Promise<ConvEquipoValoresBase | null> {
  if (!equipoId) return null;
  const row = await db.conv_equipo_valores_base.where("equipo_id").equals(equipoId).first();
  return row ?? null;
}

/**
 * Upsert de `campos` en `conv_equipo_valores_base` para `equipoId`. No-op si
 * falta el equipo o no hay campos que escribir (mismo criterio de
 * `extraerValoresBaseParaEquipo`/`mapearBase29AEquipo`, que devuelven `null`
 * cuando no aplica).
 */
export async function upsertValoresBaseEquipo(
  equipoId: string | null | undefined,
  campos: Partial<ConvEquipoValoresBase> | null
): Promise<void> {
  if (!equipoId || !campos || Object.keys(campos).length === 0) return;
  const existente = await db.conv_equipo_valores_base.where("equipo_id").equals(equipoId).first();
  if (existente?.id) {
    await updateAndSync("conv_equipo_valores_base", existente.id, campos);
    return;
  }
  const now = new Date().toISOString();
  const nuevoId = await db.conv_equipo_valores_base.add({
    id: randomUUID(),
    equipo_id: equipoId,
    ...campos,
    creado_en: now,
    sync_status: "pending" as const,
    last_modified: now,
  });
  pushSingle("conv_equipo_valores_base", nuevoId as string);
}
