"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";
import { getVisitCompleteness } from "@/lib/workflow/module-completeness";
import {
  ShieldCheck,
  Building2,
  MapPin,
  Radio,
  Calendar,
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// ============================================================
//  Dashboard de revisión para ingenieros
//  Muestra visitas en estado pre_informe y en_revision
// ============================================================

export default function RevisionPage() {
  const { isReady } = useDb();
  const { role, hasPermission } = useRole();

  const visitas = useLiveQuery(async () => {
    if (!isReady) return undefined;

    // Obtener visitas pendientes de revisión
    const pendientes = await db.visitas
      .where("estado_visita")
      .anyOf(["pre_informe", "en_revision"])
      .toArray();

    const enriched = await Promise.all(
      pendientes.map(async (visita) => {
        const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
        const ubicacion = visita.ubicacion_id
          ? await db.ubicaciones_rx.get(visita.ubicacion_id)
          : undefined;
        const solicitud = await db.solicitudes.get(visita.solicitud_id);
        const sede = ubicacion
          ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? 0)
          : undefined;
        const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
        const tecnico = visita.tecnico_id ? await db.usuarios.get(visita.tecnico_id) : undefined;
        const completeness = await getVisitCompleteness(visita.id!);

        return {
          visita,
          equipo,
          ubicacion,
          sede,
          cliente,
          tecnico,
          completeness,
        };
      })
    );

    return enriched;
  }, [isReady]);

  if (!isReady || visitas === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando revisiones...</p>
      </div>
    );
  }

  if (!hasPermission("revision")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldCheck className="w-10 h-10 text-red-500" />
        <p className="text-slate-500 font-bold">Acceso restringido</p>
        <p className="text-slate-400 text-sm">
          No tienes permisos para acceder al módulo de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Revisión
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Visitas pendientes de aprobación
        </p>
      </div>

      {/* Contador */}
      <div className="flex items-center gap-3">
        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 border border-purple-200">
          {visitas.length} pendiente{visitas.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista */}
      {visitas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-emerald-100 p-6 rounded-3xl">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Todo al día</p>
          <p className="text-slate-400 text-sm">No hay visitas pendientes de revisión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitas.map(({ visita, equipo, ubicacion, sede, cliente, tecnico, completeness }) => {
            const estado = ESTADO_CONFIG[visita.estado_visita];
            return (
              <Link key={visita.id} href={`/dashboard/revision/${visita.id}`}>
                <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                  <CardContent className="p-4 sm:p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Cliente */}
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                            {cliente?.nombre_cliente ?? "Sin cliente"}
                          </p>
                        </div>

                        {/* Detalles */}
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
                            {tecnico?.nombre ?? "Sin técnico"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {visita.fecha_visita ?? "Sin fecha"}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${estado.bgColor} ${estado.color} border ${estado.borderColor}`}
                          >
                            {estado.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                            {completeness.completed}/{completeness.total} módulos
                          </span>
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
