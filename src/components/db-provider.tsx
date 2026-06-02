"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { db } from "@/lib/db";
import { seedPruebaDefiniciones } from "@/lib/db/seed";
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
            console.warn(
              "[DbProvider] DB desactualizada — cierra todas las pestañas y recarga"
            );
            setNeedsReload(true);
          }
        }

        await seedPruebaDefiniciones();
        setIsReady(true);
      } catch (err) {
        console.error("[DbProvider] Error al inicializar DB:", err);
        setError(err instanceof Error ? err.message : "Error desconocido en la DB");
      }
    }

    initDb();
  }, []);

  if (needsReload) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <div className="bg-amber-100 p-4 rounded-2xl">
          <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

  return <DbContext.Provider value={{ isReady, error, needsReload }}>{children}</DbContext.Provider>;
}
