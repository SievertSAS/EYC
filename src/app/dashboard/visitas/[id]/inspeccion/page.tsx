"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Eye,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";
import type { ParteEquipo, ElementoProteccion } from "@/lib/db/types";

/** Partes comunes a inspeccionar por tipo de equipo */
const PARTES_COMUNES = [
  "Generador de rayos X",
  "Tubo de rayos X",
  "Colimador",
  "Panel de control",
  "Cables y conexiones",
  "Sistema de freno / bloqueo",
  "Indicadores luminosos",
  "Señalización de radiación",
  "Puerta de acceso a la sala",
  "Interruptor de seguridad (puerta)",
  "Visor plomado",
  "Lámpara de exposición (en uso)",
];

const ESTADOS_PARTE: { value: string; label: string; color: string }[] = [
  { value: "bueno", label: "Bueno", color: "bg-emerald-500 text-white" },
  { value: "regular", label: "Regular", color: "bg-amber-500 text-white" },
  { value: "malo", label: "Malo", color: "bg-red-500 text-white" },
  { value: "no_aplica", label: "N/A", color: "bg-slate-400 text-white" },
];

export default function InspeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [initialized, setInitialized] = useState(false);

  const visita = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    return db.visitas.get(visitaId);
  }, [isReady, visitaId]);

  // Partes del equipo
  const partes = useLiveQuery(async () => {
    if (!visita?.equipo_id) return undefined;
    return db.partes_equipo.where("equipo_id").equals(visita.equipo_id).toArray();
  }, [visita?.equipo_id]);

  // Elementos de protección
  const elementos = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return undefined;
    return db.elementos_proteccion.where("visita_id").equals(visitaId).toArray();
  }, [isReady, visitaId]);

  // Inicializar partes si no existen
  const inicializarPartes = useCallback(async () => {
    if (!visita?.equipo_id || !partes || partes.length > 0 || initialized) return;

    const now = new Date().toISOString();
    await db.partes_equipo.bulkAdd(
      PARTES_COMUNES.map((nombre) => ({
        equipo_id: visita.equipo_id!,
        parte_nombre: nombre,
        estado: "bueno" as const,
        creado_en: now,
      }))
    );
    setInitialized(true);
  }, [visita?.equipo_id, partes, initialized]);

  useEffect(() => {
    inicializarPartes();
  }, [inicializarPartes]);

  // Actualizar parte
  const actualizarParte = useCallback(async (parteId: number, campo: Partial<ParteEquipo>) => {
    try {
      setSaveStatus("saving");
      await db.partes_equipo.update(parteId, campo);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // Agregar elemento de protección
  const agregarElemento = useCallback(async () => {
    const now = new Date().toISOString();
    await db.elementos_proteccion.add({
      visita_id: visitaId,
      descripcion: "",
      cantidad: 1,
      concepto: "Conforme",
      creado_en: now,
    });
  }, [visitaId]);

  // Actualizar elemento
  const actualizarElemento = useCallback(
    async (elemId: number, campo: Partial<ElementoProteccion>) => {
      try {
        setSaveStatus("saving");
        await db.elementos_proteccion.update(elemId, campo);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    []
  );

  // Eliminar elemento
  const eliminarElemento = useCallback(async (elemId: number) => {
    await db.elementos_proteccion.delete(elemId);
  }, []);

  if (!isReady || partes === undefined || elementos === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando inspección...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación entre módulos */}
      <ModuleNav visitaId={visitaId} currentModule="inspeccion" />

      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2 text-xs font-bold">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Save className="w-3.5 h-3.5 animate-pulse" />
              Guardando...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Guardado
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1.5 text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              Error
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          Inspección Visual
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Estado del equipo, instalación y elementos de protección
        </p>
      </div>

      {/* Partes del equipo */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Eye className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Estado de Componentes
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Evaluar el estado de cada parte del equipo e instalación
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {(partes ?? []).map((parte) => (
              <div key={parte.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                {/* Nombre */}
                <p className="flex-1 text-sm font-bold text-slate-700 min-w-0 truncate">
                  {parte.parte_nombre}
                </p>

                {/* Selector de estado */}
                <div className="flex gap-1 flex-shrink-0">
                  {ESTADOS_PARTE.map((est) => (
                    <button
                      key={est.value}
                      onClick={() =>
                        actualizarParte(parte.id!, {
                          estado: est.value as ParteEquipo["estado"],
                        })
                      }
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                        parte.estado === est.value
                          ? `${est.color} shadow-sm`
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {est.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Observación por parte (expandible en futuro) */}
        </CardContent>
      </Card>

      {/* Elementos de Protección Radiológica */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <Shield className="text-primary w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Elementos de Protección
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Delantales, protectores de tiroides, gónadas, etc.
                </p>
              </div>
            </div>
            <Button
              onClick={agregarElemento}
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-9 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agregar
            </Button>
          </div>

          {(elementos ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 font-medium text-center py-4">
              Sin elementos registrados. Agrega delantales plomados, protectores, etc.
            </p>
          ) : (
            <div className="space-y-3">
              {(elementos ?? []).map((elem) => (
                <div key={elem.id} className="bg-slate-50 rounded-xl p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Elemento
                    </span>
                    <button
                      onClick={() => eliminarElemento(elem.id!)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Descripción
                      </Label>
                      <Input
                        type="text"
                        placeholder="Ej: Delantal plomado 0.5mmPb"
                        className="rounded-lg border-slate-200 focus:border-primary font-medium h-9 text-sm"
                        defaultValue={elem.descripcion}
                        onBlur={(e) =>
                          actualizarElemento(elem.id!, {
                            descripcion: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Cantidad
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="1"
                        className="rounded-lg border-slate-200 focus:border-primary font-medium h-9 text-sm"
                        defaultValue={elem.cantidad ?? ""}
                        onBlur={(e) =>
                          actualizarElemento(elem.id!, {
                            cantidad: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        actualizarElemento(elem.id!, {
                          concepto: "Conforme",
                        })
                      }
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        elem.concepto === "Conforme"
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                          : "bg-emerald-50 text-emerald-600 border-emerald-200"
                      }`}
                    >
                      Conforme
                    </button>
                    <button
                      onClick={() =>
                        actualizarElemento(elem.id!, {
                          concepto: "No_conforme",
                        })
                      }
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        elem.concepto === "No_conforme"
                          ? "bg-red-500 text-white border-red-600 shadow-md"
                          : "bg-red-50 text-red-500 border-red-200"
                      }`}
                    >
                      No Conforme
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
