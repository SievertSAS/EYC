"use client";

import { use, useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { logger } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateTimeline } from "@/components/state-timeline";
import { VisitActionBar } from "@/components/visit-action-bar";
import { InfoModulo } from "@/components/visita-modulos/info-modulo";
import { GrupoAModulo } from "@/components/visita-modulos/grupo-a-modulo";
import { GrupoBModulo } from "@/components/visita-modulos/grupo-b-modulo";
import { GrupoCModulo } from "@/components/visita-modulos/grupo-c-modulo";
import { GrupoDModulo } from "@/components/visita-modulos/grupo-d-modulo";
import { GrupoEModulo } from "@/components/visita-modulos/grupo-e-modulo";
import { PreInformeModulo } from "@/components/visita-modulos/pre-informe-modulo";
import { irAModulo } from "@/lib/modulo-nav";
import {
  getModuleStatuses,
  getVisitCompleteness,
  type ModuleProgress,
} from "@/lib/workflow/module-completeness";
import { ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";
import { crearInformeDesdeVisita } from "@/lib/workflow/informe-service";
import { publicarVersionOficial } from "@/lib/workflow/publicar-informe";
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
  ShieldAlert,
  MessageSquareWarning,
  ClipboardList,
  Target,
  Zap,
  MonitorCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

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

/** Componente de cada módulo, mostrado dentro del workspace sin navegación de Next (offline-safe) */
const MODULO_COMPONENTS: Record<string, ComponentType<{ visitaId: string }>> = {
  info: InfoModulo,
  "grupo-a": GrupoAModulo,
  "grupo-b": GrupoBModulo,
  "grupo-c": GrupoCModulo,
  "grupo-d": GrupoDModulo,
  "grupo-e": GrupoEModulo,
  "pre-informe": PreInformeModulo,
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
  // Fuente de verdad del id: se deriva de window.location.pathname en vez de
  // confiar ciegamente en `params`. Offline, el Service Worker puede servir
  // el documento de la plantilla genérica de OTRA visita (ver public/sw.js)
  // cuando la ruta nunca fue cacheada; ese documento trae embebido el `id`
  // de params de la visita original, que no corresponde a la URL real. Usar
  // el id de la URL evita cargar/editar offline los datos de la visita
  // equivocada (crítico por cumplimiento regulatorio de radioprotección).
  const visitaId = useMemo(() => {
    if (typeof window === "undefined") return id;
    const urlId = window.location.pathname.split("/").pop();
    if (urlId && urlId !== id) {
      logger.warn(
        "VisitaWorkspacePage",
        "El id de params no coincide con el id de la URL; se usa el de la URL",
        { paramsId: id, urlId, pathname: window.location.pathname }
      );
      return urlId;
    }
    return urlId || id;
  }, [id]);
  const { isReady } = useDb();
  const { role } = useRole();
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const searchParams = useSearchParams();
  const moduloParam = searchParams.get("modulo");

  const data = useLiveQuery(async () => {
    if (!isReady || !visitaId) return null;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
    const ubicacion = visita.ubicacion_id
      ? await db.ubicaciones_rx.get(visita.ubicacion_id)
      : undefined;
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
    const sede = ubicacion
      ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? "")
      : undefined;
    const informe = await db.informes.where("visita_id").equals(visitaId).first();

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
      informe,
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
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- navegación dura intencional (ver src/lib/visita-nav.ts): permite offline vía Service Worker */}
        <a
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a visitas
        </a>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  const { visita, equipo, ubicacion, sede, cliente, informe, moduleStatuses, completeness } = data;
  const estadoConfig = ESTADO_CONFIG[visita.estado_visita];
  const isLocked = visita.estado_visita === "asignada";
  const hasRevisionNotes =
    visita.observaciones_revision && visita.estado_visita === "en_progreso" && visita.devuelto_en;
  const faltaInforme =
    (visita.estado_visita === "aprobada" || visita.estado_visita === "enviada") && !informe;

  async function handleGenerarInforme() {
    if (!role) return;
    setGenerandoInforme(true);
    try {
      const nuevoInforme = await crearInformeDesdeVisita(
        visitaId,
        role.usuarioId,
        visita.tecnico_id ?? role.usuarioId
      );
      if (nuevoInforme.id) {
        await publicarVersionOficial(nuevoInforme.id, visitaId);
      }
    } catch (err) {
      console.error("[Visita] Error al generar el informe faltante:", err);
    } finally {
      setGenerandoInforme(false);
    }
  }

  // Módulos dinámicos del paquete del equipo
  const packageModulos = equipo?.tipo_equipo ? getModules(equipo.tipo_equipo) : getDefaultModules();
  // Prepend info module + package modules
  const MODULOS = [INFO_MODULE, ...packageModulos];

  // Módulo seleccionado vía ?modulo= — se renderiza dentro del workspace sin
  // navegación de Next.js, para que el cambio entre módulos funcione offline.
  const moduloSeleccionado =
    moduloParam &&
    MODULOS.some((m) => m.id === moduloParam) &&
    !(isLocked && moduloParam !== "info")
      ? MODULO_COMPONENTS[moduloParam]
      : undefined;

  if (moduloSeleccionado) {
    const ModuloComponent = moduloSeleccionado;
    return <ModuloComponent visitaId={visitaId} />;
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Navegación */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- navegación dura intencional (ver src/lib/visita-nav.ts): permite offline vía Service Worker */}
      <a
        href="/dashboard/visitas"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a visitas
      </a>

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

      {/* Banner: informe faltante (visita aprobada/enviada sin registro de informe) */}
      {faltaInforme && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-black text-amber-800">
              Esta visita no tiene un informe generado
            </span>
          </div>
          <p className="text-sm text-amber-700 font-medium ml-7">
            Puede pasar si se aprobó antes de que existiera este control. Genera el informe (con QR
            de verificación) para que quede disponible en la hoja de vida del equipo.
          </p>
          <div className="ml-7">
            <Button
              onClick={handleGenerarInforme}
              disabled={generandoInforme}
              size="sm"
              className="rounded-xl font-black bg-amber-600 hover:bg-amber-700 text-white"
            >
              {generandoInforme ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4 mr-2" />
              )}
              Generar informe
            </Button>
          </div>
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
          {visita.estado_visita !== "asignada" &&
            visita.estado_visita !== "aprobada" &&
            visita.estado_visita !== "enviada" && (
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
              <button
                key={modulo.id}
                type="button"
                onClick={() => irAModulo(visitaId, modulo.id)}
                className="text-left w-full"
              >
                {cardContent}
              </button>
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
        progressText={
          visita.estado_visita === "en_progreso"
            ? `${completeness.completed}/${completeness.total} módulos completados`
            : undefined
        }
      />
    </div>
  );
}
