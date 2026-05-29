"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Radio,
  Search,
  Building2,
  MapPin,
  Hash,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { TIPOS_EQUIPO } from "@/lib/db/types";

// ============================================================
//  Inventario general de equipos — vista consolidada
//  Filtrable por tipo de equipo, marca o cliente
// ============================================================

type FilterType = "todos" | string;

export default function EquiposPage() {
  const { isReady } = useDb();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<FilterType>("todos");

  const data = useLiveQuery(async () => {
    if (!isReady) return undefined;

    const equipos = await db.equipos.toArray();

    const enriched = await Promise.all(
      equipos.map(async (equipo) => {
        const ubicacion = await db.ubicaciones_rx.get(equipo.ubicacion_id);
        const sede = ubicacion?.sede_id
          ? await db.sedes.get(ubicacion.sede_id)
          : undefined;
        const cliente = sede?.cliente_id
          ? await db.clientes.get(sede.cliente_id)
          : undefined;
        return { equipo, ubicacion, sede, cliente };
      })
    );

    return enriched;
  }, [isReady]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando equipos...</p>
      </div>
    );
  }

  // Filtrar por búsqueda y tipo
  const filtered = data.filter((d) => {
    if (tipoFilter !== "todos" && d.equipo.tipo_equipo !== tipoFilter)
      return false;

    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        d.equipo.gen_marca,
        d.equipo.gen_modelo,
        d.equipo.gen_numero_serie,
        d.equipo.tipo_equipo,
        d.cliente?.nombre_cliente,
        d.ubicacion?.nombre_servicio,
        d.sede?.nombre_sede,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Conteo por tipo
  const tipoCountMap = new Map<string, number>();
  data.forEach((d) => {
    const t = d.equipo.tipo_equipo ?? "SIN_TIPO";
    tipoCountMap.set(t, (tipoCountMap.get(t) ?? 0) + 1);
  });

  // Solo mostrar tipos que existen
  const activeTipos = TIPOS_EQUIPO.filter((t) => tipoCountMap.has(t));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Equipos
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Inventario de equipos de rayos X — {data.length} registrados
        </p>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          className="pl-10 rounded-xl border-slate-200 focus:border-primary font-medium h-11"
          placeholder="Buscar por marca, modelo, serie, cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtro por tipo */}
      {activeTipos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTipoFilter("todos")}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
              tipoFilter === "todos"
                ? "bg-primary text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
            }`}
          >
            Todos
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                tipoFilter === "todos" ? "bg-white/20" : "bg-slate-100"
              }`}
            >
              {data.length}
            </span>
          </button>
          {activeTipos.map((tipo) => (
            <button
              key={tipo}
              onClick={() =>
                setTipoFilter(tipoFilter === tipo ? "todos" : tipo)
              }
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                tipoFilter === tipo
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-primary/5"
              }`}
            >
              {tipo.replace(/_/g, " ")}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                  tipoFilter === tipo ? "bg-white/20" : "bg-slate-100"
                }`}
              >
                {tipoCountMap.get(tipo) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <Radio className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">
            {search || tipoFilter !== "todos"
              ? "Sin resultados para esta búsqueda"
              : "No hay equipos registrados"}
          </p>
          <p className="text-slate-400 text-sm">
            Los equipos se crean desde la ficha del cliente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ equipo, ubicacion, sede, cliente }) => (
            <Link
              key={equipo.id}
              href={`/dashboard/clientes/${cliente?.id ?? ""}`}
            >
              <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Marca / Modelo */}
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
                          <Radio className="text-primary w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm sm:text-base truncate">
                            {equipo.gen_marca ?? "Sin marca"}{" "}
                            {equipo.gen_modelo ?? ""}
                          </p>
                          {equipo.gen_numero_serie && (
                            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {equipo.gen_numero_serie}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                        {cliente && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {cliente.nombre_cliente}
                          </span>
                        )}
                        {ubicacion && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {sede?.nombre_sede
                              ? `${sede.nombre_sede} — `
                              : ""}
                            {ubicacion.nombre_servicio}
                          </span>
                        )}
                        {equipo.gen_fecha_fabricacion && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {equipo.gen_fecha_fabricacion}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {equipo.tipo_equipo && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                            {equipo.tipo_equipo.replace(/_/g, " ")}
                          </span>
                        )}
                        {equipo.gen_fase && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                            {equipo.gen_fase.replace(/_/g, " ")}
                          </span>
                        )}
                        {equipo.sistema_adquisicion && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                            {equipo.sistema_adquisicion}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-2 group-hover:text-primary transition-colors" />
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
