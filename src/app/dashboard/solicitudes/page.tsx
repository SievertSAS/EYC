"use client";

import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, noBorrado } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
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
import { RouteLoading } from "@/components/route-loading";
import { VistaToggle } from "@/components/listas/vista-toggle";
import { FiltrosBar, type CampoFiltro } from "@/components/listas/filtros-bar";
import { KanbanBoard, KanbanCardLink } from "@/components/listas/kanban-board";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import {
  FILTROS_SOLICITUDES_VACIOS,
  PIPELINE_BADGE,
  PIPELINE_LABEL,
  agruparSolicitudesPorEstado,
  aplicarFiltrosSolicitudes,
  contarFiltrosSolicitudesActivos,
  estadoPipeline,
  etiquetaTipoServicio,
  opcionesFiltrosSolicitudes,
  parseFiltrosSolicitudes,
  serializarFiltrosSolicitudes,
  type FiltroPago,
  type TabSolicitudes,
} from "@/lib/listas/filtros-solicitudes";

// ============================================================
//  Pipeline de solicitudes con tabs de estado
// ============================================================

const PIPELINE_TABS: { id: TabSolicitudes; label: string; short: string }[] = [
  { id: "todas", label: "Todas", short: "Todas" },
  { id: "solicitudes", label: "Por programar", short: "Por prog." },
  { id: "programacion", label: "Programación", short: "Prog." },
  { id: "ejecucion", label: "Ejecución", short: "Ejec." },
  { id: "notificado", label: "Notificado", short: "Notif." },
  { id: "enviado", label: "Enviado", short: "Env." },
  { id: "cancelada", label: "Canceladas", short: "Cancel." },
];

const PAGO_OPCIONES: { value: FiltroPago; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

// useSearchParams (filtros en la URL) exige un Suspense en páginas prerenderizadas.
export default function SolicitudesPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <SolicitudesLista />
    </Suspense>
  );
}

