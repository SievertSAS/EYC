import { db } from "@/lib/db";
import { createClient } from "./client";
import type { SyncStatus } from "@/lib/db/types";
import { logger } from "@/lib/logger";
import type { EntityTable } from "dexie";

type SyncableRecord = { id?: number; sync_status?: SyncStatus; [key: string]: unknown };

/**
 * Accede a una tabla de Dexie por nombre dinámico con tipo seguro.
 * Retorna undefined si la tabla no existe en el schema.
 */
function getDexieTable(name: string): EntityTable<SyncableRecord, "id"> | undefined {
  const record = db as unknown as Record<string, unknown>;
  if (name in record && typeof record[name] === "object") {
    return record[name] as EntityTable<SyncableRecord, "id">;
  }
  return undefined;
}

// ============================================================
//  Motor de sincronización Dexie ↔ Supabase
//
//  Estrategia: "Local-first con push/pull"
//  1. PUSH: registros locales con sync_status="pending" → Supabase
//  2. PULL: datos de Supabase → actualizar IndexedDB local
//
//  Las tablas de campo (visitas, pruebas, mediciones, evidencias)
//  se sincronizan bidireccionalmente.
//  Las tablas maestras (clientes, equipos, etc.) se descargan
//  del servidor al iniciar sesión.
// ============================================================

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: SyncError[];
  timestamp: string;
}

export interface SyncError {
  table: string;
  recordId: number;
  /** Mensaje legible para mostrar al técnico */
  error: string;
  /** Detalle técnico del error de Supabase (code, hint, etc.) */
  detail?: string;
  action: "push" | "pull";
}

/** Nombres legibles para las tablas en mensajes al usuario */
const TABLE_LABELS: Record<string, string> = {
  clientes: "Clientes",
  contactos: "Contactos",
  sedes: "Sedes",
  ubicaciones_rx: "Ubicaciones",
  equipos: "Equipos",
  tubos: "Tubos",
  colimadores: "Colimadores",
  gantry: "Gantry",
  solicitudes: "Solicitudes",
  visitas: "Visitas",
  grupo_resultados: "Grupos de resultados",
  prueba_resultados: "Resultados de pruebas",
  mediciones_radiometricas: "Mediciones radiométricas",
  evidencias: "Evidencias",
  sala_dimensiones: "Dimensiones de sala",
  partes_equipo: "Partes de equipo",
  valores_referencia: "Valores de referencia",
  usuarios: "Usuarios",
  cotizaciones: "Cotizaciones",
  prueba_definiciones: "Definiciones de pruebas",
  grupo_pruebas: "Grupos de pruebas",
  informes: "Informes",
  informe_versiones: "Versiones de informe",
  rol_permisos: "Permisos",
};

function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? name;
}

/** Extrae un mensaje legible de un error de Supabase o JS */
function describeError(err: unknown): { message: string; detail?: string } {
  if (err && typeof err === "object" && "message" in err) {
    const supaErr = err as { message: string; code?: string; hint?: string; details?: string };
    const detail = [supaErr.code, supaErr.hint, supaErr.details].filter(Boolean).join(" — ");
    return { message: supaErr.message, detail: detail || undefined };
  }
  return { message: String(err) };
}

// Campos que solo existen en Dexie y nunca deben enviarse a Supabase
const LOCAL_ONLY_FIELDS = ["id", "sync_status", "blob_local", "last_modified", "_remote_id"];

// Campos extra por tabla que existen en Dexie pero no en Supabase
const EXTRA_LOCAL_FIELDS: Record<string, string[]> = {
  solicitudes: ["suitecrm_id"],
  prueba_resultados: ["grupo_resultado_id", "resultados_calculados", "evaluacion_criterios", "imagenes"],
};

