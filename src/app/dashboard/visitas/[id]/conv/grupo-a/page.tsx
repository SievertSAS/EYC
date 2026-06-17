"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import {
  ArrowLeft,
  Gauge,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Lightbulb,
  Zap,
  Shield,
  Eye,
  ChevronDown,
  ChevronUp,
  Camera,
  Check,
  ImageIcon,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ManualDrawer } from "@/components/manual-drawer";
import { getManualGrupo } from "@/lib/equipos/convencional/manual";
import type { ConvInspeccionItem } from "@/lib/equipos/convencional/db/types";

// ─── Constants ───

import {
  ITEMS_INSPECCION_EQUIPO,
  ITEMS_CONDICIONES_OPERACION,
} from "@/lib/equipos/convencional/inspeccion-items";

/** Catálogo de elementos de protección radiológica estandarizados */
const CATALOGO_ELEMENTOS_PROTECCION = [
  "Chaleco plomado",
  "Protector de tiroides",
  "Guantes plomados",
  "Gafas plomadas",
  "Protector gonadal",
  "Biombo plomado / mampara móvil",
  "Falda plomada",
  "Delantal plomado",
  "Porta-sueros plomado",
  "Otro",
];

const SLOTS_IMAGEN_21 = [
  { slot: "plano_radiometrico", label: "Plano / Croquis radiométrico de la sala" },
];

/** Carga de trabajo estándar para radiografía convencional (mA·min/sem) — piso del cálculo, metodología IAEA-TECDOC-1958 */
const W_ESTANDAR = 160;

type Concepto = "Conforme" | "No_conforme" | "No_aplica";

// ─── Helpers ───

function num(v: string | number | undefined | null): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ─── UI Components ───

/** Alerta amarilla — advertencia crítica (si no la sigues, invalidas la prueba o dañas algo) */
function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

/** Recomendación morada — tip metodológico, buena práctica */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-primary font-medium">
      <Lightbulb className="w-4 h-4 text-primary/70 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function StepHeader({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 p-2.5 rounded-xl flex-shrink-0">
        <Icon className="text-primary w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{step}</p>
        <h3 className="font-black text-slate-900 text-sm sm:text-base">{title}</h3>
        {children && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{children}</p>}
      </div>
    </div>
  );
}

function ConceptoSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: Concepto) => void;
}) {
  const color =
    value === "Conforme"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : value === "No_conforme"
        ? "border-red-300 bg-red-50 text-red-700"
        : value === "No_aplica"
          ? "border-slate-300 bg-slate-50 text-slate-500"
          : "border-slate-200 bg-white text-slate-600";
  return (
    <select
      className={`rounded-xl font-bold text-xs h-9 px-2 border ${color} min-w-[120px]`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as Concepto)}
    >
      <option value="">Seleccionar</option>
      <option value="Conforme">Conforme</option>
      <option value="No_conforme">No conforme</option>
      <option value="No_aplica">No aplica</option>
    </select>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

function ImageSlot({
  label,
  evidencia,
  onCapture,
  onRemove,
}: {
  label: string;
  evidencia?: { id?: number; blob_local?: Blob };
  onCapture: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (evidencia?.blob_local) {
      const url = URL.createObjectURL(evidencia.blob_local);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [evidencia?.blob_local]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200">
          <img src={preview} alt={label} className="w-full h-48 object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-colors"
        >
          <Camera className="w-6 h-6" />
          <span className="text-xs font-bold">Tomar foto o seleccionar</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Main Page ───

export default function GrupoAPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const pruebasGrupoA = getManualGrupo("A");

  // ─── Live data from dedicated conv_ tables ───
  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [setup, mediciones, inspeccion, elementos, evidencias] = await Promise.all([
      db.conv_levantamiento_setup.where("visita_id").equals(visitaId).first(),
      db.conv_mediciones.where("visita_id").equals(visitaId).sortBy("punto_numero"),
      db.conv_inspeccion_items.where("visita_id").equals(visitaId).toArray(),
      db.conv_elementos_proteccion.where("visita_id").equals(visitaId).toArray(),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
    ]);

    return { visita, setup, mediciones, inspeccion, elementos, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize setup if missing ───
  useEffect(() => {
    if (!data || data.setup) return;
    db.conv_levantamiento_setup.add({
      visita_id: visitaId,
      w_estandar: 160,
      semanas_laborales: 50,
      creado_en: new Date().toISOString(),
    });
  }, [data, visitaId]);

  // ─── Initialize inspection items if missing ───
  useEffect(() => {
    if (!data || data.inspeccion.length > 0) return;
    const now = new Date().toISOString();
    const items: Omit<ConvInspeccionItem, "id">[] = [
      ...ITEMS_INSPECCION_EQUIPO.map((_, i) => ({
        visita_id: visitaId,
        seccion: "equipo" as const,
        item_numero: i + 1,
        creado_en: now,
      })),
      ...ITEMS_CONDICIONES_OPERACION.map((_, i) => ({
        visita_id: visitaId,
        seccion: "condiciones_operacion" as const,
        item_numero: i + 1,
        creado_en: now,
      })),
    ];
    db.conv_inspeccion_items.bulkAdd(items);
  }, [data, visitaId]);

  // ─── Save helpers ───
  const setupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Acumula los campos pendientes — con un solo timer, editar varios campos
  // seguidos descartaba todos menos el último.
  const setupPending = useRef<Record<string, unknown>>({});

  function updateSetup(fields: Record<string, unknown>) {
    if (!data?.setup?.id) return;
    Object.assign(setupPending.current, fields);
    if (setupTimer.current) clearTimeout(setupTimer.current);
    setupTimer.current = setTimeout(() => {
      const payload = setupPending.current;
      setupPending.current = {};
      db.conv_levantamiento_setup.update(data.setup!.id!, payload);
    }, 600);
  }

  async function addMedicion() {
    const next = (data?.mediciones?.length ?? 0) + 1;
    await db.conv_mediciones.add({
      visita_id: visitaId,
      punto_numero: next,
      ubicacion_descripcion: "",
      factor_ocupacion_t: 1,
      factor_uso_u: 1,
      creado_en: new Date().toISOString(),
    });
  }

  async function updateMedicion(id: number, fields: Record<string, unknown>) {
    // Merge fields with current row to recalculate
    const current = await db.conv_mediciones.get(id);
    if (!current) return;

    const merged = { ...current, ...fields };
    const usvH = num(merged.tasa_dosis_usv_h);
    const t = num(merged.factor_ocupacion_t) || 1;
    const u = num(merged.factor_uso_u) || 1;
    const w = wUsado;
    const i = corrientePrueba;
    const msvH = usvH / 1000;
    const dosis = i > 0 ? (msvH * (1 / 60) * t * u * w * semanasLaborales) / i : 0;
    const tipoArea = (merged.tipo_area ?? "") as string;
    let concepto: "Conforme" | "No_conforme" | undefined;
    if (tipoArea === "controlada") concepto = dosis <= 5 ? "Conforme" : "No_conforme";
    else if (tipoArea === "supervisada") concepto = dosis <= 0.5 ? "Conforme" : "No_conforme";

    await db.conv_mediciones.update(id, {
      ...fields,
      tasa_dosis_msv_h: msvH || undefined,
      factor_uso_u: u,
      carga_trabajo_w: w,
      corriente_prueba_i: i,
      dosis_anual_msv: i > 0 ? dosis : undefined,
      concepto,
    });
  }

  async function removeMedicion(id: number) {
    await db.conv_mediciones.delete(id);
  }

  async function updateInspeccionItem(id: number, fields: Record<string, unknown>) {
    await db.conv_inspeccion_items.update(id, fields);
  }

  async function addElemento() {
    await db.conv_elementos_proteccion.add({
      visita_id: visitaId,
      descripcion: "",
      creado_en: new Date().toISOString(),
    });
  }

  async function updateElemento(id: number, fields: Record<string, unknown>) {
    await db.conv_elementos_proteccion.update(id, fields);
  }

  async function removeElemento(id: number) {
    await db.conv_elementos_proteccion.delete(id);
  }

  async function captureImage(pruebaCodigo: string, slot: string, file: File) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const existing = data?.evidencias?.find(
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot
    );
    if (existing?.id) {
      await db.conv_evidencias.update(existing.id, { blob_local: blob });
    } else {
      await db.conv_evidencias.add({
        visita_id: visitaId,
        prueba_codigo: pruebaCodigo,
        slot,
        blob_local: blob,
        fecha_captura: new Date().toISOString(),
        creado_en: new Date().toISOString(),
      });
    }
  }

  async function removeImage(pruebaCodigo: string, slot: string) {
    const existing = data?.evidencias?.find(
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot
    );
    if (existing?.id) await db.conv_evidencias.delete(existing.id);
  }

  // ─── Derived values ───
  const setup = data?.setup;
  const nrSemana = data?.visita?.radiografias_por_semana ?? 0;
  const masMaxClinico = data?.visita?.mas_maximo_usado ?? 0;
  const wEstimada = (nrSemana * masMaxClinico) / 60;
  const wUsado = Math.max(wEstimada, W_ESTANDAR);
  const corrientePrueba = num(setup?.tecnica_ma);
  const semanasLaborales = num(setup?.semanas_laborales) || 50;

  // Recalcular todas las mediciones cuando cambia un parámetro global del cálculo
  // (W, corriente I, semanas) — si no, las filas conservan la dosis vieja.
  useEffect(() => {
    if (!data?.mediciones?.length) return;
    for (const m of data.mediciones) {
      if (m.id != null) updateMedicion(m.id, {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wUsado, corrientePrueba, semanasLaborales]);

  const inspeccionEquipo = (data?.inspeccion ?? []).filter((i) => i.seccion === "equipo");
  const condicionesOp = (data?.inspeccion ?? []).filter(
    (i) => i.seccion === "condiciones_operacion"
  );

  function getEvidencia(prueba: string, slot: string) {
    return data?.evidencias?.find((e) => e.prueba_codigo === prueba && e.slot === slot);
  }

  // ─── Loading / Error ───
  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando módulo...</p>
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="flex flex-col items-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <Link
        href={`/dashboard/visitas/${id}`}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al workspace
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">
            Grupo A — Pruebas 2.1 y 2.2
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            Levantamiento Radiométrico e Inspección Visual
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Registra las mediciones de tasa de dosis alrededor de la sala y completa la inspección
            visual del equipo e instalación.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl font-bold text-xs flex-shrink-0 gap-1.5"
          onClick={() => {
            setManualPrueba(undefined);
            setManualOpen(true);
          }}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Ver manual</span>
        </Button>
      </div>

      {/* ════════════════════════════════════════════
          PRUEBA 2.1 — LEVANTAMIENTO RADIOMÉTRICO
          ════════════════════════════════════════════ */}

      {/* Imágenes de la prueba 2.1 */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.1 — Imágenes" title="Plano radiométrico" icon={ImageIcon}>
            Captura el croquis/plano de la sala con los puntos de medición.
          </StepHeader>
          <Tip>
            Usa planos anteriores si están vigentes. Lo ideal es solicitar un plano de la sala al
            cliente antes de la visita.
          </Tip>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLOTS_IMAGEN_21.map((s) => (
              <ImageSlot
                key={s.slot}
                label={s.label}
                evidencia={getEvidencia("2.1", s.slot)}
                onCapture={(file) => captureImage("2.1", s.slot, file)}
                onRemove={() => removeImage("2.1", s.slot)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Paso 1: Parámetros */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.1 — Paso 1" title="Parámetros de la prueba" icon={Gauge}>
            Configura los datos base antes de tomar las mediciones.
          </StepHeader>

          <Alert>
            No irradiar el Flat Panel o cassette — retírelo del Bucky antes de iniciar las
            mediciones.
          </Alert>

          <CollapsibleSection title="Fondo natural y distancia">
            <Tip>
              Toma varias muestras de fondo natural en 10 segundos con el equipo apagado y obtén la
              tasa promedio.
            </Tip>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Fondo natural (μSv/h)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  className="rounded-xl h-9 text-sm font-medium"
                  defaultValue={setup?.fondo_natural_usv_h ?? ""}
                  onBlur={(e) =>
                    updateSetup({
                      fondo_natural_usv_h: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="Ej: 0.08"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Distancia tubo — operario (m)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl h-9 text-sm font-medium"
                  defaultValue={setup?.distancia_tubo_operario_m ?? ""}
                  onBlur={(e) =>
                    updateSetup({
                      distancia_tubo_operario_m: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Ej: 2.5"
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Técnica radiográfica utilizada en la prueba">
            <Alert>
              Estos son los parámetros con los que vas a irradiar durante el levantamiento — no
              confundir con los máximos clínicos de la precarga.
            </Alert>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["tecnica_kv", "Tensión (kV)", "70"],
                  ["tecnica_ma", "Corriente (mA)", "200"],
                  ["tecnica_tiempo_s", "Tiempo (s)", "0.1"],
                  ["tecnica_mas", "Exposición (mAs)", "20"],
                ] as const
              ).map(([field, label, ph]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {label}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="rounded-xl h-9 text-sm font-medium"
                    defaultValue={setup?.[field] ?? ""}
                    onBlur={(e) =>
                      updateSetup({
                        [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Carga de trabajo">
            <Tip>
              Se usa el mayor entre W estimada y W estándar (160 mA·min/sem). El factor de uso U se
              selecciona por punto en la tabla de mediciones.
            </Tip>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Radiografías / semana (precarga)
                </label>
                <div className="h-9 flex items-center text-sm font-bold text-slate-700 bg-slate-50 rounded-xl px-3">
                  {nrSemana || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  mAs máx. clínico (precarga)
                </label>
                <div className="h-9 flex items-center text-sm font-bold text-slate-700 bg-slate-50 rounded-xl px-3">
                  {masMaxClinico || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  W estimada (mA·min/sem)
                </label>
                <div className="h-9 flex items-center text-sm font-black text-primary bg-primary/5 rounded-xl px-3">
                  {wEstimada.toFixed(1)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  W estándar (mA·min/sem)
                </label>
                <div className="h-9 flex items-center text-sm font-bold text-slate-700 bg-slate-50 rounded-xl px-3">
                  {W_ESTANDAR}{" "}
                  <span className="ml-2 text-[10px] text-slate-400 font-medium">
                    fija — TECDOC-1958
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  W usado = max(estimada, estándar)
                </label>
                <div className="h-9 flex items-center text-sm font-black text-emerald-700 bg-emerald-50 rounded-xl px-3">
                  {wUsado.toFixed(1)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Corriente prueba I (mA)
                </label>
                <div className="h-9 flex items-center text-sm font-bold text-slate-700 bg-slate-50 rounded-xl px-3">
                  {corrientePrueba || "← Llena técnica"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Semanas laborales
                </label>
                <Input
                  type="number"
                  className="rounded-xl h-9 text-sm font-medium"
                  defaultValue={setup?.semanas_laborales ?? 50}
                  onBlur={(e) =>
                    updateSetup({
                      semanas_laborales: e.target.value ? parseFloat(e.target.value) : 50,
                    })
                  }
                />
                {semanasLaborales < 50 && (
                  <p className="text-[10px] font-bold text-amber-600">
                    Menos de 50 semanas reduce la dosis anual calculada — justifícalo en el informe.
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* Paso 2: Tabla de mediciones */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.1 — Paso 2" title="Mediciones radiométricas" icon={Zap}>
            Registra la lectura de tasa de dosis en cada punto de la sala.
          </StepHeader>

          <Tip>
            Fórmula: H*(10) = Lectura(mSv/h) × (1/60) × T × U × W × semanas laborales / I. Área
            controlada ≤ 5 mSv/año, supervisada ≤ 0.5 mSv/año.
          </Tip>

          {/* Table header */}
          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    ["#", "w-10"],
                    ["PUNTO DE MEDICIÓN", "min-w-[160px]"],
                    ["LECTURA (μSv/h)", "w-24"],
                    ["DOSIS (mSv/h)", "w-24"],
                    ["T", "w-16"],
                    ["U", "w-16"],
                    ["TIPO ÁREA", "w-28"],
                    ["H*(10) (mSv/año)", "w-28"],
                    ["CONCEPTO", "w-24"],
                    ["", "w-8"],
                  ].map(([label, cls]) => (
                    <th
                      key={label}
                      className={`text-[9px] font-black text-slate-400 tracking-widest text-left py-2 px-1.5 ${cls}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.mediciones.map((m) => {
                  const usvH = m.tasa_dosis_usv_h ?? 0;
                  const dosis = m.dosis_anual_msv ?? 0;
                  const isConf = m.concepto === "Conforme";
                  const isNoConf = m.concepto === "No_conforme";

                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 font-black text-primary">{m.punto_numero}</td>
                      <td className="py-1.5 px-1.5">
                        <Input
                          className="rounded-lg h-7 text-xs font-medium border-slate-200"
                          defaultValue={m.ubicacion_descripcion}
                          placeholder="Ej: Puerta principal"
                          onBlur={(e) =>
                            m.id && updateMedicion(m.id, { ubicacion_descripcion: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <Input
                          type="number"
                          step="0.001"
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-20"
                          defaultValue={m.tasa_dosis_usv_h ?? ""}
                          placeholder="0.00"
                          onBlur={(e) => {
                            if (!m.id) return;
                            const usv = e.target.value ? parseFloat(e.target.value) : undefined;
                            updateMedicion(m.id, { tasa_dosis_usv_h: usv });
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-500 font-mono">
                        {(usvH / 1000).toFixed(5)}
                      </td>
                      <td className="py-1.5 px-1.5">
                        <select
                          className="rounded-lg border border-slate-200 h-7 text-xs font-medium px-1 bg-white w-full"
                          defaultValue={m.factor_ocupacion_t ?? 1}
                          onChange={(e) =>
                            m.id &&
                            updateMedicion(m.id, { factor_ocupacion_t: parseFloat(e.target.value) })
                          }
                        >
                          <option value={1}>1</option>
                          <option value={0.5}>0.5</option>
                          <option value={0.2}>0.2</option>
                          <option value={0.05}>0.05</option>
                          <option value={0.025}>0.025</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <select
                          className="rounded-lg border border-slate-200 h-7 text-xs font-medium px-1 bg-white w-full"
                          defaultValue={m.factor_uso_u ?? 1}
                          onChange={(e) =>
                            m.id &&
                            updateMedicion(m.id, { factor_uso_u: parseFloat(e.target.value) })
                          }
                        >
                          <option value={0.3}>0.3</option>
                          <option value={0.7}>0.7</option>
                          <option value={1}>1</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <select
                          className="rounded-lg border border-slate-200 h-7 text-xs font-medium px-1 bg-white w-full"
                          defaultValue={m.tipo_area ?? ""}
                          onChange={(e) =>
                            m.id && updateMedicion(m.id, { tipo_area: e.target.value || undefined })
                          }
                        >
                          <option value="">—</option>
                          <option value="controlada">Controlada</option>
                          <option value="supervisada">Supervisada</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-1.5 font-black text-primary font-mono">
                        {dosis > 0 ? dosis.toFixed(6) : "—"}
                      </td>
                      <td className="py-1.5 px-1.5">
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                            isConf
                              ? "bg-emerald-50 text-emerald-700"
                              : isNoConf
                                ? "bg-red-50 text-red-700"
                                : "text-slate-300"
                          }`}
                        >
                          {isConf ? "Conforme" : isNoConf ? "No conforme" : "—"}
                        </span>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <button
                          type="button"
                          onClick={() => m.id && removeMedicion(m.id)}
                          className="text-red-300 hover:text-red-500 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-2 h-10 font-bold text-sm"
            onClick={addMedicion}
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar punto de medición
          </Button>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════
          PRUEBA 2.2 — INSPECCIÓN VISUAL
          ════════════════════════════════════════════ */}

      {/* Paso 3: Inspección del equipo */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.2 — Paso 3" title="Inspección visual del equipo" icon={Eye}>
            Evalúa el estado físico y funcional del equipo de rayos X.
          </StepHeader>

          <div className="space-y-3">
            {ITEMS_INSPECCION_EQUIPO.map((desc, idx) => {
              const item = inspeccionEquipo.find((i) => i.item_numero === idx + 1);
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-black text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed flex-1">
                      {desc}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pl-9">
                    <ConceptoSelect
                      value={item?.concepto}
                      onChange={(v) =>
                        item?.id &&
                        updateInspeccionItem(item.id, {
                          concepto: v,
                          // La observación solo aplica a no conformidades — limpiar al cambiar
                          ...(v !== "No_conforme" ? { observacion: undefined } : {}),
                        })
                      }
                    />
                    <Input
                      key={`${item?.id}-${item?.concepto}`}
                      className="rounded-xl h-9 text-xs font-medium flex-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      placeholder={
                        item?.concepto === "No_conforme"
                          ? "Describe la no conformidad"
                          : "Solo aplica si es no conforme"
                      }
                      disabled={item?.concepto !== "No_conforme"}
                      defaultValue={item?.observacion ?? ""}
                      onBlur={(e) =>
                        item?.id && updateInspeccionItem(item.id, { observacion: e.target.value })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Paso 4: Condiciones de operación */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.2 — Paso 4" title="Condiciones de operación" icon={Shield}>
            Verifica las condiciones de seguridad y protección radiológica de la instalación.
          </StepHeader>

          <div className="space-y-3">
            {ITEMS_CONDICIONES_OPERACION.map((desc, idx) => {
              const item = condicionesOp.find((i) => i.item_numero === idx + 1);
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-black text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed flex-1">
                      {desc}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pl-9">
                    <ConceptoSelect
                      value={item?.concepto}
                      onChange={(v) =>
                        item?.id &&
                        updateInspeccionItem(item.id, {
                          concepto: v,
                          // La observación solo aplica a no conformidades — limpiar al cambiar
                          ...(v !== "No_conforme" ? { observacion: undefined } : {}),
                        })
                      }
                    />
                    <Input
                      key={`${item?.id}-${item?.concepto}`}
                      className="rounded-xl h-9 text-xs font-medium flex-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      placeholder={
                        item?.concepto === "No_conforme"
                          ? "Describe la no conformidad"
                          : "Solo aplica si es no conforme"
                      }
                      disabled={item?.concepto !== "No_conforme"}
                      defaultValue={item?.observacion ?? ""}
                      onBlur={(e) =>
                        item?.id && updateInspeccionItem(item.id, { observacion: e.target.value })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Paso 5: Elementos de protección */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader
            step="Prueba 2.2 — Paso 5"
            title="Elementos de protección radiológica"
            icon={Shield}
          >
            Registra los elementos disponibles en la sala (chalecos, protectores de tiroides,
            guantes plomados, etc.)
          </StepHeader>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    ["#", "w-8"],
                    ["Elemento", "min-w-[200px]"],
                    ["Cant.", "w-16"],
                    ["Tipo", "w-24"],
                    ["Concepto", "w-28"],
                    ["Observaciones", "min-w-[160px]"],
                    ["", "w-8"],
                  ].map(([label, cls]) => (
                    <th
                      key={label}
                      className={`text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1.5 ${cls}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.elementos ?? []).map((elem, idx) => (
                  <tr key={elem.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-black text-primary">{idx + 1}</td>
                    <td className="py-1.5 px-1.5">
                      <select
                        className="w-full rounded-lg border border-slate-200 h-7 text-xs font-medium px-1 bg-white"
                        defaultValue={elem.descripcion}
                        onChange={(e) =>
                          elem.id && updateElemento(elem.id, { descripcion: e.target.value })
                        }
                      >
                        <option value="">Seleccionar elemento</option>
                        {CATALOGO_ELEMENTOS_PROTECCION.map((nombre) => (
                          <option key={nombre} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        type="number"
                        className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                        defaultValue={elem.cantidad ?? ""}
                        onBlur={(e) =>
                          elem.id &&
                          updateElemento(elem.id, {
                            cantidad: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <select
                        className="rounded-xl font-bold text-xs h-9 px-2 border border-slate-200 bg-white text-slate-600 min-w-[110px]"
                        defaultValue={elem.tipo_paciente ?? ""}
                        onChange={(e) =>
                          elem.id &&
                          updateElemento(elem.id, { tipo_paciente: e.target.value || undefined })
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option value="adulto">Adulto</option>
                        <option value="pediatrico">Pediátrico</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-1.5">
                      <ConceptoSelect
                        value={elem.concepto}
                        onChange={(v) => elem.id && updateElemento(elem.id, { concepto: v })}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        className="rounded-lg h-7 text-xs font-medium border-slate-200"
                        placeholder="Estado, grosor, etc."
                        defaultValue={elem.observacion ?? ""}
                        onBlur={(e) =>
                          elem.id && updateElemento(elem.id, { observacion: e.target.value })
                        }
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <button
                        type="button"
                        onClick={() => elem.id && removeElemento(elem.id)}
                        className="text-red-300 hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-2 h-10 font-bold text-sm"
            onClick={addElemento}
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar elemento de protección
          </Button>
        </CardContent>
      </Card>

      <ManualDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pruebas={pruebasGrupoA}
        pruebaCodigo={manualPrueba}
      />
    </div>
  );
}
