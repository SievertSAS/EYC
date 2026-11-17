"use client";

import { Suspense, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, noBorrado } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RouteLoading } from "@/components/route-loading";
import { VistaToggle } from "@/components/listas/vista-toggle";
import { FiltrosBar, type CampoFiltro } from "@/components/listas/filtros-bar";
import { KanbanBoard, KanbanCardLink } from "@/components/listas/kanban-board";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import {
  FILTROS_VISITAS_VACIOS,
  TABS_VISITAS,
  agruparVisitasPorEstado,
  aplicarFiltrosVisitas,
  contarFiltrosVisitasActivos,
  opcionesFiltrosVisitas,
  parseFiltrosVisitas,
  serializarFiltrosVisitas,
  type TabVisitas,
} from "@/lib/listas/filtros-visitas";
import type { TipoEquipo } from "@/lib/db/types";
import { ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";
import { getVisitCompletenessBulk } from "@/lib/workflow/module-completeness";
import {
  ClipboardCheck,
  MapPin,
  Building2,
  Radio,
  Calendar,
  ArrowRight,
  Loader2,
  User,
  Search,
} from "lucide-react";
import { irAVisita } from "@/lib/visita-nav";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const nombreCorto = (nombre: string) => nombre.split(" ").slice(0, 2).join(" ");

// useSearchParams (filtros en la URL) exige un Suspense en páginas prerenderizadas.
export default function VisitasPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <VisitasLista />
    </Suspense>
  );
}

