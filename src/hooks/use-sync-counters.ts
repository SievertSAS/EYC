"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { countSyncStatuses } from "@/lib/supabase/sync-engine";

/**
 * Hook reactivo que expone el indicador global de pendientes/errores
 * de sincronización. Envuelve `countSyncStatuses()` en `useLiveQuery`
 * para recalcularse automáticamente cuando cambian las tablas de Dexie
 * subyacentes (nuevo registro pending, push fallido marcado como error
 * o failed, reintento exitoso, etc.) sin necesidad de refrescar manual.
 */
export function useSyncCounters(): { pendingCount: number; errorCount: number } {
  const counters = useLiveQuery(() => countSyncStatuses(), []);

  return {
    pendingCount: counters?.pendingCount ?? 0,
    errorCount: counters?.errorCount ?? 0,
  };
}
