"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Thermometer,
  Gauge,
  Activity,
  Users,
  Zap,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
} from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";

/** Campos del formulario de condiciones */
interface CondicionesForm {
  temperatura_c: string;
  presion_hpa: string;
  dias_laborados_semana: string;
  pacientes_por_semana: string;
  radiografias_por_semana: string;
  kv_maximo_usado: string;
  mas_maximo_usado: string;
  max_disparos_paciente: string;
  porcentaje_rechazo: string;
  observaciones: string;
}

const EMPTY_FORM: CondicionesForm = {
  temperatura_c: "",
  presion_hpa: "",
  dias_laborados_semana: "",
  pacientes_por_semana: "",
  radiografias_por_semana: "",
  kv_maximo_usado: "",
  mas_maximo_usado: "",
  max_disparos_paciente: "",
  porcentaje_rechazo: "",
  observaciones: "",
};

/** Convierte número | undefined a string para el input */
function numToStr(val: number | undefined | null): string {
  return val != null ? String(val) : "";
}

/** Convierte string a número | undefined para guardar */
function strToNum(val: string): number | undefined {
  const trimmed = val.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return isNaN(n) ? undefined : n;
}

export default function CondicionesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();

  const [form, setForm] = useState<CondicionesForm>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cargar datos de la visita
  const visita = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    return db.visitas.get(visitaId);
  }, [isReady, visitaId]);

  // Inicializar formulario cuando la visita carga
  useEffect(() => {
    if (visita && !initialized) {
      setForm({
        temperatura_c: numToStr(visita.temperatura_c),
        presion_hpa: numToStr(visita.presion_hpa),
        dias_laborados_semana: numToStr(visita.dias_laborados_semana),
        pacientes_por_semana: numToStr(visita.pacientes_por_semana),
        radiografias_por_semana: numToStr(visita.radiografias_por_semana),
        kv_maximo_usado: numToStr(visita.kv_maximo_usado),
        mas_maximo_usado: numToStr(visita.mas_maximo_usado),
        max_disparos_paciente: numToStr(visita.max_disparos_paciente),
        porcentaje_rechazo: numToStr(visita.porcentaje_rechazo),
        observaciones: visita.observaciones ?? "",
      });
      setInitialized(true);
    }
  }, [visita, initialized]);

  // Autosave con debounce
  const saveToDb = useCallback(
    async (data: CondicionesForm) => {
      if (isNaN(visitaId)) return;
      try {
        setSaveStatus("saving");
        await db.visitas.update(visitaId, {
          temperatura_c: strToNum(data.temperatura_c),
          presion_hpa: strToNum(data.presion_hpa),
          dias_laborados_semana: strToNum(data.dias_laborados_semana),
          pacientes_por_semana: strToNum(data.pacientes_por_semana),
          radiografias_por_semana: strToNum(data.radiografias_por_semana),
          kv_maximo_usado: strToNum(data.kv_maximo_usado),
          mas_maximo_usado: strToNum(data.mas_maximo_usado),
          max_disparos_paciente: strToNum(data.max_disparos_paciente),
          porcentaje_rechazo: strToNum(data.porcentaje_rechazo),
          observaciones: data.observaciones || undefined,
          last_modified: new Date().toISOString(),
          sync_status: "pending",
        });
        setSaveStatus("saved");
        // Volver a idle después de 2s
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [visitaId]
  );

  const handleChange = useCallback(
    (field: keyof CondicionesForm, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        // Debounce autosave 800ms
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => saveToDb(next), 800);
        return next;
      });
    },
    [saveToDb]
  );

  // Cleanup debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!isReady || visita === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando condiciones...</p>
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

  return (
    <div className="space-y-6">
      {/* Navegación entre módulos */}
      <ModuleNav visitaId={visitaId} currentModule="condiciones" />

      <div className="flex items-center justify-end gap-3">
        {/* Indicador de guardado */}
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
              Error al guardar
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          Condiciones
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Ambientales y de operación — guardado automático
        </p>
      </div>

      {/* Condiciones Ambientales */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Thermometer className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Condiciones Ambientales
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Registrar al momento de la visita
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Temperatura (°C)
              </Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 22.5"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.temperatura_c}
                onChange={(e) =>
                  handleChange("temperatura_c", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Presión (hPa)
              </Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 1013.25"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.presion_hpa}
                onChange={(e) =>
                  handleChange("presion_hpa", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condiciones de Operación */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Activity className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Condiciones de Operación
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Datos de carga de trabajo del equipo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Días laborados / semana
              </Label>
              <Input
                type="number"
                min="1"
                max="7"
                placeholder="Ej: 5"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.dias_laborados_semana}
                onChange={(e) =>
                  handleChange("dias_laborados_semana", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Pacientes / semana
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 120"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.pacientes_por_semana}
                onChange={(e) =>
                  handleChange("pacientes_por_semana", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Radiografías / semana
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 200"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.radiografias_por_semana}
                onChange={(e) =>
                  handleChange("radiografias_por_semana", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Técnica Radiográfica */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Zap className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Técnica Radiográfica Máxima
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Valores máximos usados en operación habitual
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                kV máximo usado
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 80"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.kv_maximo_usado}
                onChange={(e) =>
                  handleChange("kv_maximo_usado", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                mAs máximo usado
              </Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 32"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.mas_maximo_usado}
                onChange={(e) =>
                  handleChange("mas_maximo_usado", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Máx. disparos / paciente
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 3"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.max_disparos_paciente}
                onChange={(e) =>
                  handleChange("max_disparos_paciente", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                % Rechazo
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Ej: 5"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={form.porcentaje_rechazo}
                onChange={(e) =>
                  handleChange("porcentaje_rechazo", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FileText className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Observaciones
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Notas adicionales sobre las condiciones
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <textarea
              rows={4}
              placeholder="Observaciones sobre el estado del equipo, condiciones especiales..."
              className="w-full rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-medium p-3 text-sm resize-none outline-none transition-colors"
              value={form.observaciones}
              onChange={(e) =>
                handleChange("observaciones", e.target.value)
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