// Tablas que se sincronizan bidireccionalmente (tienen sync_status)
const SYNC_TABLES = [
  { local: "clientes", remote: "clientes" },
  { local: "contactos", remote: "contactos" },
  { local: "sedes", remote: "sedes" },
  { local: "ubicaciones_rx", remote: "ubicaciones_rx" },
  { local: "equipos", remote: "equipos" },
  { local: "tubos", remote: "tubos" },
  { local: "colimadores", remote: "colimadores" },
  { local: "gantry", remote: "gantry" },
  { local: "solicitudes", remote: "solicitudes" },
  { local: "visitas", remote: "visitas" },
  { local: "grupo_resultados", remote: "grupo_resultados" },
  { local: "prueba_resultados", remote: "prueba_resultados" },
  { local: "mediciones_radiometricas", remote: "mediciones_radiometricas" },
  { local: "evidencias", remote: "evidencias" },
] as const;

/** Limpia un registro Dexie para enviar a Supabase, quitando campos locales */
function stripLocalFields(
  record: Record<string, unknown>,
  localTable: string
): { localId: number; remoteId: unknown; data: Record<string, unknown> } {
  const exclude = new Set([...LOCAL_ONLY_FIELDS, ...(EXTRA_LOCAL_FIELDS[localTable] ?? [])]);
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (!exclude.has(key)) {
      data[key] = val;
    }
  }

  // Limpiar blob_local de imagenes anidadas (grupo_resultados, evidencias)
  if (Array.isArray(data.imagenes)) {
    data.imagenes = (data.imagenes as Record<string, unknown>[]).map(
      ({ blob_local: _b, ...rest }) => rest
    );
  }

  return {
    localId: record.id as number,
    remoteId: record._remote_id,
    data,
  };
}

// Tablas maestras que se descargan del servidor (read-only para sync)
const MASTER_TABLES = [
  "sala_dimensiones",
  "partes_equipo",
  "valores_referencia",
  "usuarios",
  "cotizaciones",
  "prueba_definiciones",
  "grupo_pruebas",
  "informes",
  "informe_versiones",
  "rol_permisos",
] as const;

/**
 * Ejecuta un ciclo completo de sincronización.
 * Push primero (para no perder cambios locales), luego Pull.
 */
export async function fullSync(): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const supabase = createClient();

  // Verificar sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    result.errors.push({
      table: "_auth",
      recordId: 0,
      error: "No hay sesión activa — inicia sesión para sincronizar",
      action: "push",
    });
    return result;
  }

  // 1. PUSH: enviar cambios locales al servidor
  for (const table of SYNC_TABLES) {
    try {
      const { pushed, errors } = await pushTable(supabase, table.local, table.remote);
      result.pushed += pushed;
      result.errors.push(...errors);
    } catch (err) {
      const { message, detail } = describeError(err);
      result.errors.push({
        table: table.local,
        recordId: 0,
        error: `Error general enviando ${tableLabel(table.local)}: ${message}`,
        detail,
        action: "push",
      });
    }
  }

  // 2. PULL: descargar datos maestros del servidor
  for (const tableName of MASTER_TABLES) {
    try {
      const pulled = await pullMasterTable(supabase, tableName);
      result.pulled += pulled;
    } catch (err) {
      const { message, detail } = describeError(err);
      result.errors.push({
        table: tableName,
        recordId: 0,
        error: `Error descargando ${tableLabel(tableName)}: ${message}`,
        detail,
        action: "pull",
      });
    }
  }

  // 3. PULL: descargar datos de campo actualizados
  for (const table of SYNC_TABLES) {
    try {
      const pulled = await pullSyncTable(supabase, table.local, table.remote);
      result.pulled += pulled;
    } catch (err) {
      const { message, detail } = describeError(err);
      result.errors.push({
        table: table.local,
        recordId: 0,
        error: `Error descargando ${tableLabel(table.local)}: ${message}`,
        detail,
        action: "pull",
      });
    }
  }

  return result;
}

interface PushResult {
  pushed: number;
  errors: SyncError[];
}

/**
 * Push: enviar registros con sync_status="pending" al servidor.
 * Después de éxito, marcar como "synced".
 * Retorna conteo + errores individuales por registro.
 */
