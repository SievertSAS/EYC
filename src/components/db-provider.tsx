"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { db } from "@/lib/db";
import { seedPruebaDefiniciones } from "@/lib/db/seed";
import { needsLocalReset, resetAndReopen } from "@/lib/db/recovery";
import { useAutoSync } from "@/hooks/use-auto-sync";

interface DbContextValue {
  isReady: boolean;
  error: string | null;
  needsReload: boolean;
}

const DbContext = createContext<DbContextValue>({
  isReady: false,
  error: null,
  needsReload: false,
});

export function useDb() {
  return useContext(DbContext);
}

/**
 * Provider que inicializa la base de datos IndexedDB al montar.
 * - Abre Dexie explícitamente para forzar migraciones
 * - Ejecuta el seed del catálogo de pruebas (definiciones normativas)
 * - Detecta si la DB está desactualizada y necesita recarga
 */
export function DbProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  // La migración de esquema no se puede aplicar sobre la DB local existente
  // (típico: v13, cambio de PK a UUID sobre una DB con datos previos).
  const [needsReset, setNeedsReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Auto-sync: push pendientes cada 5 min + al recuperar conexión
  useAutoSync();

  useEffect(() => {
    async function initDb() {
      try {
        // Abrir explícitamente para forzar upgrade de versión
        await db.open();

        // Verificar que la migración a v5 se aplicó (sync_status index en clientes)
        const idb = db.backendDB();
        if (idb) {
          const tx = idb.transaction("clientes", "readonly");
          const store = tx.objectStore("clientes");
          if (!store.indexNames.contains("sync_status")) {
            console.warn("[DbProvider] DB desactualizada — cierra todas las pestañas y recarga");
            setNeedsReload(true);
          }
        }

        await seedPruebaDefiniciones();
        setIsReady(true);
      } catch (err) {
        console.error("[DbProvider] Error al inicializar DB:", err);
        if (needsLocalReset(err)) {
          // db.open() no pudo migrar el esquema local. El único arreglo es
          // borrar el IndexedDB y re-sincronizar desde el servidor.
          setNeedsReset(true);
          return;
        }
        setError(err instanceof Error ? err.message : "Error desconocido en la DB");
      }
    }

    initDb();
  }, []);

  if (needsReset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <div className="bg-amber-100 p-4 rounded-2xl">
          <svg
            className="w-10 h-10 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900">Hay que actualizar los datos locales</h2>
        <p className="text-slate-500 font-medium max-w-md">
          Esta versión de la aplicación cambió la forma de guardar los datos y no puede migrar los
          que ya tenés en este dispositivo. Se van a borrar los datos locales y volver a descargar
          del servidor. Asegurate de haber sincronizado antes de continuar.
        </p>
        <button
          className="mt-2 px-6 py-3 bg-primary text-white font-black rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          disabled={resetting}
          onClick={async () => {
            setResetting(true);
            try {
              await resetAndReopen();
            } finally {
              window.location.reload();
            }
          }}
        >
          {resetting ? "Borrando…" : "Borrar datos locales y recargar"}
        </button>
      </div>
    );
  }

  if (needsReload) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <div className="bg-amber-100 p-4 rounded-2xl">
          <svg
            className="w-10 h-10 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900">Base de datos desactualizada</h2>
        <p className="text-slate-500 font-medium max-w-md">
          Hay una actualización pendiente. Cierra todas las demás pestañas de esta aplicación y
          luego recarga.
        </p>
        <button
          className="mt-2 px-6 py-3 bg-primary text-white font-black rounded-xl hover:bg-primary/90 transition-colors"
          onClick={() => window.location.reload()}
        >
          Recargar ahora
        </button>
      </div>
    );
  }

  return (
    <DbContext.Provider value={{ isReady, error, needsReload }}>{children}</DbContext.Provider>
  );
}
