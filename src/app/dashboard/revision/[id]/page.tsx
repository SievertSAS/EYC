"use client";

import { use, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateTimeline } from "@/components/state-timeline";
import { ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";
import { executeTransition } from "@/lib/workflow/visit-state-machine";
import { getVisitCompleteness } from "@/lib/workflow/module-completeness";
import { crearInformeDesdeVisita } from "@/lib/workflow/informe-service";
import {
  ArrowLeft,
  MapPin,
  Radio,
  Building2,
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  User,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  BadgeCheck,
  RotateCcw,
  Loader2,
  FileText,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import type { ModuloStatus } from "@/lib/workflow/module-completeness";
import { getModules, getDefaultModules } from "@/lib/equipos/registry";
import type { LucideIcon } from "lucide-react";

// ============================================================
//  Detalle de revisión — Vista read-only para el ingeniero
//  Con acciones: Aprobar y Devolver con Observaciones
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Thermometer,
  Gauge,
  Eye,
  FlaskConical,
  Camera,
  FileText,
};

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? FlaskConical;
}

const STATUS_ICON: Record<ModuloStatus, React.ReactNode> = {
  sin_iniciar: <Circle className="w-4 h-4 text-slate-300" />,
  en_progreso: <AlertCircle className="w-4 h-4 text-amber-500" />,
  completado: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
};

export default function RevisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const { role } = useRole();
  const router = useRouter();

  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState<"aprobar" | "devolver" | null>(null);
  const [showObservaciones, setShowObservaciones] = useState(false);

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
    const tecnico = visita.tecnico_id ? await db.usuarios.get(visita.tecnico_id) : undefined;

    const completeness = await getVisitCompleteness(visitaId);

    // Datos resumen de pruebas
    const pruebas = await db.prueba_resultados.where("visita_id").equals(visitaId).toArray();
    const mediciones = await db.mediciones_radiometricas
      .where("visita_id")
      .equals(visitaId)
      .toArray();

    return {
      visita,
      equipo,
      ubicacion,
      sede,
      cliente,
      tecnico,
      completeness,
      pruebasTotal: pruebas.length,
      pruebasCompletadas: pruebas.filter((p) => p.completado).length,
      pruebasFavorables: pruebas.filter((p) => p.concepto === "FAVORABLE").length,
      pruebasNoFavorables: pruebas.filter((p) => p.concepto === "NO_FAVORABLE").length,
      medicionesCount: mediciones.length,
    };
  }, [isReady, visitaId]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando revisión...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/revision"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a revisiones
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  const {
    visita,
    equipo,
    ubicacion,
    sede,
    cliente,
    tecnico,
    completeness,
    pruebasTotal,
    pruebasCompletadas,
    pruebasFavorables,
    pruebasNoFavorables,
    medicionesCount,
  } = data;

  const estadoConfig = ESTADO_CONFIG[visita.estado_visita];

  async function handleAprobar() {
    if (!role) return;
    setLoading("aprobar");
    try {
      const result = await executeTransition(visitaId, "aprobar", role.cargo);
      if (result.success) {
        // Crear informe automáticamente
        await crearInformeDesdeVisita(
          visitaId,
          role.usuarioId,
          visita.tecnico_id ?? role.usuarioId
        );
        router.push("/dashboard/revision");
      }
    } catch (err) {
      console.error("[Revision] Error al aprobar:", err);
    } finally {
      setLoading(null);
    }
  }

  async function handleDevolver() {
    if (!role || !observaciones.trim()) return;
    setLoading("devolver");
    try {
      const result = await executeTransition(visitaId, "devolver", role.cargo, {
        observaciones_revision: observaciones.trim(),
      });
      if (result.success) {
        router.push("/dashboard/revision");
      }
    } catch (err) {
      console.error("[Revision] Error al devolver:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Navegación */}
      <Link
        href="/dashboard/revision"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a revisiones
      </Link>

      {/* Header */}
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
                  {equipo?.gen_marca} {equipo?.gen_modelo}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {tecnico?.nombre}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {visita.fecha_visita}
                </span>
              </div>
            </div>
            <Badge
              className={`${estadoConfig.bgColor} ${estadoConfig.color} ${estadoConfig.borderColor} rounded-full text-[10px] font-black uppercase tracking-widest`}
            >
              {estadoConfig.label}
            </Badge>
          </div>
          <StateTimeline currentState={visita.estado_visita} />
        </CardContent>
      </Card>

      {/* Resumen de datos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Pruebas
            </p>
            <p className="text-xl font-black text-slate-900">
              {pruebasCompletadas}/{pruebasTotal}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Favorables
            </p>
            <p className="text-xl font-black text-emerald-600">{pruebasFavorables}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              No Favorables
            </p>
            <p className="text-xl font-black text-red-600">{pruebasNoFavorables}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Mediciones
            </p>
            <p className="text-xl font-black text-slate-900">{medicionesCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Módulos (links a las páginas de visita — modo lectura) */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-4">
          Módulos de la visita
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(equipo?.tipo_equipo ? getModules(equipo.tipo_equipo) : getDefaultModules()).map(
            (modulo) => {
              const status =
                completeness.modules.find((m) => m.id === modulo.id)?.status ?? "sin_iniciar";
              const Icon = resolveIcon(modulo.icon);
              const ruta = modulo.ruta ?? modulo.id;
              return (
                <Link key={modulo.id} href={`/dashboard/visitas/${id}/${ruta}`}>
                  <Card className="border-none shadow-sm hover:shadow-lg transition-all rounded-2xl bg-white group cursor-pointer overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-xl">
                            <Icon className="text-primary w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{modulo.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2">{STATUS_ICON[status]}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            }
          )}
        </div>
      </div>

      {/* Acciones de revisión */}
      {(visita.estado_visita === "en_revision" || visita.estado_visita === "pre_informe") && (
        <div className="space-y-4">
          <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight">
            Decisión
          </h3>

          {/* Observaciones textarea (toggle) */}
          {showObservaciones && (
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-black text-slate-800">
                    Observaciones para el técnico
                  </span>
                </div>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Describa las correcciones necesarias..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleDevolver}
                    disabled={!observaciones.trim() || loading === "devolver"}
                    className="rounded-xl font-black bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {loading === "devolver" ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    Devolver con Observaciones
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowObservaciones(false);
                      setObservaciones("");
                    }}
                    className="rounded-xl font-black"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showObservaciones && (
            <div className="flex gap-3">
              <Button
                onClick={handleAprobar}
                disabled={loading === "aprobar"}
                className="rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6"
              >
                {loading === "aprobar" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <BadgeCheck className="w-4 h-4 mr-2" />
                )}
                Aprobar Informe
              </Button>
              <Button
                onClick={() => setShowObservaciones(true)}
                variant="outline"
                className="rounded-xl font-black border-amber-300 text-amber-700 hover:bg-amber-50 h-12 px-6"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Devolver
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
