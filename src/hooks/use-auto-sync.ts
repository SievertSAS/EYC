"use client";

import { useEffect, useRef } from "react";
import { pullAllPending, pushAllPending } from "@/lib/supabase/sync-engine";
import { useOnlineStatus } from "./use-online-status";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Push de lo propio, después pull incremental de lo ajeno — en ese orden
 * y esperado (no en paralelo): ambos usan el mismo lock global
 * (`withSyncLock`), así que si se disparan sin esperar uno al otro, el
 * segundo se saltaría por lock ya tomado y este ciclo nunca haría pull.
 */
async function syncCycle() {
  await pushAllPending();
  await pullAllPending();
}

/**
 * Hook que ejecuta push + pull incremental automático cada 5 min. Solo
 * corre cuando hay conexión. Se pausa al perder red y retoma al
 * reconectarse.
 *
 * El pull es necesario acá, no solo el push: sin él, un dispositivo sin
 * cambios propios pendientes de subir nunca se entera de cambios que
 * hizo otro usuario (ej. una visita recién asignada) hasta que cierre y
 * reabra sesión, o dependa del Background Sync del navegador — no
 * soportado en Safari/iOS/Firefox y con timing no garantizado en Chrome.
 */
export function useAutoSync() {
  const isOnline = useOnlineStatus();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Ciclo inmediato al recuperar conexión
    syncCycle();

    timerRef.current = setInterval(() => {
      syncCycle();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOnline]);
}
