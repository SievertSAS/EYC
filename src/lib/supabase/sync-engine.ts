import { db } from "@/lib/db";
import { createClient } from "./client";
import type { SyncStatus } from "@/lib/db/types";
import { logger } from "@/lib/logger";
import type { EntityTable } from "dexie";
import { isDue, recordFailure, recordSuccess } from "./sync-retry";
import { withSyncLock } from "./sync-lock";

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
  equipo_movimientos: "Traslados de equipo",
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
  { local: "equipo_movimientos", remote: "equipo_movimientos" },
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
 * Ejecuta un ciclo completo de sincronización, protegido por
 * `withSyncLock` (single-flight — ver sync-lock.ts) para evitar que
 * dos disparadores (botón manual, auto-sync, mensaje del Service
 * Worker a otra pestaña) corran fullSync al mismo tiempo.
 *
 * Si ya hay una sincronización en curso, el ciclo se omite y se
 * refleja como un error `_lock` en `result.errors` — mismo patrón que
 * el error `_auth` cuando no hay sesión — sin romper el contrato de
 * retorno `SyncResult` que ya consumen los callers existentes.
 */
export async function fullSync(): Promise<SyncResult> {
  const lockResult = await withSyncLock(runFullSync);
  if (!lockResult.ran) {
    logger.info("sync:lock", "fullSync omitido: ya hay una sincronización en curso");
    return {
      pushed: 0,
      pulled: 0,
      errors: [
        {
          table: "_lock",
          recordId: "0",
          error: "Sincronización omitida: ya hay otra sincronización en curso",
          action: "push",
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
  return lockResult.value;
}

async function runFullSync(): Promise<SyncResult> {
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

    // Un registro con retry programado no se vuelve a pushear en el
    // ciclo automático hasta que llegue su `next_attempt_at` — evita
    // martillar el backend con el mismo error en cada ciclo de sync.
    const retry = await db.sync_retry.get([localTable, localId]);
    if (retry && !isDue(retry)) continue;

    const data = prepareForRemote(record as Record<string, unknown>, localTable);

    try {
      const { error } = await supabase.from(remoteTable).upsert(data, { onConflict: "id" });

      if (error) throw error;

      await dexieTable.update(localId, {
        sync_status: "synced" as SyncStatus,
        last_modified: new Date().toISOString(),
      });
      await recordSuccess(localTable, localId);

      pushed++;
    } catch (err) {
      const finalStatus = await recordFailure(localTable, localId, err);
      if (finalStatus === "failed") {
        await dexieTable.update(localId, { sync_status: "failed" as SyncStatus });
      }

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

    // Igual que en pushTable: si hay un retry programado en el futuro,
    // no reintentar todavía — el técnico puede forzarlo con retryRecord.
    const retry = await db.sync_retry.get([localTable, localId]);
    if (retry && !isDue(retry)) return false;

    const data = prepareForRemote(record as Record<string, unknown>, localTable);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(remote) as any).upsert(data, { onConflict: "id" });

    if (error) throw error;

    await dexieTable.update(localId, {
      sync_status: "synced" as SyncStatus,
      last_modified: new Date().toISOString(),
    });
    await recordSuccess(localTable, localId);

    logger.info("sync:push-single", `${localTable}#${localId.slice(0, 8)} synced`);
    return true;
  } catch (err) {
    const finalStatus = await recordFailure(localTable, localId, err);
    if (finalStatus === "failed") {
      const dexieTable = getDexieTable(localTable);
      if (dexieTable) await dexieTable.update(localId, { sync_status: "failed" as SyncStatus });
    }
    logger.warn("sync:push-single", `${localTable}#${localId} failed (will retry)`, err);
    return false;
  }
}

/**
 * Actualiza un registro local Y lo marca para re-sincronizar en el mismo
 * paso — evita el bug de "el update queda con sync_status viejo y nunca
 * se vuelve a subir" (ver incidente de datos perdidos en Grupo A). Reusá
 * esto en vez de llamar db.tabla.update(...) directo en cualquier módulo
 * de captura.
 */
export async function updateAndSync(
  localTable: string,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const dexieTable = getDexieTable(localTable);
  if (!dexieTable) return;

  const updated = await dexieTable.update(id, {
    ...patch,
    sync_status: "pending" as SyncStatus,
    last_modified: new Date().toISOString(),
  });
  if (!updated) return;

  await pushSingle(localTable, id);
}

/**
 * Reintento manual de un registro puntual — se salta el schedule de
 * backoff de `sync_retry` y fuerza el push inmediato. Pensado para que
 * el técnico de campo pueda reintentar un registro "failed" sin esperar
 * al próximo ciclo automático ni depender de un rol de coordinador.
 */
export async function retryRecord(localTable: string, localId: string): Promise<void> {
  const result = await withSyncLock(() => retryRecordUnlocked(localTable, localId));

  if (!result.ran) {
    // Ya hay otra sincronización en curso (reintento automático de backoff,
    // fullSync o pushAllPending) — el técnico puede volver a tocar el botón
    // si hace falta. No es un error: el lock permite solo un intento, este
    // se salta.
    logger.info(
      "sync:retry-record",
      `${localTable}#${localId.slice(0, 8)} reintento manual omitido (sync en curso)`
    );
  }
}

async function retryRecordUnlocked(localTable: string, localId: string): Promise<void> {
  const remote = SYNC_TABLES.find((t) => t.local === localTable)?.remote;
  if (!remote) return;

  const dexieTable = getDexieTable(localTable);
  if (!dexieTable) return;

  const record = await dexieTable.get(localId);
  if (!record) return;

  try {
    const supabase = createClient();
    const data = prepareForRemote(record as Record<string, unknown>, localTable);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(remote) as any).upsert(data, { onConflict: "id" });

    if (error) throw error;

    await dexieTable.update(localId, {
      sync_status: "synced" as SyncStatus,
      last_modified: new Date().toISOString(),
    });
    await recordSuccess(localTable, localId);

    logger.info(
      "sync:retry-record",
      `${localTable}#${localId.slice(0, 8)} synced (reintento manual)`
    );
  } catch (err) {
    const finalStatus = await recordFailure(localTable, localId, err);
    if (finalStatus === "failed") {
      await dexieTable.update(localId, { sync_status: "failed" as SyncStatus });
    }
    logger.warn("sync:retry-record", `${localTable}#${localId} reintento manual falló`, err);
  }
}

/**
 * Push de todos los registros pendientes (sin pull).
 * Usado por el auto-sync periódico — más liviano que fullSync.
 *
 * Protegido por `withSyncLock` (single-flight — ver sync-lock.ts) para
 * no correr en paralelo con otro pushAllPending o con fullSync. Si ya
 * hay una sincronización en curso, se omite este ciclo — mismo shape
 * de retorno que el caso offline (`{ pushed: 0, errors: 0 }`), solo
 * distinguible por el log emitido.
 */
export async function pushAllPending(): Promise<{ pushed: number; errors: number }> {
  const lockResult = await withSyncLock(runPushAllPending);
  if (!lockResult.ran) {
    logger.info("sync:lock", "pushAllPending omitido: ya hay una sincronización en curso");
    return { pushed: 0, errors: 0 };
  }
  return lockResult.value;
}

async function runPushAllPending(): Promise<{ pushed: number; errors: number }> {
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

  // PostgREST trunca silenciosamente las respuestas a `max_rows` (config.toml)
  // sin devolver error, asi que paginamos con .range() ordenando por id para
  // garantizar cobertura completa y determinista entre paginas.
  const PAGE_SIZE = 500;
  const allData: SyncableRecord[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (allData.length === 0) return 0;

  await dexieTable.bulkPut(allData);
  return allData.length;
}

const SYNC_PAGE_SIZE = 500;

/**
 * Aplica un registro remoto individual al Dexie local, resolviendo el
 * conflicto si hay cambios locales pendientes (cualquier sync_status
 * distinto de "synced" se trata como cambio local sin confirmar).
 * Devuelve 1 si el registro se escribió como "synced", 0 si fue conflicto.
 */
async function applyRemoteSyncRecord(
  dexieTable: EntityTable<SyncableRecord, "id">,
  localTable: string,
  remoteRecord: SyncableRecord
): Promise<number> {
  const localRecord = await dexieTable.get(remoteRecord.id as string);

  if (!localRecord || localRecord.sync_status === "synced") {
    await dexieTable.put({ ...remoteRecord, sync_status: "synced" as SyncStatus });
    return 1;
  }

  // Conflicto: hay cambios locales pendientes — mantener versión local
  logger.warn(
    "sync:pull",
    `Conflicto en ${localTable}#${remoteRecord.id} — manteniendo versión local`
  );
  await dexieTable.update(localRecord.id as string, { sync_status: "conflict" as SyncStatus });
  return 0;
}

/**
 * Recorre todas las páginas de una tabla de sincronización usando keyset
 * pagination por `id` (no offset: un offset puede saltear filas si se
 * insertan registros nuevos durante el pull). El filtro incremental
 * `.gt("last_modified", lastSynced)` se mantiene fijo en cada página.
 *
 * Se detiene al recibir una página más corta que SYNC_PAGE_SIZE. Si
 * cualquier página falla, la excepción se propaga sin procesar el resto —
 * las páginas ya procesadas quedan persistidas en Dexie, pero el llamador
 * NO debe avanzar el watermark de sync_meta en ese caso.
 */
async function pullSyncPages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  dexieTable: EntityTable<SyncableRecord, "id">,
  localTable: string,
  remoteTable: string,
  lastSynced: string | null
): Promise<number> {
  let pulled = 0;
  let cursor: string | null = null;

  for (;;) {
    let query = supabase.from(remoteTable).select("*");
    if (lastSynced) {
      query = query.gt("last_modified", lastSynced);
    }
    if (cursor) {
      query = query.gt("id", cursor);
    }
    query = query.order("id", { ascending: true }).limit(SYNC_PAGE_SIZE);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const remoteRecord of data as SyncableRecord[]) {
      pulled += await applyRemoteSyncRecord(dexieTable, localTable, remoteRecord);
    }

    cursor = data[data.length - 1].id as string;
    if (data.length < SYNC_PAGE_SIZE) break;
  }

  return pulled;
}

/**
 * Pull tabla de sincronización: solo registros modificados después
 * de la última sync local, paginando por keyset (`id`) para no perder
 * filas cuando la tabla supera el límite `max_rows` de PostgREST.
 */
export async function pullSyncTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  localTable: string,
  remoteTable: string
): Promise<number> {
  const dexieTable = getDexieTable(localTable);
  if (!dexieTable) return 0;

  const lastSynced = await getLastSyncTimestamp(localTable);
  // El watermark se captura ANTES de paginar: cualquier registro modificado
  // mientras el pull está en curso quedará cubierto en la próxima sync.
  const pullStartedAt = new Date().toISOString();

  const pulled = await pullSyncPages(supabase, dexieTable, localTable, remoteTable, lastSynced);

  // Solo se persiste el watermark si TODAS las páginas se procesaron sin
  // error — si pullSyncPages lanza, esta línea nunca se alcanza.
  await setLastSyncTimestamp(localTable, pullStartedAt);
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

// ─── Diagnóstico de registros (errores y pendientes) ───

export interface SyncRecordPreview {
  table: string;
  tableLabel: string;
  id: string;
  preview: string;
  /**
   * "pending": en cola normal, aún no se intentó o espera su próximo
   * ciclo de sync. "error": recuperable por el ciclo automático —
   * `retryErrorRecords()` lo vuelve a poner en "pending". "failed": agotó
   * `MAX_ATTEMPTS` o tuvo un error permanente (ver sync-retry.ts) — es
   * terminal, solo se reintenta manualmente con `retryRecord(table, id)`.
   */
  status: "pending" | "error" | "failed";
  /** Intentos consumidos, si el registro tiene fila en `sync_retry` */
  attempts?: number;
  /** Próximo intento automático programado, si aplica */
  nextAttemptAt?: string;
}

/** Alias retrocompatible — `getErrorRecords()` sigue devolviendo este tipo. */
export type ErrorRecord = SyncRecordPreview;

/** Arma el preview de un registro (tabla + retry info) para error/pending lists */
async function buildRecordPreview(
  localTable: string,
  rec: SyncableRecord
): Promise<SyncRecordPreview> {
  const id = (rec.id as string) ?? "";
  const retry = await db.sync_retry.get([localTable, id]);
  return {
    table: localTable,
    tableLabel: tableLabel(localTable),
    id,
    preview: String(
      rec.nombre_cliente ?? rec.nombre ?? rec.nombre_sede ?? rec.codigo ?? id.slice(0, 8)
    ),
    status: rec.sync_status as "pending" | "error" | "failed",
    attempts: retry?.attempts,
    nextAttemptAt: retry?.next_attempt_at,
  };
}

export async function getErrorRecords(): Promise<ErrorRecord[]> {
  const results: ErrorRecord[] = [];

  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const errored = await dexieTable.where("sync_status").anyOf(["error", "failed"]).toArray();
      for (const rec of errored) {
        results.push(await buildRecordPreview(table.local, rec));
      }
    } catch {
      // tabla sin sync_status — ignorar
    }
  }

  return results;
}

