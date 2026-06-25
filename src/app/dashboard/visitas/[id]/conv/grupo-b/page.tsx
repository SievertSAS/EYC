"use client";

import { use, useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import {
  ArrowLeft,
  Zap,
  Trash2,
  Loader2,
  AlertCircle,
  Lightbulb,
  FileSpreadsheet,
  Camera,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import {
  parseRaysafeFile,
  parseRaysafeXlsx,
  type RaysafeRow,
} from "@/lib/equipos/convencional/raysafe-parser";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ManualDrawer } from "@/components/manual-drawer";
import { getManualGrupo } from "@/lib/equipos/convencional/manual";

// ─── Constants ───

/** Estructura de los 8 grupos de disparos principales */
const GRUPOS_DISPAROS = [
  { grupo: 1, kv: 60, mas: 10, repeticiones: 3, para: "Tiempo, kVp, CHR" },
  { grupo: 2, kv: 80, mas: 5, repeticiones: 3, para: "Tiempo, kVp, CHR, Rendimiento" },
  { grupo: 3, kv: 80, mas: 10, repeticiones: 3, para: "Rendimiento (repetibilidad)" },
  { grupo: 4, kv: 80, mas: null, repeticiones: 3, para: "Rendimiento (linealidad)" },
  { grupo: 5, kv: 80, mas: null, repeticiones: 3, para: "Rendimiento (linealidad)" },
  { grupo: 6, kv: 90, mas: 10, repeticiones: 3, para: "Tiempo, kVp, CHR, Rendimiento" },
  { grupo: 7, kv: 80, mas: 10, repeticiones: 1, para: "Dosis receptor (referencia)" },
  { grupo: 8, kv: 80, mas: 10, repeticiones: 1, para: "Dosis receptor (referencia)" },
];

const PROGRAMAS_CLINICOS = ["Extremidad", "Tórax AP", "Columna AP"];

const SLOTS_IMAGEN = [
  { slot: "montaje_raysafe", label: "Fotografía del montaje con sensor RaySafe" },
  { slot: "montaje_rejilla", label: "Fotografía del montaje con rejilla" },
];

/** CHR mínima según kV (tabla de referencia TECDOC) */
const CHR_MINIMA: Record<number, number> = { 60: 1.8, 70: 2.1, 80: 2.3, 90: 2.5 };

// ─── UI Components ───

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

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
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

function RaysafeUploadCard({
  onImport,
}: {
  onImport: (result: Awaited<ReturnType<typeof parseRaysafeXlsx>> | { tipo: "tsv"; data: RaysafeRow[] }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
        <div>
          <p className="text-xs font-black text-slate-700">Importar datos RaySafe</p>
          <p className="text-[10px] text-slate-400 font-medium">
            Sube la plantilla Excel completa o un archivo TSV del sensor.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {loaded && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {count} filas
          </span>
        )}
        <a
          href="/plantillas/plantilla-raysafe.xlsx"
          download
          className="text-[10px] text-primary/70 underline underline-offset-2 hover:text-primary font-medium"
        >
          Descargar plantilla
        </a>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl font-bold text-xs gap-1.5 h-8"
          onClick={() => ref.current?.click()}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Cargar
        </Button>
        <input
          ref={ref}
          type="file"
          accept=".txt,.tsv,.csv,.xlsx,.xls"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
              const result = await parseRaysafeXlsx(file);
              const total =
                result.tipo === "plantilla"
                  ? result.data.principales.length +
                    result.data.conRejilla.length +
                    result.data.sinRejilla.length +
                    result.data.kerma.length
                  : result.data.length;
              if (total > 0) {
                onImport(result);
                setCount(total);
                setLoaded(true);
              }
            } else {
              const text = await file.text();
              const { parseRaysafeTsv } = await import(
                "@/lib/equipos/convencional/raysafe-parser"
              );
              const rows = parseRaysafeTsv(text);
              if (rows.length > 0) {
                onImport({ tipo: "tsv", data: rows });
                setCount(rows.length);
                setLoaded(true);
              }
            }
            e.target.value = "";
          }}
        />
      </div>
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

