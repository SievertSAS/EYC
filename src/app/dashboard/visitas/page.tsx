"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EstadoVisita } from "@/lib/db/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type FilterTab = "todas" | "pendientes" | "en_progreso" | "completadas";

const FILTER_TABS: { id: FilterTab; label: string; states: EstadoVisita[] }[] = [
  { id: "todas", label: "Todas", states: [] },
  { id: "pendientes", label: "Pendientes", states: ["asignada"] },
  {
    id: "en_progreso",
    label: "En Progreso",
    states: ["en_progreso", "completada", "pre_informe", "en_revision"],
  },
  { id: "completadas", label: "Completadas", states: ["aprobada"] },
];

export default function VisitasPage() {
  const router = useRouter();
  const { isReady } = useDb();
  const { role } = useRole();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("todas");

  const visitas = useLiveQuery(async () => {
    if (!isReady) return undefined;

    let allVisitas = await db.visitas.toArray();

    // Técnicos solo ven sus visitas asignadas
    if (role?.cargo === "tecnico" && role?.usuarioId) {
      allVisitas = allVisitas.filter((v) => v.tecnico_id === role.usuarioId);
    }

    // Batch-fetch: recolectar IDs únicos y hacer bulkGet
    const equipoIds = [...new Set(allVisitas.map((v) => v.equipo_id).filter(Boolean))] as number[];
    const ubicacionIds = [
      ...new Set(allVisitas.map((v) => v.ubicacion_id).filter(Boolean)),
    ] as number[];
    const solicitudIds = [
      ...new Set(allVisitas.map((v) => v.solicitud_id).filter(Boolean)),
    ] as number[];
    const visitaIds = allVisitas.map((v) => v.id!);

    const [equipos, ubicaciones, solicitudes, completenessMap] = await Promise.all([
      db.equipos.bulkGet(equipoIds),
      db.ubicaciones_rx.bulkGet(ubicacionIds),
      db.solicitudes.bulkGet(solicitudIds),
      getVisitCompletenessBulk(visitaIds),
    ]);

    const equipoMap = new Map(equipoIds.map((id, i) => [id, equipos[i]]));
    const ubicacionMap = new Map(ubicacionIds.map((id, i) => [id, ubicaciones[i]]));
    const solicitudMap = new Map(solicitudIds.map((id, i) => [id, solicitudes[i]]));

    // Fetch sedes y clientes (secondary lookups)
    const sedeIds = [
      ...new Set(
        ubicaciones
          .filter(Boolean)
          .map((u) => u!.sede_id)
          .filter(Boolean)
      ),
    ] as number[];
    const clienteIds = [
      ...new Set(
        solicitudes
          .filter(Boolean)
          .map((s) => s!.cliente_id)
          .filter(Boolean)
      ),
    ] as number[];

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

      return {
        visita,
        equipo,
        ubicacion,
        sede,
        cliente,
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

  // Filtrar por tab activo
  const activeTab = FILTER_TABS.find((t) => t.id === activeFilter)!;
  const filteredVisitas =
    activeFilter === "todas"
      ? visitas
      : visitas.filter((v) => activeTab.states.includes(v.visita.estado_visita));

  // Contadores por filtro
  const counts: Record<FilterTab, number> = {
    todas: visitas.length,
    pendientes: visitas.filter((v) => v.visita.estado_visita === "asignada").length,
    en_progreso: visitas.filter((v) =>
      ["en_progreso", "completada", "pre_informe", "en_revision"].includes(v.visita.estado_visita)
    ).length,
    completadas: visitas.filter((v) => v.visita.estado_visita === "aprobada").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Mis Visitas
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Servicios asignados y en progreso
        </p>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Filtro de visitas"
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeFilter === tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              activeFilter === tab.id
                ? "bg-primary text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
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
          <div className="bg-primary/10 p-6 rounded-3xl">
            <ClipboardCheck className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">
            {activeFilter === "todas"
              ? "No hay visitas asignadas"
              : "No hay visitas en esta categoría"}
          </p>
          <p className="text-slate-400 text-sm">
            Las visitas aparecerán aquí cuando se sincronicen desde el CRM.
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
                    <TableHead>Equipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Progreso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" aria-label="Abrir" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisitas.map(
                    ({ visita, equipo, ubicacion, sede, cliente, completeness }) => {
                      const estado = ESTADO_CONFIG[visita.estado_visita];
                      const muestraProgreso =
                        visita.estado_visita !== "asignada" && visita.estado_visita !== "aprobada";

                      return (
                        <TableRow
                          key={visita.id}
                          className="cursor-pointer group"
                          onClick={() => router.push(`/dashboard/visitas/${visita.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
                                <ClipboardCheck className="text-primary w-4 h-4" />
                              </div>
                              <p className="font-black text-slate-900 truncate">
                                {cliente?.nombre_cliente ?? "Sin cliente"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-600">
                            {sede?.ciudad ?? "—"}, {ubicacion?.nombre_servicio ?? "—"}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-slate-600 whitespace-nowrap">
                              {[equipo?.gen_marca, equipo?.gen_modelo].filter(Boolean).join(" ") ||
                                "—"}
                            </p>
                            {equipo?.tipo_equipo && (
                              <p className="text-[10px] text-slate-400 font-medium uppercase">
                                {equipo.tipo_equipo.replace(/_/g, " ")}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                            {visita.fecha_visita ?? "Sin fecha"}
                          </TableCell>
                          <TableCell className="text-center">
                            {muestraProgreso ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                {completeness.completed}/{completeness.total}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${estado.bgColor} ${estado.color} border ${estado.borderColor}`}
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
            {filteredVisitas.map(({ visita, equipo, ubicacion, sede, cliente, completeness }) => {
              const estado = ESTADO_CONFIG[visita.estado_visita];
              return (
                <Link key={visita.id} href={`/dashboard/visitas/${visita.id}`}>
                  <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-start justify-between gap-3">
                        {/* Info principal */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Cliente */}
                          <div className="flex items-start gap-2">
                            <Building2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <p className="font-black text-slate-900 text-sm sm:text-base leading-tight">
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
                              <Calendar className="w-3 h-3" />
                              {visita.fecha_visita ?? "Sin fecha"}
                            </span>
                          </div>

                          {/* Badges + Progress */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${estado.bgColor} ${estado.color} border ${estado.borderColor}`}
                            >
                              {estado.label}
                            </span>
                            {equipo?.tipo_equipo && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                {equipo.tipo_equipo.replace(/_/g, " ")}
                              </span>
                            )}
                            {/* Progress pill */}
                            {visita.estado_visita !== "asignada" &&
                              visita.estado_visita !== "aprobada" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
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
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
