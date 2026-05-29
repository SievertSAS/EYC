"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useDb } from "@/components/db-provider";

/**
 * Badge que muestra el estado de conexión y de la base de datos local.
 */
export function ConnectionBadge() {
  const isOnline = useOnlineStatus();
  const { isReady, error } = useDb();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Estado de red */}
      {isOnline ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200">
          <Wifi className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
            En línea
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200">
          <WifiOff className="w-3 h-3 text-amber-700" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
            Sin conexión
          </span>
        </div>
      )}

      {/* Estado de DB */}
      {error ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 border border-red-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
            Error DB
          </span>
        </div>
      ) : isReady ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            DB lista
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cargando DB...
          </span>
        </div>
      )}
    </div>
  );
}
