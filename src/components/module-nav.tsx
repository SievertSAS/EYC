"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/components/db-provider";
import { getModuleStatuses, type ModuloStatus } from "@/lib/workflow/module-completeness";
import type { ModuloVisita } from "@/lib/equipos/types";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

// ============================================================
//  Navegación horizontal entre módulos de visita
//  Ahora recibe los módulos dinámicamente desde el EquipmentPackage
// ============================================================

/** Mapa de nombres de icono → componente Lucide */
const ICON_MAP: Record<string, LucideIcon> = {
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
};

/** Resuelve el icono de un módulo por su nombre string */
function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? FlaskConical;
}

interface ModuleNavProps {
  visitaId: number;
  currentModule: string;
  /** Módulos del paquete del equipo. Si no se pasa, usa los por defecto. */
  modulos?: ModuloVisita[];
}

const STATUS_DOTS: Record<ModuloStatus, { icon: React.ElementType; className: string }> = {
  sin_iniciar: { icon: Circle, className: "text-slate-300" },
  en_progreso: { icon: AlertCircle, className: "text-amber-500" },
  completado: { icon: CheckCircle2, className: "text-emerald-500" },
};

/** Módulos por defecto (fallback si no se pasan como prop) */
const DEFAULT_MODULOS: ModuloVisita[] = [
  {
    id: "condiciones",
    nombre: "Condiciones Ambientales",
    nombreCorto: "Condiciones",
    icon: "Thermometer",
    orden: 1,
    requerido: true,
  },
  {
    id: "levantamiento",
    nombre: "Levantamiento Radiométrico",
    nombreCorto: "Levantamiento",
    icon: "Gauge",
    orden: 2,
    requerido: true,
  },
  {
    id: "inspeccion",
    nombre: "Inspección Visual",
    nombreCorto: "Inspección",
    icon: "Eye",
    orden: 3,
    requerido: false,
  },
  {
    id: "pruebas",
    nombre: "Pruebas de Control de Calidad",
    nombreCorto: "Pruebas",
    icon: "FlaskConical",
    orden: 4,
    requerido: true,
  },
  {
    id: "evidencias",
    nombre: "Evidencias Fotográficas",
    nombreCorto: "Evidencias",
    icon: "Camera",
    orden: 5,
    requerido: false,
  },
  {
    id: "pre-informe",
    nombre: "Pre-Informe PDF",
    nombreCorto: "Pre-Informe",
    icon: "FileText",
    orden: 6,
    requerido: false,
    ruta: "pre-informe",
  },
];

export function ModuleNav({ visitaId, currentModule, modulos }: ModuleNavProps) {
  const { isReady } = useDb();
  const modulosToUse = modulos ?? DEFAULT_MODULOS;

  const statuses = useLiveQuery(async () => {
    if (!isReady) return null;
    return getModuleStatuses(visitaId);
  }, [isReady, visitaId]);

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
        {modulosToUse.map((mod) => {
          const ruta = mod.ruta ?? mod.id;
          const isCurrent = currentModule === mod.id;
          const status = statuses?.[mod.id] ?? "sin_iniciar";
          const StatusIcon = STATUS_DOTS[status].icon;
          const Icon = resolveIcon(mod.icon);

          return (
            <Link
              key={mod.id}
              href={`/dashboard/visitas/${visitaId}/${ruta}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0",
                isCurrent
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-slate-600 hover:bg-primary/5 border border-slate-200"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{mod.nombre}</span>
              <span className="sm:hidden">{mod.nombreCorto}</span>
              {!isCurrent && (
                <StatusIcon className={cn("w-3 h-3", STATUS_DOTS[status].className)} />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
