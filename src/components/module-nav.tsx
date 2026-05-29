"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/components/db-provider";
import { getModuleStatuses, type ModuloStatus } from "@/lib/workflow/module-completeness";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Building2,
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";

// ============================================================
//  Navegación horizontal entre módulos de visita
//  Tabs scrollables con indicador de completitud
// ============================================================

interface ModuleNavProps {
  visitaId: number;
  currentModule: string;
}

const MODULES = [
  { id: "condiciones", label: "Condiciones", shortLabel: "Cond.", icon: Thermometer, ruta: "condiciones" },
  { id: "levantamiento", label: "Levantamiento", shortLabel: "Lev.", icon: Gauge, ruta: "levantamiento" },
  { id: "inspeccion", label: "Inspección", shortLabel: "Insp.", icon: Eye, ruta: "inspeccion" },
  { id: "pruebas", label: "Pruebas", shortLabel: "Prueb.", icon: FlaskConical, ruta: "pruebas" },
  { id: "evidencias", label: "Evidencias", shortLabel: "Evid.", icon: Camera, ruta: "evidencias" },
  { id: "pre-informe", label: "Pre-Informe", shortLabel: "PDF", icon: FileText, ruta: "pre-informe" },
];

const STATUS_DOTS: Record<ModuloStatus, { icon: React.ElementType; className: string }> = {
  sin_iniciar: { icon: Circle, className: "text-slate-300" },
  en_progreso: { icon: AlertCircle, className: "text-amber-500" },
  completado: { icon: CheckCircle2, className: "text-emerald-500" },
};

export function ModuleNav({ visitaId, currentModule }: ModuleNavProps) {
  const { isReady } = useDb();

  const statuses = useLiveQuery(
    async () => {
      if (!isReady) return null;
      return getModuleStatuses(visitaId);
    },
    [isReady, visitaId]
  );

  return (
    <div className="mb-6">
      {/* Back to workspace */}
      <Link
        href={`/dashboard/visitas/${visitaId}`}
        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary transition-colors mb-3"
      >
        <span>&larr;</span>
        <span>Workspace</span>
      </Link>

      {/* Tabs */}
      <nav className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {MODULES.map((mod) => {
          const isCurrent = currentModule === mod.id;
          const status = statuses?.[mod.id] ?? "sin_iniciar";
          const StatusIcon = STATUS_DOTS[status].icon;
          const Icon = mod.icon;

          return (
            <Link
              key={mod.id}
              href={`/dashboard/visitas/${visitaId}/${mod.ruta}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0",
                isCurrent
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-slate-600 hover:bg-primary/5 border border-slate-200"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mod.label}</span>
              <span className="sm:hidden">{mod.shortLabel}</span>
              {!isCurrent && (
                <StatusIcon
                  className={cn("w-3 h-3", STATUS_DOTS[status].className)}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
