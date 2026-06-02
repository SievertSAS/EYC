"use client";

import { use, useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Gauge,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";
import type { MedicionRadiometrica } from "@/lib/db/types";

const FACTORES_OCUPACION = [
  { value: "1", label: "T=1 (Ocupación completa)" },
  { value: "1/4", label: "T=1/4 (Ocupación parcial)" },
  { value: "1/16", label: "T=1/16 (Ocupación ocasional)" },
  { value: "1/40", label: "T=1/40 (Ocupación mínima)" },
];

const TIPOS_AREA = [
  { value: "controlada", label: "Controlada" },
  { value: "supervisada", label: "Supervisada" },
];

export default function LevantamientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Mediciones existentes (reactivas)
  const mediciones = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return undefined;
    return db.mediciones_radiometricas.where("visita_id").equals(visitaId).sortBy("punto_numero");
  }, [isReady, visitaId]);

  // Sala dimensiones para contexto
  const visita = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    return db.visitas.get(visitaId);
  }, [isReady, visitaId]);

  const sala = useLiveQuery(async () => {
    if (!visita?.ubicacion_id) return null;
    return db.sala_dimensiones.where("ubicacion_id").equals(visita.ubicacion_id).first();
  }, [visita?.ubicacion_id]);

  // Agregar punto
  const agregarPunto = useCallback(async () => {
    const siguienteNumero = (mediciones?.length ?? 0) + 1;
    const now = new Date().toISOString();
    await db.mediciones_radiometricas.add({
      visita_id: visitaId,
      punto_numero: siguienteNumero,
      ubicacion_descripcion: "",
      tipo_area: "supervisada",
      factor_ocupacion: "1",
      sync_status: "pending",
      last_modified: now,
      creado_en: now,
    });
  }, [visitaId, mediciones?.length]);

  // Actualizar campo de un punto
  const actualizarPunto = useCallback(
    async (puntoId: number, campo: Partial<MedicionRadiometrica>) => {
      try {
        setSaveStatus("saving");
        await db.mediciones_radiometricas.update(puntoId, {
          ...campo,
          last_modified: new Date().toISOString(),
          sync_status: "pending",
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    []
  );

  // Eliminar punto
  const eliminarPunto = useCallback(
    async (puntoId: number) => {
      await db.mediciones_radiometricas.delete(puntoId);
      // Renumerar puntos restantes
      const restantes = await db.mediciones_radiometricas
        .where("visita_id")
        .equals(visitaId)
        .sortBy("punto_numero");
      for (let i = 0; i < restantes.length; i++) {
        if (restantes[i].punto_numero !== i + 1) {
          await db.mediciones_radiometricas.update(restantes[i].id!, {
            punto_numero: i + 1,
          });
        }
      }
    },
    [visitaId]
  );

  if (!isReady || mediciones === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando levantamiento...</p>
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
          <p className="text-slate-500 font-bold text-lg">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación entre módulos */}
      <ModuleNav visitaId={visitaId} currentModule="levantamiento" />

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
            Levantamiento Radiométrico
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Puntos de medición de tasa de dosis
          </p>
        </div>
        <Button
          onClick={agregarPunto}
          className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-10 px-4 text-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Agregar punto
        </Button>
      </div>

      {/* Referencia de la sala */}
      {sala && (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>
                Sala: {sala.ancho_m}m × {sala.largo_m}m × {sala.alto_m}m (Área: {sala.area_m2} m²)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de puntos */}
      {mediciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <Gauge className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Sin puntos de medición</p>
          <p className="text-slate-400 text-sm">
            Agrega puntos para registrar la tasa de dosis en diferentes ubicaciones de la sala.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {mediciones.map((punto) => (
            <PuntoMedicion
              key={punto.id}
              punto={punto}
              onUpdate={actualizarPunto}
              onDelete={eliminarPunto}
              totalPuntos={mediciones.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente de punto de medición ───

function PuntoMedicion({
  punto,
  onUpdate,
  onDelete,
  totalPuntos,
}: {
  punto: MedicionRadiometrica;
  onUpdate: (id: number, campo: Partial<MedicionRadiometrica>) => void;
  onDelete: (id: number) => void;
  totalPuntos: number;
}) {
  const debounceRef = useCallback(
    (campo: Partial<MedicionRadiometrica>) => {
      onUpdate(punto.id!, campo);
    },
    [punto.id, onUpdate]
  );

  const conceptoColor =
    punto.concepto === "Conforme"
      ? "bg-emerald-500 text-white border-emerald-600"
      : punto.concepto === "No_conforme"
        ? "bg-red-500 text-white border-red-600"
        : "bg-slate-100 text-slate-500 border-slate-300";

  return (
    <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        {/* Header del punto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
              {punto.punto_numero}
            </div>
            <h4 className="font-black text-slate-900 text-sm">Punto #{punto.punto_numero}</h4>
          </div>
          {totalPuntos > 0 && (
            <button
              onClick={() => onDelete(punto.id!)}
              className="text-red-400 hover:text-red-600 transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Campos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Ubicación descripción */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Ubicación / Descripción del punto
            </Label>
            <Input
              type="text"
              placeholder="Ej: Puerta principal de acceso, Zona A"
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-10 text-sm"
              defaultValue={punto.ubicacion_descripcion}
              onBlur={(e) => debounceRef({ ubicacion_descripcion: e.target.value })}
            />
          </div>

          {/* Tasa de dosis */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Tasa de dosis (mSv/h)
            </Label>
            <Input
              type="number"
              step="0.001"
              placeholder="Ej: 0.005"
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-10 text-sm"
              defaultValue={punto.tasa_dosis_msv_h ?? ""}
              onBlur={(e) =>
                debounceRef({
                  tasa_dosis_msv_h: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>

          {/* Factor de ocupación */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Factor de ocupación
            </Label>
            <select
              className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-10 text-sm px-3 outline-none transition-colors bg-white"
              defaultValue={punto.factor_ocupacion ?? "1"}
              onChange={(e) => debounceRef({ factor_ocupacion: e.target.value })}
            >
              {FACTORES_OCUPACION.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de área */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Tipo de área
            </Label>
            <select
              className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-10 text-sm px-3 outline-none transition-colors bg-white"
              defaultValue={punto.tipo_area ?? "supervisada"}
              onChange={(e) =>
                debounceRef({
                  tipo_area: e.target.value as "controlada" | "supervisada",
                })
              }
            >
              {TIPOS_AREA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dosis anual estimada */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Dosis anual (mSv)
            </Label>
            <Input
              type="number"
              step="0.001"
              placeholder="Ej: 0.12"
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-10 text-sm"
              defaultValue={punto.dosis_anual_msv ?? ""}
              onBlur={(e) =>
                debounceRef({
                  dosis_anual_msv: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>

          {/* Concepto */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Concepto
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => debounceRef({ concepto: "Conforme" })}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  punto.concepto === "Conforme"
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
                    : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:shadow-sm"
                }`}
              >
                Conforme
              </button>
              <button
                onClick={() => debounceRef({ concepto: "No_conforme" })}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  punto.concepto === "No_conforme"
                    ? "bg-red-500 text-white border-red-600 shadow-md"
                    : "bg-red-50 text-red-500 border-red-200 hover:shadow-sm"
                }`}
              >
                No Conforme
              </button>
            </div>
          </div>

          {/* Observación */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Observación
            </Label>
            <Input
              type="text"
              placeholder="Observaciones del punto..."
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-10 text-sm"
              defaultValue={punto.observacion ?? ""}
              onBlur={(e) => debounceRef({ observacion: e.target.value || undefined })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
