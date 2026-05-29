"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { seedPruebaDefiniciones } from "@/lib/db/seed";

interface DbContextValue {
  isReady: boolean;
  error: string | null;
}

const DbContext = createContext<DbContextValue>({
  isReady: false,
  error: null,
});

export function useDb() {
  return useContext(DbContext);
}

/**
 * Provider que inicializa la base de datos IndexedDB al montar.
 * - Ejecuta el seed del catálogo de pruebas (definiciones normativas)
 * - Los datos reales (clientes, técnicos, etc.) se sincronizan desde Supabase
 */
export function DbProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initDb() {
      try {
        await seedPruebaDefiniciones();
        setIsReady(true);
      } catch (err) {
        console.error("[DbProvider] Error al inicializar DB:", err);
        setError(
          err instanceof Error ? err.message : "Error desconocido en la DB"
        );
      }
    }

    initDb();
  }, []);

  return (
    <DbContext.Provider value={{ isReady, error }}>
      {children}
    </DbContext.Provider>
  );
}
