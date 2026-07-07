import { db } from "@/lib/db";
import { createClient } from "./client";
import type { SyncStatus } from "@/lib/db/types";
import { logger } from "@/lib/logger";
import type { EntityTable } from "dexie";

type SyncableRecord = { id?: string; sync_status?: SyncStatus; [key: string]: unknown };

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
//  Estrategia: "Local-first con UPSERT por UUID"
//  1. PUSH: registros locales con sync_status="pending" → Supabase (upsert por id)
//  2. PULL: datos de Supabase → actualizar IndexedDB local
//
//  El ID local ES el ID remoto (UUID generado en el cliente).
//  No hay campo _remote_id — se eliminó la necesidad de mapeo.
// ============================================================

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: SyncError[];
  timestamp: string;
}

export interface SyncError {
  table: string;
  recordId: string;
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
  departamentos: "Departamentos",
  municipios: "Municipios",
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
  conv_levantamiento_setup: "Setup levantamiento",
  conv_mediciones: "Mediciones radiométricas Conv.",
  conv_inspeccion_items: "Inspección visual",
  conv_elementos_proteccion: "Elementos de protección",
  conv_raysafe_setup: "Setup RaySafe",
  conv_raysafe_mediciones: "Mediciones RaySafe",
  conv_cae_setup: "Setup CAE",
  conv_cae_mediciones: "Mediciones CAE",
  conv_ddi_mediciones: "Mediciones DDI/EI",
  conv_cassette_inspeccion: "Inspección cassettes",
  conv_uniformidad_cr: "Uniformidad CR",
  conv_colimacion: "Colimación",
  conv_uniformidad_detector: "Uniformidad detector",
  conv_resolucion: "Resolución espacial",
  conv_bajo_contraste: "Bajo contraste",
  conv_mtf: "MTF",
  conv_informe_secciones: "Secciones de informe",
  conv_resultados_prueba: "Resultados de pruebas Conv.",
  conv_evidencias: "Evidencias Conv.",
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

// Campos que solo existen en Dexie y NUNCA se envían a Supabase.
// blob_local y archivo_raysafe_blob: datos binarios que van a Storage por separado.
const LOCAL_ONLY_FIELDS = new Set([
  "sync_status",
  "last_modified",
  "blob_local",
  "archivo_raysafe_blob",
]);

// Campos extra por tabla que existen en Dexie pero no en Supabase
const EXTRA_LOCAL_FIELDS: Record<string, string[]> = {
  solicitudes: ["suitecrm_id"],
  prueba_resultados: [
    "grupo_resultado_id",
    "resultados_calculados",
    "evaluacion_criterios",
    "imagenes",
  ],
};

/** Prepara un registro Dexie para enviar a Supabase (quita campos locales) */
function prepareForRemote(
  record: Record<string, unknown>,
  localTable: string
): Record<string, unknown> {
  const exclude = new Set([...LOCAL_ONLY_FIELDS, ...(EXTRA_LOCAL_FIELDS[localTable] ?? [])]);
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (!exclude.has(key)) {
      data[key] = val;
    }
  }
  // Limpiar blob_local de imágenes anidadas (grupo_resultados, evidencias)
  if (Array.isArray(data.imagenes)) {
    data.imagenes = (data.imagenes as Record<string, unknown>[]).map(
      ({ blob_local: _b, ...rest }) => rest
    );
  }
  return data;
}

// Tablas de campo sincronizadas bidireccionalmente (tienen sync_status)
const SYNC_TABLES = [
  // ─── Maestras editables ───
  { local: "clientes", remote: "clientes" },
  { local: "contactos", remote: "contactos" },
  { local: "sedes", remote: "sedes" },
  { local: "ubicaciones_rx", remote: "ubicaciones_rx" },
  { local: "equipos", remote: "equipos" },
  { local: "tubos", remote: "tubos" },
  { local: "colimadores", remote: "colimadores" },
  { local: "gantry", remote: "gantry" },
  { local: "solicitudes", remote: "solicitudes" },
  // ─── Datos de campo ───
  { local: "visitas", remote: "visitas" },
  { local: "grupo_resultados", remote: "grupo_resultados" },
  { local: "prueba_resultados", remote: "prueba_resultados" },
  { local: "mediciones_radiometricas", remote: "mediciones_radiometricas" },
  { local: "evidencias", remote: "evidencias" },
  // ─── Convencional ───
  { local: "conv_levantamiento_setup", remote: "conv_levantamiento_setup" },
  { local: "conv_mediciones", remote: "conv_mediciones" },
  { local: "conv_inspeccion_items", remote: "conv_inspeccion_items" },
  { local: "conv_elementos_proteccion", remote: "conv_elementos_proteccion" },
  { local: "conv_raysafe_setup", remote: "conv_raysafe_setup" },
  { local: "conv_raysafe_mediciones", remote: "conv_raysafe_mediciones" },
  { local: "conv_cae_setup", remote: "conv_cae_setup" },
  { local: "conv_cae_mediciones", remote: "conv_cae_mediciones" },
  { local: "conv_ddi_mediciones", remote: "conv_ddi_mediciones" },
  { local: "conv_cassette_inspeccion", remote: "conv_cassette_inspeccion" },
  { local: "conv_uniformidad_cr", remote: "conv_uniformidad_cr" },
  { local: "conv_colimacion", remote: "conv_colimacion" },
  { local: "conv_uniformidad_detector", remote: "conv_uniformidad_detector" },
  { local: "conv_resolucion", remote: "conv_resolucion" },
  { local: "conv_bajo_contraste", remote: "conv_bajo_contraste" },
  { local: "conv_mtf", remote: "conv_mtf" },
  { local: "conv_informe_secciones", remote: "conv_informe_secciones" },
  { local: "conv_resultados_prueba", remote: "conv_resultados_prueba" },
  { local: "conv_evidencias", remote: "conv_evidencias" },
] as const;

