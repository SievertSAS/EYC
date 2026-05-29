import { db } from "@/lib/db";
import { createClient } from "./client";
import type { SyncStatus } from "@/lib/db/types";

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
  error: string;
  action: "push" | "pull";
}

// Tablas que se sincronizan bidireccionalmente (tienen sync_status)
const SYNC_TABLES = [
  { local: "visitas", remote: "visitas" },
  { local: "grupo_resultados", remote: "grupo_resultados" },
  { local: "prueba_resultados", remote: "prueba_resultados" },
  { local: "mediciones_radiometricas", remote: "mediciones_radiometricas" },
  { local: "evidencias", remote: "evidencias" },
] as const;

// Tablas maestras que se descargan del servidor (read-only para sync)
const MASTER_TABLES = [
  "clientes",
  "contactos",
  "sedes",
  "ubicaciones_rx",
  "equipos",
  "tubos",
  "colimadores",
  "gantry",
  "sala_dimensiones",
  "partes_equipo",
  "valores_referencia",
  "usuarios",
  "cotizaciones",
  "solicitudes",
  "prueba_definiciones",
  "grupo_pruebas",
  "informes",
  "informe_versiones",
  "rol_permisos",
] as const;

const FIRST_SYNC_KEY = "sievert_first_sync_done";

/**
 * Detecta si es la primera sincronización (datos locales son solo demo).
 * En ese caso, limpia las tablas de campo locales antes de sincronizar
 * para evitar pushear datos de demo que fallarían por FK inexistentes.
 */
async function cleanDemoDataIfFirstSync(): Promise<void> {
  const done = localStorage.getItem(FIRST_SYNC_KEY);
  if (done) return;

  console.log("[Sync] Primera sincronización — limpiando datos de demo...");

  // Limpiar tablas de campo (datos de demo)
  for (const table of SYNC_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTable = (db as any)[table.local];
      if (dexieTable) await dexieTable.clear();
    } catch {
      // Ignorar
    }
  }

  // También limpiar tablas auxiliares de campo
  const AUXILIARY_TABLES = ["elementos_proteccion"];
  for (const t of AUXILIARY_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTable = (db as any)[t];
      if (dexieTable) await dexieTable.clear();
    } catch {
      // Ignorar
    }
  }

  // Limpiar tablas maestras demo (serán reemplazadas por pullMasterTable)
  const DEMO_MASTER_TABLES = [
    "clientes",
    "contactos",
    "sedes",
    "ubicaciones_rx",
    "equipos",
    "tubos",
    "sala_dimensiones",
    "valores_referencia",
    "usuarios",
    "solicitudes",
    "partes_equipo",
  ];
  for (const t of DEMO_MASTER_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTable = (db as any)[t];
      if (dexieTable) await dexieTable.clear();
    } catch {
      // Ignorar
    }
  }

  // Limpiar timestamps de sync anteriores
  localStorage.removeItem(SYNC_TIMESTAMPS_KEY);

  localStorage.setItem(FIRST_SYNC_KEY, "true");
  console.log("[Sync] Datos de demo limpiados");
}

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
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    result.errors.push({
      table: "_auth",
      recordId: 0,
      error: "No hay sesión activa — inicia sesión para sincronizar",
      action: "push",
    });
    return result;
  }

  // Limpiar datos de demo en la primera sincronización
  await cleanDemoDataIfFirstSync();

  // 1. PUSH: enviar cambios locales al servidor
  for (const table of SYNC_TABLES) {
    try {
      const pushed = await pushTable(supabase, table.local, table.remote);
      result.pushed += pushed;
    } catch (err) {
      result.errors.push({
        table: table.local,
        recordId: 0,
        error: err instanceof Error ? err.message : String(err),
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
      result.errors.push({
        table: tableName,
        recordId: 0,
        error: err instanceof Error ? err.message : String(err),
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
      result.errors.push({
        table: table.local,
        recordId: 0,
        error: err instanceof Error ? err.message : String(err),
        action: "pull",
      });
    }
  }

  return result;
}

/**
 * Push: enviar registros con sync_status="pending" al servidor.
 * Después de éxito, marcar como "synced".
 */
async function pushTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  localTable: string,
  remoteTable: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dexieTable = (db as any)[localTable];
  if (!dexieTable) return 0;

  const pending = await dexieTable
    .where("sync_status")
    .equals("pending")
    .toArray();

  if (pending.length === 0) return 0;

  let pushed = 0;

  for (const record of pending) {
    const { id: localId, sync_status, blob_local, ...data } = record;

    try {
      if (record._remote_id) {
        // UPDATE existente en el servidor
        const { error } = await supabase
          .from(remoteTable)
          .update(data)
          .eq("id", record._remote_id);

        if (error) throw error;
      } else {
        // INSERT nuevo en el servidor
        const { data: inserted, error } = await supabase
          .from(remoteTable)
          .insert(data)
          .select("id")
          .single();

        if (error) throw error;

        // Guardar referencia al ID remoto
        await dexieTable.update(localId, {
          _remote_id: inserted.id,
        });
      }

      // Marcar como sincronizado
      await dexieTable.update(localId, {
        sync_status: "synced" as SyncStatus,
        last_modified: new Date().toISOString(),
      });

      pushed++;
    } catch (err) {
      // Marcar como error para reintentar después
      await dexieTable.update(localId, {
        sync_status: "error" as SyncStatus,
      });
      console.error(
        `[Sync] Error pushing ${localTable}#${localId}:`,
        err
      );
    }
  }

  return pushed;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dexieTable = (db as any)[tableName === "ubicaciones_rx" ? "ubicaciones_rx" : tableName];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dexieTable = (db as any)[localTable];
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

// ─── Timestamp tracking ───

const SYNC_TIMESTAMPS_KEY = "sievert_sync_timestamps";

async function getLastSyncTimestamp(
  table: string
): Promise<string | null> {
  try {
    const stored = localStorage.getItem(SYNC_TIMESTAMPS_KEY);
    if (!stored) return null;
    const timestamps = JSON.parse(stored);
    return timestamps[table] ?? null;
  } catch {
    return null;
  }
}

async function setLastSyncTimestamp(
  table: string,
  timestamp: string
): Promise<void> {
  try {
    const stored = localStorage.getItem(SYNC_TIMESTAMPS_KEY);
    const timestamps = stored ? JSON.parse(stored) : {};
    timestamps[table] = timestamp;
    localStorage.setItem(SYNC_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch {
    // Ignorar errores de localStorage
  }
}

// ─── Estado de conectividad ───

/**
 * Verifica si hay conexión y sesión válida con Supabase.
 */
export async function checkSyncStatus(): Promise<{
  online: boolean;
  authenticated: boolean;
  pendingCount: number;
}> {
  const online = navigator.onLine;

  let authenticated = false;
  if (online) {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      authenticated = !!session;
    } catch {
      // Sin conexión real
    }
  }

  // Contar registros pendientes
  let pendingCount = 0;
  for (const table of SYNC_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTable = (db as any)[table.local];
      if (dexieTable) {
        const count = await dexieTable
          .where("sync_status")
          .equals("pending")
          .count();
        pendingCount += count;
      }
    } catch {
      // Tabla sin índice sync_status
    }
  }

  return { online, authenticated, pendingCount };
}
