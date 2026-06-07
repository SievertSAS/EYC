"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StateTimeline } from "@/components/state-timeline";
import { VisitActionBar } from "@/components/visit-action-bar";
import {
  getModuleStatuses,
  getVisitCompleteness,
  type ModuleProgress,
} from "@/lib/workflow/module-completeness";
import { ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";
import { getModules, getDefaultModules } from "@/lib/equipos/registry";
import type { ModuloVisita } from "@/lib/equipos/types";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Radio,
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
  Loader2,
  AlertCircle,
  Lock,
  MessageSquareWarning,
  ClipboardList,
  Target,
  Zap,
  MonitorCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

/** Mapa de nombres de icono → componente Lucide */
const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
  ClipboardList,
  Target,
  Zap,
  MonitorCheck,
  SlidersHorizontal,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? FlaskConical;
}

/** Módulo de info general (siempre presente, es readonly) */
const INFO_MODULE = {
  id: "info",
  nombre: "Información General",
  nombreCorto: "Info",
  icon: "Building2",
  orden: 0,
  requerido: false,
  ruta: "info",
  descripcion: "Datos del cliente, sede, equipo",
  tipo: "readonly" as const,
};

function PercentBadge({ value }: { value: number }) {
  const color =
    value === 100
      ? "bg-emerald-100 text-emerald-700"
      : value > 0
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-400";
  return (
    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${color}`}>{value}%</span>
  );
}

export default function VisitaWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const { role } = useRole();
  const router = useRouter();

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
    const ubicacion = visita.ubicacion_id
      ? await db.ubicaciones_rx.get(visita.ubicacion_id)
      : undefined;
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
    const sede = ubicacion
      ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? 0)
      : undefined;

    // Module statuses y completitud
    const moduleStatuses = await getModuleStatuses(visitaId);
    const completeness = await getVisitCompleteness(visitaId);

    return {
      visita,
      equipo,
      ubicacion,
      sede,
      cliente,
      solicitud,
      moduleStatuses,
      completeness,
    };
  }, [isReady, visitaId]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando visita...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a visitas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  const { visita, equipo, ubicacion, sede, cliente, moduleStatuses, completeness } = data;
  const estadoConfig = ESTADO_CONFIG[visita.estado_visita];
  const isLocked = visita.estado_visita === "asignada";
  const hasRevisionNotes =
    visita.observaciones_revision && visita.estado_visita === "en_progreso" && visita.devuelto_en;

  // Módulos dinámicos del paquete del equipo
  const packageModulos = equipo?.tipo_equipo ? getModules(equipo.tipo_equipo) : getDefaultModules();
  // Prepend info module + package modules
  const MODULOS = [INFO_MODULE, ...packageModulos];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Navegación */}
      <Link
        href="/dashboard/visitas"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a visitas
      </Link>

      {/* Banner de devolución del ingeniero */}
      {hasRevisionNotes && (
        <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-black text-amber-800">
              Devuelta por el ingeniero revisor
            </span>
          </div>
          <p className="text-sm text-amber-700 font-medium ml-7">{visita.observaciones_revision}</p>
        </div>
      )}

      {/* Header con info del servicio */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {cliente?.nombre_cliente ?? "Sin cliente"}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {sede?.ciudad} — {ubicacion?.nombre_servicio}
                </span>
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  {equipo?.gen_marca} {equipo?.gen_modelo} (
                  {equipo?.tipo_equipo?.replace(/_/g, " ")})
                </span>
              </div>
            </div>
            <Badge
              className={`${estadoConfig.bgColor} ${estadoConfig.color} ${estadoConfig.borderColor} rounded-full text-[10px] font-black uppercase tracking-widest hover:${estadoConfig.bgColor}`}
            >
              {estadoConfig.label}
            </Badge>
          </div>

          {/* Info rápida */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
              NIT: {cliente?.nit}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
              Hab: {ubicacion?.codigo_habilitacion ?? "—"}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
              Visita: {visita.fecha_visita ?? "Sin fecha"}
            </span>
          </div>

          {/* Timeline de estado */}
          <StateTimeline currentState={visita.estado_visita} />

          {/* Barra de progreso */}
          {visita.estado_visita !== "asignada" && visita.estado_visita !== "aprobada" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Progreso
                </span>
                <span className="text-xs font-black text-slate-600">
                  {completeness.completed}/{completeness.total} módulos
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completeness.percentage}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Módulos del workspace */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-4">
          Módulos de captura
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {MODULOS.map((modulo) => {
            const progress = moduleStatuses[modulo.id] ?? {
              status: "sin_iniciar" as const,
              percentage: 0,
            };
            const Icon = resolveIcon(modulo.icon);
            const ruta = modulo.ruta ?? modulo.id;
            const locked = isLocked && modulo.id !== "info";

            const cardContent = (
              <Card
                className={`border-none shadow-sm transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group overflow-hidden ${
                  locked ? "opacity-60 cursor-not-allowed" : "hover:shadow-lg cursor-pointer"
                }`}
              >
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl flex-shrink-0 ${
                          locked ? "bg-slate-100" : "bg-primary/10"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${locked ? "text-slate-400" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {modulo.nombre}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {(modulo as { descripcion?: string }).descripcion ?? modulo.nombreCorto}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {locked ? (
                        <Lock className="w-4 h-4 text-slate-300" />
                      ) : (
                        <>
                          <PercentBadge value={progress.percentage} />
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            return locked ? (
              <div key={modulo.id}>{cardContent}</div>
            ) : (
              <Link key={modulo.id} href={`/dashboard/visitas/${id}/${ruta}`}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Barra de acciones */}
      <VisitActionBar
        visitaId={visitaId}
        estadoVisita={visita.estado_visita}
        onTransition={() => {
          // useLiveQuery se actualiza automáticamente
        }}
        onGenerarPreInforme={() => {
          router.push(`/dashboard/visitas/${id}/pre-informe`);
        }}
        progressText={
          visita.estado_visita === "en_progreso"
            ? `${completeness.completed}/${completeness.total} módulos completados`
            : undefined
        }
      />
    </div>
  );
}