async function pushTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  localTable: string,
  remoteTable: string
): Promise<PushResult> {
  const dexieTable = getDexieTable(localTable);
  if (!dexieTable) return { pushed: 0, errors: [] };

  const pending = await dexieTable.where("sync_status").equals("pending").toArray();

  if (pending.length === 0) return { pushed: 0, errors: [] };

  let pushed = 0;
  const errors: SyncError[] = [];

  for (const record of pending) {
    const { localId, remoteId, data } = stripLocalFields(record, localTable);

    try {
      if (remoteId) {
        const { error } = await supabase.from(remoteTable).update(data).eq("id", remoteId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from(remoteTable)
          .insert(data)
          .select("id")
          .single();

        if (error) throw error;

        await dexieTable.update(localId, {
          _remote_id: inserted.id,
        });
      }

      await dexieTable.update(localId, {
        sync_status: "synced" as SyncStatus,
        last_modified: new Date().toISOString(),
      });

      pushed++;
    } catch (err) {
      await dexieTable.update(localId, {
        sync_status: "error" as SyncStatus,
      });

      const { message, detail } = describeError(err);
      const label = tableLabel(localTable);
      errors.push({
        table: localTable,
        recordId: localId,
        error: `No se pudo enviar registro #${localId} de ${label}: ${message}`,
        detail,
        action: "push",
      });
      logger.error("sync:push", `Error pushing ${localTable}#${localId}`, err);
    }
  }

  return { pushed, errors };
}

// ─── Push inmediato y auto-sync ───

/**
 * Push inmediato de un registro recién guardado.
 * Se llama desde los formularios justo después de guardar en Dexie.
 * No bloquea la UI — falla silenciosamente si está offline.
 */
export async function pushSingle(localTable: string, localId: number): Promise<boolean> {
  if (!navigator.onLine) return false;

  const remote = SYNC_TABLES.find((t) => t.local === localTable)?.remote;
  if (!remote) return false;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const dexieTable = getDexieTable(localTable);
    if (!dexieTable) return false;

    const record = await dexieTable.get(localId);
    if (!record || record.sync_status !== "pending") return false;

    const { localId: lid, remoteId, data } = stripLocalFields(record, localTable);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = supabase.from(remote) as any;
    if (remoteId) {
      const { error } = await table.update(data).eq("id", remoteId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await table
        .insert(data)
        .select("id")
        .single();
      if (error) throw error;
      await dexieTable.update(lid, { _remote_id: inserted.id });
    }

    await dexieTable.update(lid, {
      sync_status: "synced" as SyncStatus,
      last_modified: new Date().toISOString(),
    });

    logger.info("sync:push-single", `${localTable}#${lid} synced`);
    return true;
  } catch (err) {
    logger.warn("sync:push-single", `${localTable}#${localId} failed (will retry)`, err);
    return false;
  }
}

/**
 * Push de todos los registros pendientes (sin pull).
 * Usado por el auto-sync periódico — más liviano que fullSync.
 */
export async function pushAllPending(): Promise<{ pushed: number; errors: number }> {
  if (!navigator.onLine) return { pushed: 0, errors: 0 };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pushed: 0, errors: 0 };

  let totalPushed = 0;
  let totalErrors = 0;

  for (const table of SYNC_TABLES) {
    const { pushed, errors } = await pushTable(supabase, table.local, table.remote);
    totalPushed += pushed;
    totalErrors += errors.length;
  }

  if (totalPushed > 0) {
    logger.info("sync:auto", `Auto-sync: ${totalPushed} enviados, ${totalErrors} errores`);
  }

  return { pushed: totalPushed, errors: totalErrors };
}

/**
 * Pull tabla maestra: reemplaza todo el contenido local con el del servidor.
 * Estrategia simple: bulk-put (upsert por id).
 */
async function pullMasterTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tableName: string
): Promise<number> {
  const dexieTable = getDexieTable(tableName);
  if (!dexieTable) return 0;

  const { data, error } = await supabase.from(tableName).select("*");

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  // Bulk upsert en Dexie
  await dexieTable.bulkPut(data);

  return data.length;
}

/**
 * Pull tabla de sincronización: solo registros modificados después
 * de la última sync local.
 */
