"use client";

import { useEffect, useState, useCallback } from "react";
import { fullSync } from "@/lib/supabase/sync-engine";
import { logger } from "@/lib/logger";

// ============================================================
//  Registro del Service Worker + banner de actualización
//  + background sync trigger
//  Se monta una sola vez en el layout raíz
// ============================================================

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const handleSWMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "SYNC_REQUESTED") {
      logger.info("sync:background", "Background sync triggered by SW");
      fullSync().catch((err) => logger.error("sync:background", "Background sync failed", err));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registrado:", reg.scope);
        setRegistration(reg);

        // Detectar actualizaciones
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((err) => {
        console.error("[PWA] Error registrando SW:", err);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    const handleOnline = () => {
      requestBackgroundSync();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      window.removeEventListener("online", handleOnline);
    };
  }, [handleSWMessage]);

  function handleUpdate() {
    if (registration?.waiting) {
      // Decirle al SW en espera que tome control
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    setUpdateAvailable(false);
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white border border-primary/20 shadow-2xl rounded-2xl p-4 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">Nueva versión disponible</p>
          <p className="text-[11px] text-slate-500 font-medium">Actualiza para obtener mejoras</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      await (
        reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }
      ).sync.register("sync-pending-data");
    }
  } catch {
    // Background Sync API not supported or permission denied — silent fallback
  }
}
