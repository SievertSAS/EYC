"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Building2,
  Radio,
  Calendar,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";

// ============================================================
//  Lista de informes con filtros
// ============================================================

type FilterTab = "todos" | "vigentes" | "vencidos";

export default function InformesPage() {
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("todos");

  const informes = useLiveQuery(async () => {
    if (!isReady) return undefined;

    const allInformes = await db.informes.toArray();

    const enriched = await Promise.all(
      allInformes.map(async (informe) => {
        const equipo = await db.equipos.get(informe.equipo_id);
        const ubicacion = await db.ubicaciones_rx.get(informe.ubicacion_id);
        const visita = await db.visitas.get(informe.visita_id);
        const solicitud = visita ? await db.solicitudes.get(visita.solicitud_id) : undefined;
        const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;

        const hoy = new Date().toISOString().split("T")[0];
        const vigente = informe.fecha_vencimiento >= hoy;

        return { informe, equipo, ubicacion, cliente, vigente };
      })
    );

    return enriched;
  }, [isReady]);

  if (!isReady || informes === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando informes...</p>
      </div>
    );
  }

  if (!hasPermission("informes")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <FileText className="w-10 h-10 text-red-500" />
        <p className="text-slate-500 font-bold">Acceso restringido</p>
        <p className="text-slate-400 text-sm">
          No tienes permisos para acceder al módulo de informes.
        </p>
      </div>
    );
  }

  const filtered =
    activeFilter === "todos"
      ? informes
      : activeFilter === "vigentes"
        ? informes.filter((i) => i.vigente)
        : informes.filter((i) => !i.vigente);

  const counts = {
    todos: informes.length,
    vigentes: informes.filter((i) => i.vigente).length,
    vencidos: informes.filter((i) => !i.vigente).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Informes
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Informes técnicos emitidos
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2" role="tablist" aria-label="Filtro de informes">
        {(
          [
            { id: "todos", label: "Todos" },
            { id: "vigentes", label: "Vigentes" },
            { id: "vencidos", label: "Vencidos" },
          ] as const
        ).map((tab) => (
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

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">No hay informes</p>
          <p className="text-slate-400 text-sm">
            Los informes se generan automáticamente al aprobar una visita.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ informe, equipo, cliente, vigente }) => (
            <Link key={informe.id} href={`/dashboard/informes/${informe.id}`}>
              <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Número de informe */}
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <p className="font-black text-slate-900 text-sm sm:text-base">
                          {informe.numero_informe}
                        </p>
                      </div>

                      {/* Cliente y equipo */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {cliente?.nombre_cliente ?? "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Radio className="w-3 h-3" />
                          {equipo?.gen_marca} {equipo?.gen_modelo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {informe.fecha_emision}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Concepto */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            informe.concepto_general === "FAVORABLE"
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : "bg-red-100 text-red-600 border border-red-200"
                          }`}
                        >
                          {informe.concepto_general === "FAVORABLE" ? (
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 inline mr-1" />
                          )}
                          {informe.concepto_general}
                        </span>

                        {/* Vigencia */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            vigente
                              ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                              : "bg-red-100 text-red-600 border border-red-200"
                          }`}
                        >
                          <Clock className="w-3 h-3 inline mr-1" />
                          {vigente ? "Vigente" : "Vencido"}
                        </span>

                        {/* Versión */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                          v{informe.version_actual}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
