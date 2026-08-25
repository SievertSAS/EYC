import { db } from "@/lib/db";
import type { SyncRetry } from "@/lib/db/types";
import { logger } from "@/lib/logger";

// ============================================================
//  Retry con backoff exponencial para push fallido a Supabase.
//
//  delay(n) = min(60_000 * 4^(n-1), 3_600_000) ms, ±20% jitter aleatorio.
//  1 → ~1min, 2 → ~4min, 3 → ~16min, 4 → ~60min (tope), 5 → agota
//  el ciclo y el registro pasa a sync_status="failed" (terminal, sin
//  más reintentos automáticos — el técnico puede forzar uno manual
//  con `retryRecord`, ver sync-engine.ts).
// ============================================================

export const MAX_ATTEMPTS = 5;

const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 3_600_000;
const JITTER_RATIO = 0.2;

/** Códigos de error de Postgres/PostgREST que nunca se resuelven reintentando. */
const PERMANENT_ERROR_CODES = new Set([
  "23505", // unique_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation (invalid input syntax)
  "42703", // undefined_column (schema mismatch)
  "PGRST204", // PostgREST: columna no encontrada en el schema cache
  "42501", // insufficient_privilege (RLS)
]);

/**
 * Un código de error se considera permanente solo si está en la lista
 * explícita. Cualquier código desconocido/no mapeado, o la ausencia de
 * código, se trata como transitorio por defecto — preferimos reintentar
 * de más a fallar de más.
 */
export function isPermanent(code?: string): boolean {
  if (!code) return false;
  return PERMANENT_ERROR_CODES.has(code);
}

/**
 * Calcula el delay en ms para el intento `attempt` (1-based) con jitter
 * aleatorio de ±20% para evitar reintentos sincronizados entre clientes.
 */
export function computeBackoffDelayMs(attempt: number): number {
  const base = Math.min(BASE_DELAY_MS * 4 ** (attempt - 1), MAX_DELAY_MS);
  const jitterFactor = 1 + (Math.random() * 2 - 1) * JITTER_RATIO;
  return Math.round(base * jitterFactor);
}

function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(err);
}

/**
 * Registra un intento de push fallido para `table`#`id`.
 *
 * - Si está offline (`!navigator.onLine`), NO consume un intento — el
 *   fallo es de conectividad, no del registro, así que no debe gastar
 *   el presupuesto de reintentos.
 * - Si el código de error es permanente, marca "failed" directo en el
 *   intento 1 sin agotar el ciclo completo.
 * - Si se alcanza `MAX_ATTEMPTS`, marca "failed".
 * - En cualquier otro caso, programa el próximo intento con backoff
 *   exponencial + jitter y deja el status en "retrying".
 *
 * Devuelve el status final ("retrying" | "failed") para que el llamador
 * decida si debe reflejar sync_status="failed" en la tabla Dexie local.
 */
export async function recordFailure(
  table: string,
  id: string,
  error: unknown
): Promise<SyncRetry["status"]> {
  if (!navigator.onLine) {
    logger.warn("sync:retry", `Fallo offline en ${table}#${id} — no se cuenta como intento`, error);
    return "retrying";
  }

  const code = extractErrorCode(error);
  const message = extractErrorMessage(error);
  const now = new Date();

  const existing = await db.sync_retry.get([table, id]);
  const attempts = (existing?.attempts ?? 0) + 1;
  const permanent = isPermanent(code);
  const exhausted = attempts >= MAX_ATTEMPTS;
  const status: SyncRetry["status"] = permanent || exhausted ? "failed" : "retrying";

  const nextAttemptAt =
    status === "failed"
      ? now.toISOString()
      : new Date(now.getTime() + computeBackoffDelayMs(attempts)).toISOString();

  await db.sync_retry.put({
    table_name: table,
    record_id: id,
    attempts,
    next_attempt_at: nextAttemptAt,
    status,
    last_error: message,
    last_error_code: code,
    updated_at: now.toISOString(),
  });

  logger.warn(
    "sync:retry",
    `${table}#${id.slice(0, 8)} intento ${attempts}/${MAX_ATTEMPTS} — ${status}`,
    { code, message }
  );

  return status;
}

/** Push exitoso — borra la fila de seguimiento de reintentos, si existe. */
export async function recordSuccess(table: string, id: string): Promise<void> {
  await db.sync_retry.delete([table, id]);
}

/** Verdadero si ya llegó la hora programada del próximo intento. */
export function isDue(retry: Pick<SyncRetry, "next_attempt_at">): boolean {
  return new Date(retry.next_attempt_at).getTime() <= Date.now();
}