function VisitasLista() {
  const { isReady } = useDb();
  const { role } = useRole();
  const esTecnico = role?.cargo === "tecnico";
  const [filtrosUrl, actualizar] = useFiltrosUrl(parseFiltrosVisitas, serializarFiltrosVisitas);
  // El técnico solo ve sus visitas: un filtro de técnico en la URL no aplica.
  const filtros = useMemo(
    () => (esTecnico ? { ...filtrosUrl, tecnicos: [] } : filtrosUrl),
    [esTecnico, filtrosUrl]
  );
  const activeFilter = filtros.estado;
  const esKanban = filtros.vista === "kanban";

  const visitas = useLiveQuery(async () => {
    if (!isReady) return undefined;

    let allVisitas = (await db.visitas.toArray()).filter(noBorrado);

    // Técnicos solo ven sus visitas asignadas
    if (role?.cargo === "tecnico" && role?.usuarioId) {
      allVisitas = allVisitas.filter((v) => v.tecnico_id === role.usuarioId);
    }

    // Batch-fetch: recolectar IDs únicos y hacer bulkGet
    const equipoIds = [...new Set(allVisitas.map((v) => v.equipo_id).filter(Boolean))] as string[];
    const ubicacionIds = [
      ...new Set(allVisitas.map((v) => v.ubicacion_id).filter(Boolean)),
    ] as string[];
    const solicitudIds = [
      ...new Set(allVisitas.map((v) => v.solicitud_id).filter(Boolean)),
    ] as string[];
    const tecnicoIds = [
      ...new Set(allVisitas.map((v) => v.tecnico_id).filter(Boolean)),
    ] as string[];
    const visitaIds = allVisitas.map((v) => v.id!);

    const [equipos, ubicaciones, solicitudes, tecnicos, completenessMap] = await Promise.all([
      db.equipos.bulkGet(equipoIds),
      db.ubicaciones_rx.bulkGet(ubicacionIds),
      db.solicitudes.bulkGet(solicitudIds),
      db.usuarios.bulkGet(tecnicoIds),
      getVisitCompletenessBulk(visitaIds),
    ]);

    const equipoMap = new Map(equipoIds.map((id, i) => [id, equipos[i]]));
    const ubicacionMap = new Map(ubicacionIds.map((id, i) => [id, ubicaciones[i]]));
    const solicitudMap = new Map(solicitudIds.map((id, i) => [id, solicitudes[i]]));
    const tecnicoMap = new Map(tecnicoIds.map((id, i) => [id, tecnicos[i]]));

    // Fetch sedes y clientes (secondary lookups)
    const sedeIds = [
      ...new Set(
        ubicaciones
          .filter(Boolean)
          .map((u) => u!.sede_id)
          .filter(Boolean)
      ),
    ] as string[];
    const clienteIds = [
      ...new Set(
        solicitudes
          .filter(Boolean)
          .map((s) => s!.cliente_id)
          .filter(Boolean)
      ),
    ] as string[];

    const [sedes, clientes] = await Promise.all([
      db.sedes.bulkGet(sedeIds),
      db.clientes.bulkGet(clienteIds),
    ]);

    const sedeMap = new Map(sedeIds.map((id, i) => [id, sedes[i]]));
    const clienteMap = new Map(clienteIds.map((id, i) => [id, clientes[i]]));

    return allVisitas.map((visita) => {
      const equipo = visita.equipo_id ? equipoMap.get(visita.equipo_id) : undefined;
      const ubicacion = visita.ubicacion_id ? ubicacionMap.get(visita.ubicacion_id) : undefined;
      const solicitud = solicitudMap.get(visita.solicitud_id);
      const sede = ubicacion?.sede_id ? sedeMap.get(ubicacion.sede_id) : undefined;
      const cliente = solicitud?.cliente_id ? clienteMap.get(solicitud.cliente_id) : undefined;
      const tecnico = visita.tecnico_id ? tecnicoMap.get(visita.tecnico_id) : undefined;

      return {
        visita,
        equipo,
        ubicacion,
        sede,
        cliente,
        tecnico,
        solicitud,
        completeness: completenessMap.get(visita.id!) ?? {
          total: 0,
          completed: 0,
          percentage: 0,
          blocking: [],
          modules: [],
        },
      };
    });
  }, [isReady, role?.cargo, role?.usuarioId]);

  if (!isReady || visitas === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando visitas...</p>
      </div>
    );
  }

  // Búsqueda + filtros del panel (sin estado): base de los contadores y del kanban.
  const sinEstado = aplicarFiltrosVisitas(visitas, filtros, { ignorarEstado: true });
  const filteredVisitas = aplicarFiltrosVisitas(sinEstado, filtros);
  const hayFiltros = !!filtros.q.trim() || contarFiltrosVisitasActivos(filtros) > 0;

  // Contadores por pestaña: reflejan búsqueda y filtros, no la pestaña activa.
  const counts = Object.fromEntries(
    TABS_VISITAS.map((tab) => [
      tab.id,
      tab.states.length === 0
        ? sinEstado.length
        : sinEstado.filter((v) => tab.states.includes(v.visita.estado_visita)).length,
    ])
  ) as Record<TabVisitas, number>;

  const opciones = opcionesFiltrosVisitas(visitas);
  const campos: CampoFiltro[] = [
    ...(esTecnico
      ? []
      : [
          {
            tipo: "multiple" as const,
            id: "tecnico",
            label: "Técnico",
            opciones: opciones.tecnicos,
            valores: filtros.tecnicos,
            onChange: (tecnicos: string[]) => actualizar({ tecnicos }),
          },
        ]),
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
      label: "Tipo de equipo",
      opciones: opciones.tipos,
      valores: filtros.tipos,
      onChange: (tipos) => actualizar({ tipos: tipos as TipoEquipo[] }),
    },
    {
      tipo: "multiple",
      id: "ciudad",
      label: "Ciudad",
      opciones: opciones.ciudades,
      valores: filtros.ciudades,
      onChange: (ciudades) => actualizar({ ciudades }),
    },
    {
      tipo: "fechas",
      id: "fecha",
      label: "Fecha",
      desde: filtros.desde,
      hasta: filtros.hasta,
      onChange: (desde, hasta) => actualizar({ desde, hasta }),
    },
  ];
  const limpiarFiltros = () =>
    actualizar({
      tecnicos: FILTROS_VISITAS_VACIOS.tecnicos,
      clientes: FILTROS_VISITAS_VACIOS.clientes,
      tipos: FILTROS_VISITAS_VACIOS.tipos,
      ciudades: FILTROS_VISITAS_VACIOS.ciudades,
      desde: null,
      hasta: null,
    });
  const tabActiva = TABS_VISITAS.find((t) => t.id === activeFilter)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Visitas</h2>
          <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
            Servicios asignados y en progreso
          </p>
        </div>
        <VistaToggle value={filtros.vista} onChange={(vista) => actualizar({ vista })} />
      </div>

      {/* Búsqueda + filtros */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={filtros.q}
            onChange={(e) => actualizar({ q: e.target.value })}
            placeholder="Buscar por cliente, equipo o técnico…"
            className="pl-9 rounded-lg border-slate-200 h-11"
          />
        </div>
        <FiltrosBar
          campos={campos}
          activos={contarFiltrosVisitasActivos(filtros)}
          onLimpiar={limpiarFiltros}
        />
      </div>

      {esKanban ? (
        <>
          {/* En kanban las columnas ya son los estados: la pestaña de estado no aplica. */}
          <p className="text-xs text-slate-400">
            {activeFilter === "todas"
              ? "Cada columna corresponde a un estado de la visita."
              : `Cada columna corresponde a un estado: la pestaña “${tabActiva.label}” solo aplica en la vista de tabla.`}
          </p>
          <KanbanBoard
            ariaLabel="Tablero de visitas por estado"
            columnas={agruparVisitasPorEstado(sinEstado).map(({ estado, items }) => {
              const cfg = ESTADO_CONFIG[estado];
              return {
                id: estado,
                titulo: cfg.label,
                badgeClassName: `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`,
                items,
              };
            })}
            getKey={(v) => v.visita.id!}
            textoVacio="Sin visitas"
            renderItem={({ visita, equipo, ubicacion, sede, cliente, tecnico, completeness }) => {
              const nombreCliente = cliente?.nombre_cliente ?? "Sin cliente";
              const nombreEquipo =
                [equipo?.gen_marca, equipo?.gen_modelo].filter(Boolean).join(" ") || "Sin equipo";
              const muestraProgreso =
                visita.estado_visita === "en_progreso" || visita.estado_visita === "en_revision";
              return (
                <KanbanCardLink
                  href={`/dashboard/visitas/${visita.id}`}
                  onAbrir={() => irAVisita(visita.id!)}
                  ariaLabel={`Abrir visita: ${nombreCliente}, ${nombreEquipo}`}
                >
                  <p className="font-medium text-slate-900 text-sm leading-tight line-clamp-2">
                    {nombreCliente}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-1">
                        {sede?.ciudad ?? "—"}, {ubicacion?.nombre_servicio ?? "—"}
                      </span>
                    </p>
                    <p className="flex items-center gap-1">
                      <Radio className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-1">
                        {nombreEquipo}
                        {equipo?.tipo_equipo && ` · ${equipo.tipo_equipo.replace(/_/g, " ")}`}
                      </span>
                    </p>
                    <p className="flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0" />
                      {tecnico ? nombreCorto(tecnico.nombre) : "Sin asignar"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {visita.fecha_visita ?? "Sin fecha"}
                      </span>
                      {muestraProgreso && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {completeness.completed}/{completeness.total}
                        </span>
                      )}
                    </div>
                  </div>
                </KanbanCardLink>
              );
            }}
          />
        </>
      ) : (
        <>
          {/* Filter tabs */}
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filtro de visitas"
          >
            {TABS_VISITAS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeFilter === tab.id}
                onClick={() => actualizar({ estado: tab.id })}
                className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === tab.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeFilter === tab.id ? "bg-white/20" : "bg-slate-100"
                  }`}
                >
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Lista de visitas */}
          {filteredVisitas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="bg-primary/10 p-6 rounded-lg">
                <ClipboardCheck className="w-10 h-10 text-primary" />
              </div>
              <p className="text-slate-500 font-bold text-lg">
                {hayFiltros
                  ? "Sin resultados"
                  : activeFilter === "todas"
                    ? "No hay visitas asignadas"
                    : "No hay visitas en esta categoría"}
              </p>
              <p className="text-slate-400 text-sm">
                {hayFiltros
                  ? "Prueba con otra búsqueda o quitando filtros."
                  : "Las visitas aparecerán aquí cuando se sincronicen desde el CRM."}
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
                        <TableHead>Cliente</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-center">Progreso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-10" aria-label="Abrir" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisitas.map(
                        ({ visita, equipo, ubicacion, sede, cliente, tecnico, completeness }) => {
                          const estado = ESTADO_CONFIG[visita.estado_visita];
                          const muestraProgreso =
                            visita.estado_visita !== "asignada" &&
                            visita.estado_visita !== "aprobada" &&
                            visita.estado_visita !== "enviada";

                          return (
                            <TableRow
                              key={visita.id}
                              className="cursor-pointer group"
                              onClick={() => irAVisita(visita.id!)}
                            >
                              <TableCell>
                                <p className="font-medium text-slate-900 line-clamp-2 max-w-xs">
                                  {cliente?.nombre_cliente ?? "Sin cliente"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-slate-600 whitespace-nowrap">
                                  {sede?.ciudad ?? "—"}
                                </p>
                                <p className="text-xs text-slate-400 line-clamp-1 max-w-48">
                                  {ubicacion?.nombre_servicio ?? "—"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-slate-600 whitespace-nowrap">
                                  {[equipo?.gen_marca, equipo?.gen_modelo]
                                    .filter(Boolean)
                                    .join(" ") || "—"}
                                </p>
                                {equipo?.tipo_equipo && (
                                  <p className="text-xs text-slate-400">
                                    {equipo.tipo_equipo.replace(/_/g, " ")}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-600 whitespace-nowrap">
                                {tecnico ? (
                                  <span className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    {tecnico.nombre.split(" ").slice(0, 2).join(" ")}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sin asignar</span>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-600 whitespace-nowrap">
                                {visita.fecha_visita ?? "Sin fecha"}
                              </TableCell>
                              <TableCell className="text-center">
                                {muestraProgreso ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                    {completeness.completed}/{completeness.total}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${estado.bgColor} ${estado.color} border ${estado.borderColor}`}
                                >
                                  {estado.label}
                                </span>
                              </TableCell>
                              <TableCell>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                              </TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Tarjetas (móvil) */}
              <div className="space-y-3 md:hidden">
                {filteredVisitas.map(
                  ({ visita, equipo, ubicacion, sede, cliente, tecnico, completeness }) => {
                    const estado = ESTADO_CONFIG[visita.estado_visita];
                    return (
                      <a key={visita.id} href={`/dashboard/visitas/${visita.id}`}>
                        <Card className="border border-slate-200 shadow-none hover:border-slate-300 transition-all duration-300 rounded-lg bg-white group cursor-pointer overflow-hidden mb-3">
                          <CardContent className="p-4 sm:p-5 md:p-6">
                            <div className="flex items-start justify-between gap-3">
                              {/* Info principal */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Cliente */}
                                <div className="flex items-start gap-2">
                                  <Building2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                  <p className="font-medium text-slate-900 text-sm sm:text-base leading-tight">
                                    {cliente?.nombre_cliente ?? "Sin cliente"}
                                  </p>
                                </div>

                                {/* Ubicación y equipo */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {sede?.ciudad ?? "—"}, {ubicacion?.nombre_servicio ?? "—"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Radio className="w-3 h-3" />
                                    {equipo?.gen_marca} {equipo?.gen_modelo}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {tecnico
                                      ? tecnico.nombre.split(" ").slice(0, 2).join(" ")
                                      : "Sin asignar"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {visita.fecha_visita ?? "Sin fecha"}
                                  </span>
                                </div>

                                {/* Badges + Progress */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${estado.bgColor} ${estado.color} border ${estado.borderColor}`}
                                  >
                                    {estado.label}
                                  </span>
                                  {equipo?.tipo_equipo && (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      {equipo.tipo_equipo.replace(/_/g, " ")}
                                    </span>
                                  )}
                                  {/* Progress pill */}
                                  {visita.estado_visita !== "asignada" &&
                                    visita.estado_visita !== "aprobada" &&
                                    visita.estado_visita !== "enviada" && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                        {completeness.completed}/{completeness.total}
                                      </span>
                                    )}
                                </div>
                              </div>

                              {/* Flecha */}
                              <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    );
                  }
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
