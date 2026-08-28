"use client";

import { useEffect, useRef } from "react";
import { pullAllPending, pushAllPending } from "@/lib/supabase/sync-engine";
import { useOnlineStatus } from "./use-online-status";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
// Espera de conexión estable antes del primer ciclo tras reconectar —
// evita disparar sync en cada parpadeo de red (#21).
const RECONNECT_DEBOUNCE_MS = 3000;

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita solapar dos syncCycle si un tick del interval cae mientras el
  // anterior sigue corriendo (el lock lo cubre igual, pero así ni siquiera
  // se levanta un cliente Supabase de más).
  const runningRef = useRef(false);

  useEffect(() => {
    const clearAll = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      intervalRef.current = null;
      debounceRef.current = null;
    };

    if (!isOnline) {
      clearAll();
      return;
    }

    const runCycle = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await syncCycle();
      } finally {
        runningRef.current = false;
      }
    };

    // Al (re)conectar: esperar RECONNECT_DEBOUNCE_MS de conexión estable
    // antes del primer ciclo. Si isOnline vuelve a cambiar antes, el
    // cleanup limpia este timeout y no se dispara nada.
    debounceRef.current = setTimeout(() => {
      runCycle();
      intervalRef.current = setInterval(runCycle, SYNC_INTERVAL_MS);
    }, RECONNECT_DEBOUNCE_MS);

    return clearAll;
  }, [isOnline]);
}
