"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WifiOff, CloudUpload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useDb } from "@/components/db-provider";
import { useSyncCounters } from "@/hooks/use-sync-counters";
import { formatRelativeTime } from "@/lib/format-relative-time";

const LAST_SYNC_KEY = "ultima-sync-exitosa";

/**
 * Franja de estado de sincronización — reemplaza a `ConnectionBadge`.
 *
 * Solo se muestra sin conexión, con más de un cambio pendiente, o con
 * algún error — no en el camino feliz online con 0-1 pendientes, para no
 * parpadear ámbar→verde en cada guardado individual de un campo (mala
 * experiencia). El chip de error, cuando aplica, se muestra SIEMPRE en
 * paralelo a cualquier otro estado, nunca reemplazado por él — y el
 * timestamp de última sync exitosa se sigue guardando aunque la franja
 * esté oculta, para no perder ese rastro.
 */
export function SyncStatusBar() {
  const isOnline = useOnlineStatus();
  const { isReady, error } = useDb();
  const { pendingCount, errorCount } = useSyncCounters();

  const isSynced = isOnline && isReady && !error && pendingCount === 0 && errorCount === 0;

  // Efecto de solo-escritura (sin setState): persiste el timestamp cuando se
  // ENTRA al estado sincronizado. La lectura para mostrarlo va directo en el
  // render (más abajo) — evita el patrón "leer+guardar en estado" que dispara
  // renders en cascada y no hace falta acá, ya que este componente vuelve a
  // renderizar solo con que cambie cualquiera de sus 3 hooks reactivos.
  useEffect(() => {
    if (!isSynced) return;
    window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }, [isSynced]);

  const shouldShow = !!error || !isReady || !isOnline || pendingCount > 1 || errorCount > 0;
  if (!shouldShow) return null;

  const lastSync =
    typeof window === "undefined" ? null : window.localStorage.getItem(LAST_SYNC_KEY);

  let colorClasses: string;
  let icon: React.ReactNode;
  let label: string;

  if (error) {
    colorClasses = "bg-red-600 text-white";
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    label = "Error DB";
  } else if (!isReady) {
    colorClasses = "bg-slate-500 text-white";
    icon = <CloudUpload className="w-3.5 h-3.5 animate-pulse" />;
    label = "Cargando DB...";
  } else if (!isOnline) {
    colorClasses = "bg-red-600 text-white";
    icon = <WifiOff className="w-3.5 h-3.5" />;
    label =
      pendingCount > 0
        ? `Sin conexión — ${pendingCount} cambio${pendingCount !== 1 ? "s" : ""} sin subir`
        : "Sin conexión";
  } else if (pendingCount > 0) {
    colorClasses = "bg-amber-500 text-white";
    icon = <CloudUpload className="w-3.5 h-3.5 animate-pulse" />;
    label = `Sincronizando… quedan ${pendingCount}`;
  } else {
    colorClasses = "bg-emerald-600 text-white";
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    label = lastSync ? `Sincronizado · ${formatRelativeTime(lastSync)}` : "Sincronizado";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-30 h-9 flex items-center justify-between px-3 sm:px-4 ${colorClasses}`}
    >
      <Link
        href="/dashboard/sync"
        className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-90"
      >
        {icon}
        <span className="text-[11px] font-black uppercase tracking-widest truncate">{label}</span>
      </Link>

      {errorCount > 0 && (
        <Link
          href="/dashboard/sync"
          role="status"
          aria-live="assertive"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 flex-shrink-0 ml-3"
        >
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {errorCount} con error
          </span>
        </Link>
      )}
    </div>
  );
}