function SolicitudesLista() {
  const router = useRouter();
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const canCreate = hasPermission("solicitudes", "crear");
  const [filtros, actualizar] = useFiltrosUrl(
    parseFiltrosSolicitudes,
    serializarFiltrosSolicitudes
  );
  const activeTab = filtros.estado;
  const esKanban = filtros.vista === "kanban";
  const [dialogOpen, setDialogOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!isReady) return undefined;

    const solicitudes = (await db.solicitudes.toArray()).filter(noBorrado);

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

  // Búsqueda + filtros del panel (sin estado): base de los contadores y del kanban.
  const sinEstado = aplicarFiltrosSolicitudes(data, filtros, { ignorarEstado: true });
  // "Todas" excluye las canceladas — viven en su propia pestaña.
  const filtered = aplicarFiltrosSolicitudes(sinEstado, filtros);
  const activos = contarFiltrosSolicitudesActivos(filtros);
  const hayFiltros = !!filtros.q.trim() || activos > 0;

  // Contadores por pestaña: reflejan búsqueda y filtros, no la pestaña activa.
  const counts = Object.fromEntries(
    PIPELINE_TABS.map((tab) => [
      tab.id,
      tab.id === "todas"
        ? sinEstado.filter((d) => estadoPipeline(d.solicitud) !== "cancelada").length
        : sinEstado.filter((d) => estadoPipeline(d.solicitud) === tab.id).length,
    ])
  ) as Record<TabSolicitudes, number>;

  const opciones = opcionesFiltrosSolicitudes(data);
  const campos: CampoFiltro[] = [
    {
      tipo: "multiple",
      id: "tecnico",
      label: "Técnico",
      opciones: opciones.tecnicos,
      valores: filtros.tecnicos,
      onChange: (tecnicos) => actualizar({ tecnicos }),
    },
    {
      tipo: "multiple",
      id: "cliente",
      label: "Cliente",
      opciones: opciones.clientes,
      valores: filtros.clientes,
      onChange: (clientes) => actualizar({ clientes }),
    },
    {
      tipo: "multiple",
      id: "tipo",
      label: "Tipo de servicio",
      opciones: opciones.tiposServicio,
      valores: filtros.tiposServicio,
      onChange: (tiposServicio) => actualizar({ tiposServicio }),
    },
    {
      tipo: "opcion",
      id: "pago",
      label: "Pago",
      opciones: PAGO_OPCIONES,
      valor: filtros.pago,
      valorPorDefecto: FILTROS_SOLICITUDES_VACIOS.pago,
      onChange: (pago) => actualizar({ pago: pago as FiltroPago }),
    },
    {
      tipo: "fechas",
      id: "fecha",
      label: "Fecha estimada",
      desde: filtros.desde,
      hasta: filtros.hasta,
      onChange: (desde, hasta) => actualizar({ desde, hasta }),
    },
  ];
  const limpiarFiltros = () =>
    actualizar({
      tecnicos: FILTROS_SOLICITUDES_VACIOS.tecnicos,
      clientes: FILTROS_SOLICITUDES_VACIOS.clientes,
      tiposServicio: FILTROS_SOLICITUDES_VACIOS.tiposServicio,
      pago: FILTROS_SOLICITUDES_VACIOS.pago,
      desde: null,
      hasta: null,
    });
  const abrir = (id: string) => router.push(`/dashboard/solicitudes/${id}`);
  const tabActiva = PIPELINE_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Solicitudes</h2>
          <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
            Pipeline de servicios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VistaToggle value={filtros.vista} onChange={(vista) => actualizar({ vista })} />
          {canCreate && (
            <Button
              className="rounded-lg font-medium bg-primary hover:bg-primary/90 text-white h-11 px-5"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nueva Solicitud</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          )}
        </div>
      </div>

      {/* Buscador + filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="rounded-lg border-slate-200 focus:border-primary font-medium h-11 pl-10"
            placeholder="Buscar por número, cliente, ubicación o técnico..."
            value={filtros.q}
            onChange={(e) => actualizar({ q: e.target.value })}
          />
        </div>
        <FiltrosBar campos={campos} activos={activos} onLimpiar={limpiarFiltros} />
      </div>

      {esKanban ? (
        <>
          {/* En kanban las columnas ya son los estados: la pestaña de estado no aplica. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {activeTab === "todas"
                ? "Cada columna corresponde a un estado del pipeline."
                : `Cada columna corresponde a un estado: la pestaña “${tabActiva.label}” solo aplica en la vista de tabla.`}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={filtros.canceladas}
                onChange={(e) => actualizar({ canceladas: e.target.checked })}
              />
              Mostrar canceladas
            </label>
          </div>
          <KanbanBoard
            ariaLabel="Tablero de solicitudes por estado"
            columnas={agruparSolicitudesPorEstado(sinEstado, {
              incluirCanceladas: filtros.canceladas,
            }).map(({ estado, items }) => {
              const badge = PIPELINE_BADGE[estado];
              return {
                id: estado,
                titulo: PIPELINE_LABEL[estado],
                badgeClassName: `${badge.bg} ${badge.text} ${badge.border}`,
                items,
              };
            })}
            getKey={(d) => d.solicitud.id!}
            textoVacio="Sin solicitudes"
            renderItem={({ solicitud, cliente, ubicacion, tecnico }) => {
              const nombreCliente = cliente?.nombre_cliente ?? "Sin cliente";
              return (
                <KanbanCardLink
                  href={`/dashboard/solicitudes/${solicitud.id}`}
                  onAbrir={() => abrir(solicitud.id!)}
                  ariaLabel={`Abrir solicitud ${solicitud.numero_solicitud ?? ""}: ${nombreCliente}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900 text-sm leading-tight line-clamp-2">
                      {nombreCliente}
                    </p>
                    {solicitud.numero_solicitud && (
                      <span className="font-mono text-xs font-bold text-slate-400 shrink-0">
                        {solicitud.numero_solicitud}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {ubicacion && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-1">{ubicacion.nombre_servicio}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0" />
                      {tecnico ? tecnico.nombre.split(" ").slice(0, 2).join(" ") : "Sin asignar"}
                    </p>
                    {solicitud.fecha_estimada_visita && (
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {solicitud.fecha_estimada_visita}
                      </p>
                    )}
                  </div>
                  {(solicitud.tipo_servicio || solicitud.pago_recibido) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {solicitud.tipo_servicio && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          {etiquetaTipoServicio(solicitud.tipo_servicio)}
                        </span>
                      )}
                      {solicitud.pago_recibido && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          Pagado
                        </span>
                      )}
                    </div>
                  )}
                </KanbanCardLink>
              );
            }}
          />
        </>
      ) : (
        <>
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
                onClick={() => actualizar({ estado: tab.id })}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
                }`}
              >
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
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
              <div className="bg-primary/10 p-6 rounded-lg">
                <Briefcase className="w-10 h-10 text-primary" />
              </div>
              <p className="text-slate-500 font-bold text-lg">
                {hayFiltros ? "Sin resultados" : "Sin solicitudes"}
              </p>
              <p className="text-slate-400 text-sm">
                {hayFiltros
                  ? "Prueba con otra búsqueda o quitando filtros."
                  : "Crea una solicitud para iniciar el flujo de servicio."}
              </p>
            </div>
          ) : (
            <>
              {/* Tabla (escritorio) */}
              <Card className="border border-slate-200 shadow-none rounded-lg bg-white overflow-hidden hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N.º</TableHead>
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
                        const estado = estadoPipeline(solicitud);
                        const badge = PIPELINE_BADGE[estado];

                        return (
                          <TableRow
                            key={solicitud.id}
                            className="cursor-pointer group"
                            onClick={() => abrir(solicitud.id!)}
                          >
                            <TableCell className="font-mono text-xs font-bold text-slate-500 whitespace-nowrap">
                              {solicitud.numero_solicitud ?? "—"}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-slate-900 line-clamp-2 max-w-xs">
                                {cliente?.nombre_cliente ?? "—"}
                              </p>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {ubicacion?.nombre_servicio ?? "—"}
                            </TableCell>
                            <TableCell className="text-slate-600 whitespace-nowrap">
                              {tecnico ? tecnico.nombre.split(" ").slice(0, 2).join(" ") : "—"}
                            </TableCell>
                            <TableCell className="text-slate-600 whitespace-nowrap">
                              {solicitud.fecha_estimada_visita ?? "—"}
                            </TableCell>
                            <TableCell>
                              {solicitud.tipo_servicio ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                                  {solicitud.tipo_servicio.replace("_", " ")}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge.bg} ${badge.text} border ${badge.border}`}
                                >
                                  {PIPELINE_LABEL[estado]}
                                </span>
                                {solicitud.pago_recibido && (
                                  <span className="px-1.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600 border border-emerald-200">
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
                  const estado = estadoPipeline(solicitud);
                  const badge = PIPELINE_BADGE[estado];

                  return (
                    <Link key={solicitud.id} href={`/dashboard/solicitudes/${solicitud.id}`}>
                      <Card className="border border-slate-200 shadow-none hover:border-slate-300 transition-all duration-300 rounded-lg bg-white group cursor-pointer overflow-hidden mb-3">
                        <CardContent className="p-4 sm:p-5 md:p-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Cliente */}
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                                <p className="font-medium text-slate-900 text-sm sm:text-base truncate">
                                  {cliente?.nombre_cliente ?? "—"}
                                </p>
                                {solicitud.numero_solicitud && (
                                  <span className="font-mono text-xs font-bold text-slate-400 flex-shrink-0">
                                    {solicitud.numero_solicitud}
                                  </span>
                                )}
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
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} border ${badge.border}`}
                                >
                                  {PIPELINE_LABEL[estado]}
                                </span>
                                {solicitud.tipo_servicio && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                    {solicitud.tipo_servicio.replace("_", " ")}
                                  </span>
                                )}
                                {solicitud.pago_recibido && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center gap-0.5">
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
        </>
      )}

      {/* Dialog */}
      <SolicitudFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