async function pullSyncTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  localTable: string,
  remoteTable: string
): Promise<number> {
  const dexieTable = getDexieTable(localTable);
  if (!dexieTable) return 0;

  // Obtener la última fecha de modificación local sincronizada
  const lastSynced = await getLastSyncTimestamp(localTable);

  let query = supabase.from(remoteTable).select("*");

  if (lastSynced) {
    query = query.gt("last_modified", lastSynced);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  // Merge: solo actualizar si el servidor tiene una versión más reciente
  let pulled = 0;
  for (const remoteRecord of data) {
    const localRecord = await dexieTable.get(remoteRecord.id);

    if (!localRecord) {
      // No existe localmente — insertar
      await dexieTable.put({
        ...remoteRecord,
        sync_status: "synced" as SyncStatus,
      });
      pulled++;
    } else if (localRecord.sync_status === "synced") {
      // Existe y está sincronizado — actualizar con datos del servidor
      await dexieTable.put({
        ...remoteRecord,
        sync_status: "synced" as SyncStatus,
      });
      pulled++;
    } else {
      // Conflicto: hay cambios locales pendientes
      // Estrategia: mantener cambio local (last-write-wins del lado local)
      console.warn(
        `[Sync] Conflicto en ${localTable}#${remoteRecord.id} — manteniendo versión local`
      );
      await dexieTable.update(localRecord.id, {
        sync_status: "conflict" as SyncStatus,
      });
    }
  }

  // Guardar timestamp de esta sync
  await setLastSyncTimestamp(localTable, new Date().toISOString());

  return pulled;
}

// ─── Timestamp tracking (stored in Dexie, not localStorage) ───

async function getLastSyncTimestamp(table: string): Promise<string | null> {
  try {
    const entry = await db.sync_meta.get(table);
    return entry?.last_pulled_at ?? null;
  } catch (err) {
    logger.error("sync:timestamp", `Error leyendo timestamp de ${table}`, err);
    return null;
  }
}

async function setLastSyncTimestamp(table: string, timestamp: string): Promise<void> {
  try {
    await db.sync_meta.put({ table_name: table, last_pulled_at: timestamp });
  } catch (err) {
    logger.error("sync:timestamp", `Error guardando timestamp de ${table}`, err);
  }
}

// ─── Diagnóstico de errores ───

export interface ErrorRecord {
  table: string;
  tableLabel: string;
  id: number;
  /** Texto identificador del registro (ej. nombre_cliente) */
  preview: string;
}

/**
 * Consulta todos los registros con sync_status="error" para mostrar al usuario.
 */
export async function getErrorRecords(): Promise<ErrorRecord[]> {
  const results: ErrorRecord[] = [];

  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const errored = await dexieTable.where("sync_status").equals("error").toArray();
      for (const rec of errored) {
        const id = rec.id ?? 0;
        results.push({
          table: table.local,
          tableLabel: tableLabel(table.local),
          id,
          preview:
            String(rec.nombre_cliente ?? rec.nombre ?? rec.nombre_sede ?? rec.codigo ?? `#${id}`),
        });
      }
    } catch {
      // tabla sin sync_status — ignorar
    }
  }

  return results;
}

/**
 * Marca registros con error como "pending" para reintentar en la próxima sync.
 */
export async function retryErrorRecords(): Promise<number> {
  let count = 0;
  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const errored = await dexieTable.where("sync_status").equals("error").toArray();
      for (const rec of errored) {
        await dexieTable.update(rec.id, { sync_status: "pending" as SyncStatus });
        count++;
      }
    } catch {
      // tabla sin sync_status — ignorar
    }
  }
  return count;
}

// ─── Estado de conectividad ───

/**
 * Verifica si hay conexión y sesión válida con Supabase.
 */
export async function checkSyncStatus(): Promise<{
  online: boolean;
  authenticated: boolean;
  pendingCount: number;
  errorCount: number;
}> {
  const online = navigator.onLine;

  let authenticated = false;
  if (online) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authenticated = !!user;
    } catch (err) {
      logger.warn("sync:status", "No se pudo verificar sesión (posiblemente offline)", err);
    }
  }

  // Contar registros pendientes y con error
  let pendingCount = 0;
  let errorCount = 0;
  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (dexieTable) {
        pendingCount += await dexieTable.where("sync_status").equals("pending").count();
        errorCount += await dexieTable.where("sync_status").equals("error").count();
      }
    } catch (err) {
      logger.error("sync:status", `Error contando registros en ${table.local}`, err);
    }
  }

  return { online, authenticated, pendingCount, errorCount };
}