export default function GrupoBPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const pruebasGrupoB = getManualGrupo("B");

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [setup, mediciones, evidencias] = await Promise.all([
      db.conv_raysafe_setup.where("visita_id").equals(visitaId).first(),
      db.conv_raysafe_mediciones.where("visita_id").equals(visitaId).sortBy("toma_numero"),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
    ]);

    return { visita, setup, mediciones, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize setup ───
  useEffect(() => {
    if (!data || data.setup) return;
    db.conv_raysafe_setup.add({
      visita_id: visitaId,
      distancia_foco_sensor_cm: 100,
      creado_en: new Date().toISOString(),
    });
  }, [data, visitaId]);

  // ─── Initialize default shots ───
  useEffect(() => {
    if (!data || data.mediciones.length > 0) return;
    const now = new Date().toISOString();
    let toma = 1;
    const rows: Omit<import("@/lib/equipos/convencional/db/types").ConvRaysafeMedicion, "id">[] = [];

    // Grupos principales 1-8
    for (const g of GRUPOS_DISPAROS) {
      for (let r = 0; r < g.repeticiones; r++) {
        rows.push({
          visita_id: visitaId,
          tipo_medicion: "principal",
          grupo_numero: g.grupo,
          toma_numero: toma++,
          kv_nominal: g.kv,
          mas_nominal: g.mas ?? undefined,
          creado_en: now,
        });
      }
    }

    // Con rejilla (3 programas)
    for (const prog of PROGRAMAS_CLINICOS) {
      rows.push({
        visita_id: visitaId,
        tipo_medicion: "con_rejilla",
        toma_numero: toma++,
        programa_clinico: prog,
        creado_en: now,
      });
    }

    // Sin rejilla (3 programas)
    for (const prog of PROGRAMAS_CLINICOS) {
      rows.push({
        visita_id: visitaId,
        tipo_medicion: "sin_rejilla",
        toma_numero: toma++,
        programa_clinico: prog,
        creado_en: now,
      });
    }

    // Kerma en aire (3 mediciones para prueba 2.8)
    for (const prog of PROGRAMAS_CLINICOS) {
      rows.push({
        visita_id: visitaId,
        tipo_medicion: "kerma",
        toma_numero: toma++,
        programa_clinico: prog,
        creado_en: now,
      });
    }

    db.conv_raysafe_mediciones.bulkAdd(rows);
  }, [data, visitaId]);

  // ─── RaySafe import handlers ───
  async function importarRaysafe(
    rows: RaysafeRow[],
    medicionesFiltradas: typeof principales,
  ) {
    for (let i = 0; i < Math.min(rows.length, medicionesFiltradas.length); i++) {
      const m = medicionesFiltradas[i];
      const r = rows[i];
      if (!m.id) continue;
      await db.conv_raysafe_mediciones.update(m.id, {
        kv_medido: r.kv ?? undefined,
        dosis_medida_mgy: r.dosis_mgy ?? undefined,
        tiempo_medido_s: r.tiempo_s ?? undefined,
        chr_medido_mmal: r.chr_mmal ?? undefined,
      });
    }
  }

  async function importarPlantilla(
    result: Awaited<ReturnType<typeof parseRaysafeXlsx>> | { tipo: "tsv"; data: RaysafeRow[] },
  ) {
    if (result.tipo === "plantilla") {
      await Promise.all([
        importarRaysafe(result.data.principales, principales),
        importarRaysafe(result.data.conRejilla, conRejilla),
        importarRaysafe(result.data.sinRejilla, sinRejilla),
        importarRaysafe(result.data.kerma, kerma),
      ]);
    } else {
      await importarRaysafe(result.data, principales);
    }
  }

  // ─── Save helpers ───
  const setupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function updateSetup(fields: Record<string, unknown>) {
    if (!data?.setup?.id) return;
    if (setupTimer.current) clearTimeout(setupTimer.current);
    setupTimer.current = setTimeout(() => {
      db.conv_raysafe_setup.update(data.setup!.id!, fields);
    }, 600);
  }

  async function updateMedicion(id: number, fields: Record<string, unknown>) {
    await db.conv_raysafe_mediciones.update(id, fields);
  }

  async function captureImage(pruebaCodigo: string, slot: string, file: File) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const existing = data?.evidencias?.find(
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot,
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
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot,
    );
    if (existing?.id) await db.conv_evidencias.delete(existing.id);
  }

  function getEvidencia(prueba: string, slot: string) {
    return data?.evidencias?.find((e) => e.prueba_codigo === prueba && e.slot === slot);
  }

  // ─── Derived data ───
  const setup = data?.setup;
  const principales = (data?.mediciones ?? []).filter((m) => m.tipo_medicion === "principal");
  const conRejilla = (data?.mediciones ?? []).filter((m) => m.tipo_medicion === "con_rejilla");
  const sinRejilla = (data?.mediciones ?? []).filter((m) => m.tipo_medicion === "sin_rejilla");
  const kerma = (data?.mediciones ?? []).filter((m) => m.tipo_medicion === "kerma");

  // ─── Loading ───
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
        <Link href="/dashboard/visitas" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
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
            Grupo B — Pruebas 2.4, 2.5, 2.6, 2.7, 2.21, 2.8
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            RaySafe: Tiempo, kVp, CHR, Rendimiento y Dosis
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Verifica que el tubo de rayos X dispara correctamente comparando los valores configurados
            con los medidos por el sensor RaySafe X2.
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

      {/* ═══ CARGA RAYSAFE ═══ */}
      <RaysafeUploadCard onImport={importarPlantilla} />

      {/* ═══ SETUP ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Paso 1" title="Preparación y montaje" icon={Zap}>
            Configura el montaje antes de hacer los disparos.
          </StepHeader>

          <Alert>
            Retire el Flat Panel o cassette del Bucky. Ubique el sensor RaySafe en el centro del
            haz a la distancia indicada.
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Distancia foco-sensor (cm)
              </label>
              <Input
                type="number"
                className="rounded-xl h-9 text-sm font-medium"
                defaultValue={setup?.distancia_foco_sensor_cm ?? 100}
                onBlur={(e) =>
                  updateSetup({
                    distancia_foco_sensor_cm: e.target.value ? parseFloat(e.target.value) : 100,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLOTS_IMAGEN.map((s) => (
              <ImageSlot
                key={s.slot}
                label={s.label}
                evidencia={getEvidencia("2.4", s.slot)}
                onCapture={(file) => captureImage("2.4", s.slot, file)}
                onRemove={() => removeImage("2.4", s.slot)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ DISPAROS PRINCIPALES ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Paso 2" title="Disparos principales (sin rejilla)" icon={Zap}>
            {principales.length} tomas en 8 grupos. Configura los valores nominales e ingresa los
            valores medidos por el sensor.
          </StepHeader>

          <Alert>
            No confundir con los valores de la precarga. Estos son los parámetros que configuras en
            el equipo para cada disparo de prueba.
          </Alert>

          <Tip>
            Los grupos 1–6 tienen 3 repeticiones cada uno para evaluar repetibilidad. Los grupos 7–8
            son disparos únicos de referencia para la dosis al receptor.
          </Tip>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    ["Grp", "w-10"],
                    ["Toma", "w-12"],
                    ["kV nom.", "w-16"],
                    ["mA nom.", "w-16"],
                    ["t nom. (s)", "w-20"],
                    ["mAs nom.", "w-16"],
                    ["kV med.", "w-16"],
                    ["t med. (s)", "w-20"],
                    ["Dosis (mGy)", "w-20"],
                    ["CHR (mmAl)", "w-20"],
                    ["DAP", "w-16"],
                    ["Para pruebas", "min-w-[120px]"],
                  ].map(([label, cls]) => (
                    <th
                      key={label}
                      className={`text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1 ${cls}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {principales.map((m) => {
                  const grupoInfo = GRUPOS_DISPAROS.find((g) => g.grupo === m.grupo_numero);
                  const isFirstInGroup =
                    principales.find((p) => p.grupo_numero === m.grupo_numero)?.id === m.id;

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                        isFirstInGroup ? "border-t-2 border-t-slate-200" : ""
                      }`}
                    >
                      <td className="py-1.5 px-1 font-black text-primary">
                        {isFirstInGroup ? m.grupo_numero : ""}
                      </td>
                      <td className="py-1.5 px-1 text-slate-500 font-mono">{m.toma_numero}</td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                          defaultValue={m.kv_nominal ?? ""}
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              kv_nominal: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                          defaultValue={m.ma_nominal ?? ""}
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              ma_nominal: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-20"
                          defaultValue={m.tiempo_nominal_s ?? ""}
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              tiempo_nominal_s: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                          defaultValue={m.mas_nominal ?? ""}
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              mas_nominal: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                      {/* Valores medidos — se llenan del RaySafe o manualmente */}
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.1"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-16"
                          defaultValue={m.kv_medido ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              kv_medido: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.001"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                          defaultValue={m.tiempo_medido_s ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              tiempo_medido_s: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.001"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                          defaultValue={m.dosis_medida_mgy ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              dosis_medida_mgy: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.1"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                          defaultValue={m.chr_medido_mmal ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              chr_medido_mmal: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-16"
                          defaultValue={m.dap_medido ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              dap_medido: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1 text-[10px] text-slate-400 font-medium">
                        {isFirstInGroup ? grupoInfo?.para : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ MEDICIONES CON REJILLA ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader
            step="Paso 3 — Prueba 2.21"
            title="Mediciones CON rejilla (programas clínicos)"
            icon={Zap}
          >
            Dispara con los programas clínicos reales del equipo, con la rejilla puesta.
          </StepHeader>

          <Alert>
            Retire el filtro de cobre. Ubique el sensor RaySafe debajo de la rejilla y ajuste la
            distancia foco-sensor.
          </Alert>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {["#", "Programa", "kV", "mA", "t (s)", "mAs", "kV med.", "t med.", "Dosis (mGy)"].map(
                    (label) => (
                      <th
                        key={label}
                        className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1.5"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {conRejilla.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-black text-primary">{m.toma_numero}</td>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700">
                      {m.programa_clinico}
                    </td>
                    {(["kv_nominal", "ma_nominal", "tiempo_nominal_s", "mas_nominal"] as const).map(
                      (field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                            defaultValue={m[field] ?? ""}
                            onBlur={(e) =>
                              m.id &&
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </td>
                      ),
                    )}
                    {(["kv_medido", "tiempo_medido_s", "dosis_medida_mgy"] as const).map(
                      (field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.001"
                            className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                            defaultValue={m[field] ?? ""}
                            placeholder="—"
                            onBlur={(e) =>
                              m.id &&
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ MEDICIONES SIN REJILLA ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader
            step="Paso 4 — Prueba 2.21"
            title="Mediciones SIN rejilla (programas clínicos)"
            icon={Zap}
          >
            Mismos programas pero sin rejilla. Necesario para calcular la dosis al receptor.
          </StepHeader>

          <Tip>
            Ubique: Detector Flat DR o CR → Profluoro 150 → Sensor RF RaySafe → Tubo. Registre las
            distancias d1 (foco-sensor) y d2 (foco-detector).
          </Tip>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Distancia foco-sensor d1 (cm)
              </label>
              <Input
                type="number"
                className="rounded-xl h-9 text-sm font-medium"
                defaultValue={setup?.distancia_foco_sensor_d1_cm ?? ""}
                placeholder="100"
                onBlur={(e) =>
                  updateSetup({
                    distancia_foco_sensor_d1_cm: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Distancia foco-detector d2 (cm)
              </label>
              <Input
                type="number"
                className="rounded-xl h-9 text-sm font-medium"
                defaultValue={setup?.distancia_foco_detector_d2_cm ?? ""}
                placeholder="110"
                onBlur={(e) =>
                  updateSetup({
                    distancia_foco_detector_d2_cm: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {["#", "Programa", "kV", "mA", "t (s)", "mAs", "kV med.", "t med.", "Dosis (mGy)"].map(
                    (label) => (
                      <th
                        key={label}
                        className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1.5"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sinRejilla.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-black text-primary">{m.toma_numero}</td>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700">
                      {m.programa_clinico}
                    </td>
                    {(["kv_nominal", "ma_nominal", "tiempo_nominal_s", "mas_nominal"] as const).map(
                      (field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="rounded-lg h-7 text-xs font-medium border-slate-200 w-16"
                            defaultValue={m[field] ?? ""}
                            onBlur={(e) =>
                              m.id &&
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </td>
                      ),
                    )}
                    {(["kv_medido", "tiempo_medido_s", "dosis_medida_mgy"] as const).map(
                      (field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.001"
                            className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                            defaultValue={m[field] ?? ""}
                            placeholder="—"
                            onBlur={(e) =>
                              m.id &&
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ KERMA EN AIRE (Prueba 2.8) ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader
            step="Paso 5 — Prueba 2.8"
            title="Mediciones de Kerma en aire y estimación DAP"
            icon={Zap}
          >
            Mide el Kerma en aire y calcula el factor de corrección del producto dosis-área (PKA).
          </StepHeader>

          <Alert>Retire el filtro de cobre antes de estas mediciones.</Alert>

          <Tip>
            El factor de corrección PKA = DAP estimado / DAP nominal. Permite verificar si el
            medidor de dosis-área del equipo está calibrado correctamente.
          </Tip>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    "#",
                    "Programa",
                    "kV",
                    "mAs",
                    "DAP nom.",
                    "Foco-sensor",
                    "Foco-detector",
                    "Ancho (cm)",
                    "Largo (cm)",
                    "Kerma (mGy)",
                  ].map((label) => (
                    <th
                      key={label}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kerma.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1 font-black text-primary">{m.toma_numero}</td>
                    <td className="py-1.5 px-1 font-medium text-slate-700">
                      {m.programa_clinico}
                    </td>
                    <td className="py-1.5 px-1 text-slate-500 font-mono">
                      {m.kv_nominal ?? "—"}
                    </td>
                    <td className="py-1.5 px-1 text-slate-500 font-mono">
                      {m.mas_nominal ?? "—"}
                    </td>
                    {(
                      [
                        "dap_nominal",
                        "distancia_foco_sensor_cm" as "dap_nominal",
                        "distancia_foco_detector_cm" as "dap_nominal",
                        "ancho_irradiacion_cm",
                        "largo_irradiacion_cm",
                        "dosis_medida_mgy",
                      ] as const
                    ).map((field) => (
                      <td key={field} className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                          defaultValue={(m as unknown as Record<string, unknown>)[field] as string ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            m.id &&
                            updateMedicion(m.id, {
                              [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ TABLAS DE RESULTADOS (auto-calculadas) ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Resultados" title="Tablas de resultados auto-calculadas" icon={Zap}>
            Estos valores se calculan automáticamente a partir de las mediciones anteriores.
          </StepHeader>

          <Tip>
            Las tablas de resultados (Tiempo, kVp, CHR, Rendimiento, Dosis al receptor, Factor PKA)
            se calcularán automáticamente cuando se importen los datos del RaySafe. Los criterios de
            aceptación están definidos en el TECDOC.
          </Tip>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { codigo: "2.4", nombre: "Tiempo de exposición", criterio: "Desviación ≤ 10%, CV ≤ 10%" },
              { codigo: "2.5", nombre: "Tensión (kVp)", criterio: "Desviación ≤ 10%, CV ≤ 5%" },
              { codigo: "2.6", nombre: "CHR", criterio: "≥ mínimo según kV" },
              { codigo: "2.7", nombre: "Rendimiento", criterio: "Linealidad ≤ 10%, CV ≤ 5%" },
              { codigo: "2.21", nombre: "Dosis al receptor", criterio: "Diferencia ≤ 0.01 mGy" },
              { codigo: "2.8", nombre: "Factor PKA", criterio: "Factor de corrección" },
            ].map((prueba) => (
              <div
                key={prueba.codigo}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-primary uppercase">
                    {prueba.codigo}
                  </span>
                  <span className="text-[10px] font-black text-slate-300 bg-slate-100 px-2 py-0.5 rounded-md">
                    Pendiente
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700">{prueba.nombre}</p>
                <p className="text-[10px] text-slate-400">{prueba.criterio}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ManualDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pruebas={pruebasGrupoB}
        pruebaCodigo={manualPrueba}
      />
    </div>
  );
}
