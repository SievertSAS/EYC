"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Plus,
  Building2,
  MapPin,
  User,
  Calendar,
  ArrowRight,
  Loader2,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SolicitudFormDialog } from "@/components/solicitud-form-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// ============================================================
//  Pipeline de solicitudes con tabs de estado
// ============================================================

type PipelineTab =
  | "todas"
  | "solicitudes"
  | "programacion"
  | "ejecucion"
  | "notificado"
  | "enviado";

const PIPELINE_TABS: { id: PipelineTab; label: string; short: string }[] = [
  { id: "todas", label: "Todas", short: "Todas" },
  { id: "solicitudes", label: "Por programar", short: "Por prog." },
  { id: "programacion", label: "Programación", short: "Prog." },
  { id: "ejecucion", label: "Ejecución", short: "Ejec." },
  { id: "notificado", label: "Notificado", short: "Notif." },
  { id: "enviado", label: "Enviado", short: "Env." },
];

const ESTADO_LABEL: Record<string, string> = {
  solicitudes: "Por programar",
  programacion: "Programación",
  ejecucion: "Ejecución",
  notificado: "Notificado",
  enviado: "Enviado",
};

const ESTADO_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  solicitudes: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  programacion: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  ejecucion: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  notificado: {
    bg: "bg-indigo-100",
    text: "text-indigo-600",
    border: "border-indigo-200",
  },
  enviado: {
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
};

export default function SolicitudesPage() {
  const router = useRouter();
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const canCreate = hasPermission("solicitudes", "crear");
  const [activeTab, setActiveTab] = useState<PipelineTab>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!isReady) return undefined;

    const solicitudes = await db.solicitudes.toArray();

    const enriched = await Promise.all(
      solicitudes.map(async (sol) => {
        const cliente = await db.clientes.get(sol.cliente_id);
        const ubicacion = sol.ubicacion_id
          ? await db.ubicaciones_rx.get(sol.ubicacion_id)
          : undefined;
        const tecnico = sol.tecnico_asignado_id
          ? await db.usuarios.get(sol.tecnico_asignado_id)
          : undefined;
        const contacto = sol.contacto_programar_id
          ? await db.contactos.get(sol.contacto_programar_id)
          : undefined;

        return { solicitud: sol, cliente, ubicacion, tecnico, contacto };
      })
    );

    return enriched;
  }, [isReady]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando solicitudes...</p>
      </div>
    );
  }

  // Filter + counts
  const filtered =
    activeTab === "todas" ? data : data.filter((d) => d.solicitud.pipeline_estado === activeTab);

  const counts: Record<PipelineTab, number> = {
    todas: data.length,
    solicitudes: data.filter((d) => d.solicitud.pipeline_estado === "solicitudes").length,
    programacion: data.filter((d) => d.solicitud.pipeline_estado === "programacion").length,
    ejecucion: data.filter((d) => d.solicitud.pipeline_estado === "ejecucion").length,
    notificado: data.filter((d) => d.solicitud.pipeline_estado === "notificado").length,
    enviado: data.filter((d) => d.solicitud.pipeline_estado === "enviado").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
            Solicitudes
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
            Pipeline de servicios
          </p>
        </div>
        {canCreate && (
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-11 px-5"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nueva Solicitud</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        )}
      </div>

      {/* Pipeline tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        role="tablist"
        aria-label="Filtro de solicitudes"
      >
        {PIPELINE_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
            }`}
          >
            <span className="sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                activeTab === tab.id ? "bg-white/20" : "bg-slate-100"
              }`}
            >
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <Briefcase className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Sin solicitudes</p>
          <p className="text-slate-400 text-sm">
            Crea una solicitud para iniciar el flujo de servicio.
          </p>
        </div>
      ) : (
        <>
          {/* Tabla (escritorio) */}
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha Estimada</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" aria-label="Abrir" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ solicitud, cliente, ubicacion, tecnico }) => {
                    const estado = solicitud.pipeline_estado ?? "solicitudes";
                    const badge = ESTADO_BADGE[estado] ?? ESTADO_BADGE.solicitudes;

                    return (
                      <TableRow
                        key={solicitud.id}
                        className="cursor-pointer group"
                        onClick={() => router.push(`/dashboard/solicitudes/${solicitud.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
                              <Building2 className="text-primary w-4 h-4" />
                            </div>
                            <p className="font-black text-slate-900 truncate">
                              {cliente?.nombre_cliente ?? "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-600">
                          {ubicacion?.nombre_servicio ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                          {tecnico ? tecnico.nombre.split(" ").slice(0, 2).join(" ") : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                          {solicitud.fecha_estimada_visita ?? "—"}
                        </TableCell>
                        <TableCell>
                          {solicitud.tipo_servicio ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                              {solicitud.tipo_servicio.replace("_", " ")}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${badge.bg} ${badge.text} border ${badge.border}`}
                            >
                              {ESTADO_LABEL[estado] ?? estado.replace("_", " ")}
                            </span>
                            {solicitud.pago_recibido && (
                              <span className="px-1.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200">
                                <DollarSign className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="space-y-3 md:hidden">
            {filtered.map(({ solicitud, cliente, ubicacion, tecnico }) => {
              const estado = solicitud.pipeline_estado ?? "solicitudes";
              const badge = ESTADO_BADGE[estado] ?? ESTADO_BADGE.solicitudes;

              return (
                <Link key={solicitud.id} href={`/dashboard/solicitudes/${solicitud.id}`}>
                  <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Cliente */}
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                            <p className="font-black text-slate-900 text-sm sm:text-base truncate">
                              {cliente?.nombre_cliente ?? "—"}
                            </p>
                          </div>

                          {/* Metadata */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                            {ubicacion && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {ubicacion.nombre_servicio}
                              </span>
                            )}
                            {tecnico && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {tecnico.nombre.split(" ").slice(0, 2).join(" ")}
                              </span>
                            )}
                            {solicitud.fecha_estimada_visita && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {solicitud.fecha_estimada_visita}
                              </span>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.bg} ${badge.text} border ${badge.border}`}
                            >
                              {ESTADO_LABEL[estado] ?? estado.replace("_", " ")}
                            </span>
                            {solicitud.tipo_servicio && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                                {solicitud.tipo_servicio.replace("_", " ")}
                              </span>
                            )}
                            {solicitud.pago_recibido && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center gap-0.5">
                                <DollarSign className="w-3 h-3" />
                                Pagado
                              </span>
                            )}
                          </div>
                        </div>

                        <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-2 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog */}
      <SolicitudFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