/**
 * Registros en cola normal de sincronización (`sync_status === "pending"`).
 * Mismo shape que `getErrorRecords()` — no fallaron, solo esperan su turno
 * (o su `next_attempt_at` si ya tuvieron un intento previo fallido antes
 * de volver a "pending" vía `retryErrorRecords()`).
 */
export async function getPendingRecords(): Promise<SyncRecordPreview[]> {
  const results: SyncRecordPreview[] = [];

  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      const pending = await dexieTable.where("sync_status").equals("pending").toArray();
      for (const rec of pending) {
        results.push(await buildRecordPreview(table.local, rec));
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

// ─── Contadores globales de pendientes/errores ───

/**
 * Cuenta, entre todas las `SYNC_TABLES`, cuántos registros están en
 * `sync_status="pending"` y cuántos en `"error"` o `"failed"` (juntos,
 * en `errorCount`). Usa `.count()` indexado de Dexie — nunca
 * `.toArray().length` — para no traer los registros completos solo
 * para contarlos. Base de `useSyncCounters()` (indicador global en la
 * UI) y reutilizable para diagnóstico fuera de React.
 */
export async function countSyncStatuses(): Promise<{ pendingCount: number; errorCount: number }> {
  let pendingCount = 0;
  let errorCount = 0;

  for (const table of SYNC_TABLES) {
    try {
      const dexieTable = getDexieTable(table.local);
      if (!dexieTable) continue;

      pendingCount += await dexieTable.where("sync_status").equals("pending").count();
      errorCount += await dexieTable.where("sync_status").equals("error").count();
      errorCount += await dexieTable.where("sync_status").equals("failed").count();
    } catch (err) {
      logger.error("sync:counters", `Error contando registros en ${table.local}`, err);
    }
  }

  return { pendingCount, errorCount };
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

  const { pendingCount, errorCount } = await countSyncStatuses();

  return { online, authenticated, pendingCount, errorCount };
}