// Tablas maestras que se descargan del servidor (read-only para sync)
const MASTER_TABLES = [
  "departamentos",
  "municipios",
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    result.errors.push({
      table: "_auth",
      recordId: "0",
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
        recordId: "0",
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
        recordId: "0",
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
        recordId: "0",
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
 * Push: enviar registros con sync_status="pending" al servidor via UPSERT.
 * El UUID local es el mismo que el remoto — no hay mapeo necesario.
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
    const localId = record.id as string;
    const data = prepareForRemote(record as Record<string, unknown>, localTable);

    try {
      const { error } = await supabase
        .from(remoteTable)
        .upsert(data, { onConflict: "id" });

      if (error) throw error;

      await dexieTable.update(localId, {
        sync_status: "synced" as SyncStatus,
        last_modified: new Date().toISOString(),
      });

      pushed++;
    } catch (err) {
      await dexieTable.update(localId, { sync_status: "error" as SyncStatus });

      const { message, detail } = describeError(err);
      errors.push({
        table: localTable,
        recordId: localId,
        error: `No se pudo enviar registro ${localId.slice(0, 8)}… de ${tableLabel(localTable)}: ${message}`,
        detail,
        action: "push",
      });
      logger.error("sync:push", `Error pushing ${localTable}#${localId}`, err);
    }
  }

  return { pushed, errors };
}

// ─── Push inmediato ───

/**
 * Push inmediato de un registro recién guardado.
 * Se llama desde los formularios justo después de guardar en Dexie.
 * No bloquea la UI — falla silenciosamente si está offline.
 */
export async function pushSingle(localTable: string, localId: string): Promise<boolean> {
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

    const data = prepareForRemote(record as Record<string, unknown>, localTable);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(remote) as any)
      .upsert(data, { onConflict: "id" });

    if (error) throw error;

    await dexieTable.update(localId, {
      sync_status: "synced" as SyncStatus,
      last_modified: new Date().toISOString(),
    });

    logger.info("sync:push-single", `${localTable}#${localId.slice(0, 8)} synced`);
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

  const lastSynced = await getLastSyncTimestamp(localTable);

  let query = supabase.from(remoteTable).select("*");
  if (lastSynced) {
    query = query.gt("last_modified", lastSynced);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let pulled = 0;
  for (const remoteRecord of data) {
    const localRecord = await dexieTable.get(remoteRecord.id);

    if (!localRecord) {
      await dexieTable.put({ ...remoteRecord, sync_status: "synced" as SyncStatus });
      pulled++;
    } else if (localRecord.sync_status === "synced") {
      await dexieTable.put({ ...remoteRecord, sync_status: "synced" as SyncStatus });
      pulled++;
    } else {
      // Conflicto: hay cambios locales pendientes — mantener versión local
      console.warn(
        `[Sync] Conflicto en ${localTable}#${remoteRecord.id} — manteniendo versión local`
      );
      await dexieTable.update(localRecord.id, { sync_status: "conflict" as SyncStatus });
    }
  }

  await setLastSyncTimestamp(localTable, new Date().toISOString());
  return pulled;
}

// ─── Timestamp tracking ───

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
  id: string;
  preview: string;
}

export async function getErrorRecords(): Promise<ErrorRecord[]> {
  const results: ErrorRecord[] = [];

  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const errored = await dexieTable.where("sync_status").equals("error").toArray();
      for (const rec of errored) {
        const id = (rec.id as string) ?? "";
        results.push({
          table: table.local,
          tableLabel: tableLabel(table.local),
          id,
          preview: String(
            rec.nombre_cliente ?? rec.nombre ?? rec.nombre_sede ?? rec.codigo ?? id.slice(0, 8)
          ),
        });
      }
    } catch {
      // tabla sin sync_status — ignorar
    }
  }

  return results;
}

export async function retryErrorRecords(): Promise<number> {
  let count = 0;
  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const errored = await dexieTable.where("sync_status").equals("error").toArray();
      for (const rec of errored) {
        await dexieTable.update(rec.id as string, { sync_status: "pending" as SyncStatus });
        count++;
      }
    } catch {
      // tabla sin sync_status — ignorar
    }
  }
  return count;
}

// ─── Estado de conectividad ───

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
