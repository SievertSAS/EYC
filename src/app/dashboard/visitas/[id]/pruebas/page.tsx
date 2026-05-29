"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { hasPackage } from "@/lib/pruebas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ListChecks,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";

export default function PruebasListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [initializing, setInitializing] = useState(false);

  // Cargar visita y equipo
  const visita = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    return db.visitas.get(visitaId);
  }, [isReady, visitaId]);

  const equipo = useLiveQuery(async () => {
    if (!visita?.equipo_id) return null;
    return db.equipos.get(visita.equipo_id);
  }, [visita?.equipo_id]);

  // Grupos de pruebas para esta visita
  const grupoResultados = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return [];
    return db.grupo_resultados.where("visita_id").equals(visitaId).toArray();
  }, [isReady, visitaId]);

  // Definiciones de grupos
  const grupoDefs = useLiveQuery(async () => {
    if (!grupoResultados || grupoResultados.length === 0) return [];
    const grupoIds = grupoResultados.map((gr) => gr.grupo_id);
    const defs = await db.grupo_pruebas.bulkGet(grupoIds);
    return defs.filter(Boolean).sort((a, b) => (a!.orden ?? 0) - (b!.orden ?? 0));
  }, [grupoResultados]);

  // Resultados existentes para esta visita
  const resultados = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return [];
    return db.prueba_resultados.where("visita_id").equals(visitaId).toArray();
  }, [isReady, visitaId]);

  // Pruebas aplicables (para ruta legacy)
  const pruebasAplicables = useLiveQuery(async () => {
    if (!equipo?.tipo_equipo) return [];
    const todas = await db.prueba_definiciones
      .filter(
        (p) =>
          p.activa &&
          !p.grupo_id &&
          p.tipos_equipo_aplicables.includes(equipo.tipo_equipo!)
      )
      .toArray();
    return todas.sort(
      (a, b) => (a.orden_sugerido ?? 99) - (b.orden_sugerido ?? 99)
    );
  }, [equipo?.tipo_equipo]);

  // Pruebas agrupadas (para contar por grupo)
  const pruebasPorGrupo = useLiveQuery(async () => {
    if (!grupoResultados || grupoResultados.length === 0) return new Map();
    const map = new Map<number, number>();
    for (const gr of grupoResultados) {
      const count = await db.prueba_resultados
        .where("grupo_resultado_id")
        .equals(gr.id!)
        .count();
      map.set(gr.grupo_id, count);
    }
    return map;
  }, [grupoResultados]);

  const pruebasCompletadasPorGrupo = useLiveQuery(async () => {
    if (!grupoResultados || grupoResultados.length === 0) return new Map();
    const map = new Map<number, number>();
    for (const gr of grupoResultados) {
      const count = await db.prueba_resultados
        .where("grupo_resultado_id")
        .equals(gr.id!)
        .filter((p) => p.completado)
        .count();
      map.set(gr.grupo_id, count);
    }
    return map;
  }, [grupoResultados]);

  // Auto-inicializar grupo_resultados para equipos con paquete
  const inicializarGrupos = useCallback(async () => {
    if (
      !equipo?.tipo_equipo ||
      !hasPackage(equipo.tipo_equipo) ||
      !visita?.equipo_id ||
      !grupoResultados ||
      grupoResultados.length > 0
    )
      return;

    setInitializing(true);
    const now = new Date().toISOString();

    await db.transaction(
      "rw",
      [db.grupo_resultados, db.prueba_resultados, db.grupo_pruebas, db.prueba_definiciones],
      async () => {
        // Eliminar prueba_resultados legacy sin grupo
        const legacyResults = await db.prueba_resultados
          .where("visita_id")
          .equals(visitaId)
          .filter((r) => !r.grupo_resultado_id)
          .toArray();
        if (legacyResults.length > 0) {
          await db.prueba_resultados.bulkDelete(legacyResults.map((r) => r.id!));
        }

        // Obtener grupos para este tipo de equipo
        const grupos = await db.grupo_pruebas
          .where("tipo_equipo")
          .equals(equipo.tipo_equipo!)
          .sortBy("orden");

        for (const grupo of grupos) {
          const grupoResultadoId = (await db.grupo_resultados.add({
            visita_id: visitaId,
            grupo_id: grupo.id!,
            equipo_id: visita.equipo_id!,
            mediciones_json: [],
            imagenes: [],
            completado: false,
            sync_status: "pending",
            last_modified: now,
            creado_en: now,
          })) as number;

          const pruebasDelGrupo = await db.prueba_definiciones
            .where("grupo_id")
            .equals(grupo.id!)
            .toArray();

          if (pruebasDelGrupo.length > 0) {
            await db.prueba_resultados.bulkAdd(
              pruebasDelGrupo.map((p) => ({
                visita_id: visitaId,
                prueba_definicion_id: p.id!,
                equipo_id: visita.equipo_id!,
                grupo_resultado_id: grupoResultadoId,
                completado: false,
                sync_status: "pending" as const,
                last_modified: now,
                creado_en: now,
              }))
            );
          }
        }
      }
    );
    setInitializing(false);
  }, [equipo?.tipo_equipo, visita?.equipo_id, visitaId, grupoResultados]);

  // Inicializar prueba_resultados legacy (para equipos sin paquete)
  const inicializarResultadosLegacy = useCallback(async () => {
    if (
      !pruebasAplicables ||
      pruebasAplicables.length === 0 ||
      !resultados ||
      !visita?.equipo_id ||
      (grupoResultados && grupoResultados.length > 0)
    )
      return;

    const existingDefIds = new Set(
      resultados.map((r) => r.prueba_definicion_id)
    );
    const faltantes = pruebasAplicables.filter(
      (p) => !existingDefIds.has(p.id!)
    );

    if (faltantes.length === 0) return;

    setInitializing(true);
    const now = new Date().toISOString();
    await db.prueba_resultados.bulkAdd(
      faltantes.map((p) => ({
        visita_id: visitaId,
        prueba_definicion_id: p.id!,
        equipo_id: visita.equipo_id!,
        completado: false,
        sync_status: "pending" as const,
        last_modified: now,
        creado_en: now,
      }))
    );
    setInitializing(false);
  }, [pruebasAplicables, resultados, visita?.equipo_id, visitaId, grupoResultados]);

  useEffect(() => {
    inicializarGrupos();
  }, [inicializarGrupos]);

  useEffect(() => {
    inicializarResultadosLegacy();
  }, [inicializarResultadosLegacy]);

  // ─── Loading / Error ───

  if (
    !isReady ||
    visita === undefined ||
    resultados === undefined ||
    grupoResultados === undefined
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando pruebas...</p>
      </div>
    );
  }

  if (visita === null) {
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
          <p className="text-slate-500 font-bold text-lg">
            Visita no encontrada
          </p>
        </div>
      </div>
    );
  }

  const hasGroups = grupoResultados.length > 0;
  const totalPruebas = resultados.length;
  const completadas = resultados.filter((r) => r.completado).length;

  // ─── Render ───

  return (
    <div className="space-y-6">
      <ModuleNav visitaId={visitaId} currentModule="pruebas" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
            Pruebas de Control de Calidad
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {equipo?.tipo_equipo?.replace(/_/g, " ")} — {equipo?.gen_marca}{" "}
            {equipo?.gen_modelo}
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary/10">
          {completadas}/{totalPruebas}
        </Badge>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            Progreso
          </span>
          <span>
            {totalPruebas > 0
              ? Math.round((completadas / totalPruebas) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${
                totalPruebas > 0 ? (completadas / totalPruebas) * 100 : 0
              }%`,
            }}
          />
        </div>
      </div>

      {initializing && (
        <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Inicializando pruebas...
        </div>
      )}

      {/* Lista de grupos o pruebas */}
      <div className="space-y-3">
        {hasGroups
          ? /* ─── Vista por Grupos ─── */
            (grupoDefs ?? []).map((grupo, i) => {
              if (!grupo) return null;
              const gr = grupoResultados.find(
                (g) => g.grupo_id === grupo.id
              );
              const totalEnGrupo = pruebasPorGrupo?.get(grupo.id!) ?? 0;
              const completadasEnGrupo =
                pruebasCompletadasPorGrupo?.get(grupo.id!) ?? 0;
              const allDone =
                totalEnGrupo > 0 && completadasEnGrupo === totalEnGrupo;

              return (
                <Link
                  key={grupo.id}
                  href={`/dashboard/visitas/${id}/pruebas/grupo/${grupo.id}`}
                >
                  <Card
                    className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              allDone
                                ? "bg-emerald-100"
                                : completadasEnGrupo > 0
                                ? "bg-amber-100"
                                : "bg-primary/10"
                            }`}
                          >
                            {allDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Layers
                                className={`w-5 h-5 ${
                                  completadasEnGrupo > 0
                                    ? "text-amber-600"
                                    : "text-primary"
                                }`}
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                {grupo.codigo}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {completadasEnGrupo}/{totalEnGrupo} pruebas
                              </span>
                            </div>
                            <p className="font-black text-slate-900 text-sm sm:text-base leading-tight mt-0.5">
                              {grupo.nombre}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-primary transition-colors" />
                      </div>

                      {/* Mini progress bar */}
                      {totalEnGrupo > 0 && (
                        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              allDone ? "bg-emerald-500" : "bg-primary"
                            }`}
                            style={{
                              width: `${
                                (completadasEnGrupo / totalEnGrupo) * 100
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          : /* ─── Vista Legacy (pruebas individuales) ─── */
            (pruebasAplicables ?? []).map((prueba, i) => {
              const resultado = resultados.find(
                (r) => r.prueba_definicion_id === prueba.id
              );
              const completado = resultado?.completado ?? false;
              const concepto = resultado?.concepto;

              return (
                <Link
                  key={prueba.id}
                  href={`/dashboard/visitas/${id}/pruebas/${prueba.id}`}
                >
                  <Card
                    className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black ${
                              completado
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {completado ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              prueba.orden_sugerido ?? i + 1
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                {prueba.codigo}
                              </span>
                              {concepto && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                    concepto === "FAVORABLE"
                                      ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                                      : concepto === "NO_FAVORABLE"
                                      ? "bg-red-100 text-red-600 border border-red-200"
                                      : "bg-slate-100 text-slate-500 border border-slate-200"
                                  }`}
                                >
                                  {concepto.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <p className="font-black text-slate-900 text-sm sm:text-base leading-tight mt-0.5">
                              {prueba.nombre}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
