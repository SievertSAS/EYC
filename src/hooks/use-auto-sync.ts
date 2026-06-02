"use client";

import { useEffect, useRef } from "react";
import { pushAllPending } from "@/lib/supabase/sync-engine";
import { useOnlineStatus } from "./use-online-status";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Hook que ejecuta push automático de registros pendientes cada 5 min.
 * Solo corre cuando hay conexión. Se pausa al perder red y retoma al reconectarse.
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

    // Push inmediato al recuperar conexión
    pushAllPending();

    timerRef.current = setInterval(() => {
      pushAllPending();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOnline]);
}
