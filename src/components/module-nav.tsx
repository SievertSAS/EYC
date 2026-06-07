"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/components/db-provider";
import { getModuleStatuses, type ModuleProgress } from "@/lib/workflow/module-completeness";
import { getDefaultModules } from "@/lib/equipos/registry";
import type { ModuloVisita } from "@/lib/equipos/types";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Gauge,
  FlaskConical,
  FileText,
  Target,
  Zap,
  MonitorCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

// ============================================================
//  Navegación horizontal entre módulos de visita
//  Recibe los módulos dinámicamente desde el EquipmentPackage
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Gauge,
  FlaskConical,
  FileText,
  Target,
  Zap,
  MonitorCheck,
  SlidersHorizontal,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? FlaskConical;
}

interface ModuleNavProps {
  visitaId: number;
  currentModule: string;
  modulos?: ModuloVisita[];
}

function NavBadge({ progress }: { progress: ModuleProgress }) {
  const color =
    progress.percentage === 100
      ? "text-emerald-500"
      : progress.percentage > 0
        ? "text-amber-500"
        : "text-slate-300";
  return <span className={`text-[10px] font-black ${color}`}>{progress.percentage}%</span>;
}

export function ModuleNav({ visitaId, currentModule, modulos }: ModuleNavProps) {
  const { isReady } = useDb();
  const modulosToUse = modulos ?? getDefaultModules();

  const statuses = useLiveQuery(async () => {
    if (!isReady) return null;
    return getModuleStatuses(visitaId);
  }, [isReady, visitaId]);

  return (
    <div className="mb-6">
      <Link
        href={`/dashboard/visitas/${visitaId}`}
        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary transition-colors mb-3"
      >
        <span>&larr;</span>
        <span>Workspace</span>
      </Link>

      <nav className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {modulosToUse.map((mod) => {
          const ruta = mod.ruta ?? mod.id;
          const isCurrent = currentModule === mod.id;
          const progress = statuses?.[mod.id] ?? { status: "sin_iniciar" as const, percentage: 0 };
          const Icon = resolveIcon(mod.icon);

          return (
            <Link
              key={mod.id}
              href={`/dashboard/visitas/${visitaId}/${ruta}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0",
                isCurrent
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-slate-600 hover:bg-primary/5 border border-slate-200",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mod.nombre}</span>
              <span className="sm:hidden">{mod.nombreCorto}</span>
              {!isCurrent && <NavBadge progress={progress} />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
