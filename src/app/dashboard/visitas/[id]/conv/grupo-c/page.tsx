"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import {
  ArrowLeft,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Lightbulb,
  Camera,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ManualDrawer } from "@/components/manual-drawer";
import { getManualGrupo } from "@/lib/equipos/convencional/manual";

// ─── Constants ───

/**
 * 15 disparos predefinidos según la plantilla TECDOC.
 * Cada disparo alimenta una o más pruebas (2.17–2.20).
 */
const DISPAROS_CAE: {
  toma: number;
  kv: number;
  cu: number;
  sensor: string;
  para: string;
}[] = [
  { toma: 1, kv: 60, cu: 1, sensor: "Centro", para: "2.17, 2.20 kVp" },
  { toma: 2, kv: 70, cu: 1, sensor: "Izquierda", para: "2.18" },
  { toma: 3, kv: 70, cu: 1, sensor: "Centro", para: "2.17, 2.18" },
  { toma: 4, kv: 70, cu: 1, sensor: "Derecha", para: "2.18" },
  { toma: 5, kv: 70, cu: 1, sensor: "Izq + Der", para: "2.18" },
  { toma: 6, kv: 70, cu: 1, sensor: "Izq + Centro", para: "2.18" },
  { toma: 7, kv: 70, cu: 1, sensor: "Centro + Der", para: "2.18" },
  { toma: 8, kv: 70, cu: 1, sensor: "Izq + Centro + Der", para: "2.18" },
  { toma: 9, kv: 70, cu: 1, sensor: "Centro", para: "2.19 rep" },
  { toma: 10, kv: 70, cu: 1, sensor: "Centro", para: "2.19 rep" },
  { toma: 11, kv: 70, cu: 1, sensor: "Centro", para: "2.19 rep" },
  { toma: 12, kv: 70, cu: 1, sensor: "Centro", para: "2.19 rep, 2.20 kVp" },
  { toma: 13, kv: 81, cu: 1, sensor: "Centro", para: "2.20 kVp, 2.20 esp" },
  { toma: 14, kv: 81, cu: 2, sensor: "Centro", para: "2.20 esp" },
  { toma: 15, kv: 81, cu: 3, sensor: "Centro", para: "2.20 esp" },
];

const SLOTS_IMAGEN = [
  { slot: "montaje_cae", label: "Montaje experimental CAE" },
];

// ─── Helpers ───

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1));
}

function pctVar(medido: number, base: number): number | null {
  if (!base) return null;
  return Math.abs(medido - base) / Math.abs(base);
}

function rangeVar(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const mean = avg(arr);
  if (!mean) return null;
  return (Math.max(...arr) - Math.min(...arr)) / mean;
}

type Concepto = "Conforme" | "No_conforme";

function conceptoLimite(valor: number | null, limite: number): Concepto | null {
  if (valor === null) return null;
  return valor <= limite ? "Conforme" : "No_conforme";
}

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

function ConceptoBadge({ concepto }: { concepto: Concepto | null }) {
  if (!concepto) return <span className="text-[10px] text-slate-300 font-bold">—</span>;
  return concepto === "Conforme" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
      <CheckCircle2 className="w-3 h-3" /> OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
      <XCircle className="w-3 h-3" /> NC
    </span>
  );
}

function ResultRow({
  label,
  valor,
  limite,
  concepto,
}: {
  label: string;
  valor: string;
  limite: string;
  concepto: Concepto | null;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-none">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono font-bold text-slate-800">{valor}</span>
        <span className="text-[10px] text-slate-400">{limite}</span>
        <ConceptoBadge concepto={concepto} />
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function GrupoCaePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const pruebasManual = getManualGrupo("C");

  // ─── Live data ───
  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [mediciones, evidencias] = await Promise.all([
      db.conv_cae_mediciones.where("visita_id").equals(visitaId).sortBy("toma_numero"),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
    ]);

    return { visita, mediciones, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize default rows ───
  useEffect(() => {
    if (!data || data.mediciones.length > 0) return;
    const now = new Date().toISOString();
    const rows = DISPAROS_CAE.map((d) => ({
      visita_id: visitaId,
      toma_numero: d.toma,
      kv_nominal: d.kv,
      espesor_cu_mm: d.cu,
      posicion_sensor: d.sensor,
      creado_en: now,
    }));
    db.conv_cae_mediciones.bulkAdd(rows);
  }, [data, visitaId]);

  // ─── Save helpers ───
  async function updateMedicion(id: number, fields: Record<string, unknown>) {
    await db.conv_cae_mediciones.update(id, fields);
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

  // ─── Derived: mediciones por toma ───
  const mediciones = useMemo(() => data?.mediciones ?? [], [data?.mediciones]);
  const byToma = useMemo(() => {
    const map = new Map<number, (typeof mediciones)[0]>();
    for (const m of mediciones) map.set(m.toma_numero, m);
    return map;
  }, [mediciones]);

  // ─── Valores base (precarga) ───
  // Para 2.17: fila 9 (70kV, Centro) vs base
  // Se almacenan en la propia visita o se pueden editar inline
  const [baseMas, setBaseMas] = useState<string>("");
  const [baseEi, setBaseEi] = useState<string>("");
  const [baseDi, setBaseDi] = useState<string>("");

  // Para 2.20 kVp: bases por kVp (60, 70, 81)
  const [baseKvp, setBaseKvp] = useState<Record<string, { mas: string; ei: string; di: string }>>({
    "60": { mas: "", ei: "", di: "" },
    "70": { mas: "", ei: "", di: "" },
    "81": { mas: "", ei: "", di: "" },
  });

  // Para 2.20 espesores: bases por Cu (1, 2, 3)
  const [baseEsp, setBaseEsp] = useState<Record<string, { mas: string; ei: string; di: string }>>({
    "1": { mas: "", ei: "", di: "" },
    "2": { mas: "", ei: "", di: "" },
    "3": { mas: "", ei: "", di: "" },
  });

  // ─── Cálculos auto ───
  const resultados = useMemo(() => {
    // --- 2.17 Sensibilidad: fila 9 (toma 9 = 70kV, Centro) vs base ---
    const t9 = byToma.get(9);
    const sensibilidad = {
      varMas: pctVar(num(t9?.carga_mas), num(baseMas)),
      varEi: pctVar(num(t9?.ei), num(baseEi)),
      varDi: pctVar(num(t9?.di), num(baseDi)),
    };

    // --- 2.18 Consistencia: tomas 2-8 (7 combinaciones de sensor) ---
    const tomas2a8 = [2, 3, 4, 5, 6, 7, 8].map((t) => byToma.get(t)).filter(Boolean);
    const masList = tomas2a8.map((t) => num(t?.carga_mas)).filter((v) => v > 0);
    const eiList = tomas2a8.map((t) => num(t?.ei)).filter((v) => v > 0);
    const diList = tomas2a8.map((t) => num(t?.di)).filter((v) => v !== 0);
    const consistencia = {
      varMas: rangeVar(masList),
      varEi: rangeVar(eiList),
      varDi: rangeVar(diList),
    };

    // --- 2.19 Repetibilidad: tomas 9-12 (Centro ×4) ---
    const tomas9a12 = [9, 10, 11, 12].map((t) => byToma.get(t)).filter(Boolean);
    const repMas = tomas9a12.map((t) => num(t?.carga_mas)).filter((v) => v > 0);
    const repEi = tomas9a12.map((t) => num(t?.ei)).filter((v) => v > 0);
    const repDi = tomas9a12.map((t) => num(t?.di)).filter((v) => v !== 0);
    const repetibilidad = {
      cvMas: repMas.length >= 2 ? stdev(repMas) / avg(repMas) : null,
      cvEi: repEi.length >= 2 ? stdev(repEi) / avg(repEi) : null,
      cvDi: repDi.length >= 2 ? stdev(repDi) / avg(repDi) : null,
    };

    // --- 2.20 Compensación kVp: tomas 1 (60kV), 12 (70kV), 13 (81kV) ---
    const kvpTomas: Record<string, number> = { "60": 1, "70": 12, "81": 13 };
    const compKvp: Record<string, { varMas: number | null; varEi: number | null; varDi: number | null }> = {};
    for (const [kv, tomaNum] of Object.entries(kvpTomas)) {
      const t = byToma.get(tomaNum);
      const b = baseKvp[kv];
      compKvp[kv] = {
        varMas: pctVar(num(t?.carga_mas), num(b?.mas)),
        varEi: pctVar(num(t?.ei), num(b?.ei)),
        varDi: pctVar(num(t?.di), num(b?.di)),
      };
    }

    // --- 2.20 Compensación espesores: tomas 13 (Cu1), 14 (Cu2), 15 (Cu3) ---
    const espTomas: Record<string, number> = { "1": 13, "2": 14, "3": 15 };
    const compEsp: Record<string, { varMas: number | null; varEi: number | null; varDi: number | null }> = {};
    for (const [cu, tomaNum] of Object.entries(espTomas)) {
      const t = byToma.get(tomaNum);
      const b = baseEsp[cu];
      compEsp[cu] = {
        varMas: pctVar(num(t?.carga_mas), num(b?.mas)),
        varEi: pctVar(num(t?.ei), num(b?.ei)),
        varDi: pctVar(num(t?.di), num(b?.di)),
      };
    }

    return { sensibilidad, consistencia, repetibilidad, compKvp, compEsp };
  }, [byToma, baseMas, baseEi, baseDi, baseKvp, baseEsp]);

  // ─── Format helpers ───
  function fmtPct(v: number | null): string {
    if (v === null) return "—";
    return `${(v * 100).toFixed(1)}%`;
  }

  // ─── Loading / Error ───
  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando modulo...</p>
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
            Grupo C — Pruebas 2.17, 2.18, 2.19, 2.20
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            Control Automatico de Exposicion (CAE)
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Verifica sensibilidad, consistencia entre sensores, repetibilidad y compensacion del CAE.
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

      {/* ═══ SETUP ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Paso 1" title="Preparacion y montaje" icon={SlidersHorizontal}>
            Configura el CAE y coloca el atenuador de cobre.
          </StepHeader>

          <Alert>
            Revisar la configuracion del colimador — debe estar en modo MANUAL.
          </Alert>
          <Alert>
            Si se mueve la placa de cobre, se debe repetir toda la ronda de disparos.
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLOTS_IMAGEN.map((s) => (
              <ImageSlot
                key={s.slot}
                label={s.label}
                evidencia={getEvidencia("2.17", s.slot)}
                onCapture={(file) => captureImage("2.17", s.slot, file)}
                onRemove={() => removeImage("2.17", s.slot)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ TABLA DE MEDICIONES (15 disparos) ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Paso 2" title="Registro de mediciones" icon={SlidersHorizontal}>
            15 disparos con diferentes kVp, espesores de Cu y posiciones de sensor.
          </StepHeader>

          <Tip>
            Activa el CAE en modo automatico. Los valores de kVp, espesor y sensor ya estan
            precargados segun la plantilla TECDOC.
          </Tip>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[800px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {["#", "kVp", "Cu (mm)", "Sensor CAE", "mAs", "EI", "D.I.", "TEI", "DAP", "Para"].map(
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
                {mediciones.map((m) => {
                  const disp = DISPAROS_CAE.find((d) => d.toma === m.toma_numero);
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 font-black text-primary">{m.toma_numero}</td>
                      <td className="py-1.5 px-1.5 text-slate-600 font-mono">
                        {m.kv_nominal}
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-600 font-mono">
                        {m.espesor_cu_mm}
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-600 font-medium text-[11px]">
                        {m.posicion_sensor}
                      </td>
                      {/* Campos editables: mAs, EI, DI, TEI, DAP */}
                      {(["carga_mas", "ei", "di", "tei", "dap"] as const).map((field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.01"
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
                      ))}
                      <td className="py-1.5 px-1.5 text-[10px] text-slate-400 font-medium">
                        {disp?.para ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ VALORES BASE (Precarga) ═══ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Valores base" title="Valores de referencia (visita anterior)" icon={SlidersHorizontal}>
            Si es la primera visita, estos campos quedan vacios y se establece la referencia.
          </StepHeader>

          {/* Base para 2.17 Sensibilidad */}
          <CollapsibleSection title="Base para sensibilidad (2.17) — 70 kVp, Cu 1mm, Centro">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  mAs base
                </label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl h-9 text-sm font-medium"
                  value={baseMas}
                  onChange={(e) => setBaseMas(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  EI base
                </label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl h-9 text-sm font-medium"
                  value={baseEi}
                  onChange={(e) => setBaseEi(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  D.I. base
                </label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl h-9 text-sm font-medium"
                  value={baseDi}
                  onChange={(e) => setBaseDi(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Base para 2.20 Compensación kVp */}
          <CollapsibleSection title="Base para compensacion kVp (2.20)" defaultOpen={false}>
            <Tip>Valores base por cada kVp de la visita anterior.</Tip>
            <div className="space-y-3">
              {["60", "70", "81"].map((kv) => (
                <div key={kv} className="grid grid-cols-4 gap-2 items-end">
                  <div className="text-xs font-black text-primary">{kv} kVp</div>
                  {(["mas", "ei", "di"] as const).map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">
                        {field === "mas" ? "mAs" : field === "ei" ? "EI" : "D.I."}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        className="rounded-lg h-8 text-xs font-medium"
                        value={baseKvp[kv]?.[field] ?? ""}
                        onChange={(e) =>
                          setBaseKvp((prev) => ({
                            ...prev,
                            [kv]: { ...prev[kv], [field]: e.target.value },
                          }))
                        }
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Base para 2.20 Compensación espesores */}
          <CollapsibleSection title="Base para compensacion espesores (2.20)" defaultOpen={false}>
            <Tip>Valores base por cada espesor de Cu de la visita anterior.</Tip>
            <div className="space-y-3">
              {["1", "2", "3"].map((cu) => (
                <div key={cu} className="grid grid-cols-4 gap-2 items-end">
                  <div className="text-xs font-black text-primary">Cu {cu} mm</div>
                  {(["mas", "ei", "di"] as const).map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">
                        {field === "mas" ? "mAs" : field === "ei" ? "EI" : "D.I."}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        className="rounded-lg h-8 text-xs font-medium"
                        value={baseEsp[cu]?.[field] ?? ""}
                        onChange={(e) =>
                          setBaseEsp((prev) => ({
                            ...prev,
                            [cu]: { ...prev[cu], [field]: e.target.value },
                          }))
                        }
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* ═══ RESULTADOS AUTO-CALCULADOS ═══ */}

      {/* 2.17 Sensibilidad */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.17" title="Sensibilidad del CAE" icon={SlidersHorizontal}>
            Compara la medicion actual (toma 9) con los valores base. Limite: variacion &le; 50%.
          </StepHeader>
          <ResultRow
            label="Carga (mAs)"
            valor={fmtPct(resultados.sensibilidad.varMas)}
            limite="≤ 50%"
            concepto={conceptoLimite(resultados.sensibilidad.varMas, 0.5)}
          />
          <ResultRow
            label="EI"
            valor={fmtPct(resultados.sensibilidad.varEi)}
            limite="≤ 50%"
            concepto={conceptoLimite(resultados.sensibilidad.varEi, 0.5)}
          />
          <ResultRow
            label="D.I."
            valor={fmtPct(resultados.sensibilidad.varDi)}
            limite="≤ 50%"
            concepto={conceptoLimite(resultados.sensibilidad.varDi, 0.5)}
          />
        </CardContent>
      </Card>

      {/* 2.18 Consistencia */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.18" title="Consistencia entre sensores del CAE" icon={SlidersHorizontal}>
            Variacion (MAX-MIN)/promedio entre las 7 combinaciones de sensor. Limite: &le; 30%.
          </StepHeader>
          <ResultRow
            label="Carga (mAs)"
            valor={fmtPct(resultados.consistencia.varMas)}
            limite="≤ 30%"
            concepto={conceptoLimite(resultados.consistencia.varMas, 0.3)}
          />
          <ResultRow
            label="EI"
            valor={fmtPct(resultados.consistencia.varEi)}
            limite="≤ 30%"
            concepto={conceptoLimite(resultados.consistencia.varEi, 0.3)}
          />
          <ResultRow
            label="D.I."
            valor={fmtPct(resultados.consistencia.varDi)}
            limite="≤ 30%"
            concepto={conceptoLimite(resultados.consistencia.varDi, 0.3)}
          />
        </CardContent>
      </Card>

      {/* 2.19 Repetibilidad */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.19" title="Repetibilidad del CAE" icon={SlidersHorizontal}>
            CV (desviacion estandar / promedio) de las 4 repeticiones (tomas 9-12). Limite: CV &le; 10%.
          </StepHeader>
          <ResultRow
            label="Carga (mAs)"
            valor={fmtPct(resultados.repetibilidad.cvMas)}
            limite="CV ≤ 10%"
            concepto={conceptoLimite(resultados.repetibilidad.cvMas, 0.1)}
          />
          <ResultRow
            label="EI"
            valor={fmtPct(resultados.repetibilidad.cvEi)}
            limite="CV ≤ 10%"
            concepto={conceptoLimite(resultados.repetibilidad.cvEi, 0.1)}
          />
          <ResultRow
            label="D.I."
            valor={fmtPct(resultados.repetibilidad.cvDi)}
            limite="CV ≤ 10%"
            concepto={conceptoLimite(resultados.repetibilidad.cvDi, 0.1)}
          />
        </CardContent>
      </Card>

      {/* 2.20 Compensación kVp */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.20a" title="Compensacion por kVp" icon={SlidersHorizontal}>
            Variacion de cada parametro respecto a base por kVp. Limite: &le; 30%.
          </StepHeader>
          {["60", "70", "81"].map((kv) => {
            const r = resultados.compKvp[kv];
            if (!r) return null;
            return (
              <CollapsibleSection key={kv} title={`${kv} kVp`} defaultOpen>
                <ResultRow
                  label="mAs"
                  valor={fmtPct(r.varMas)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varMas, 0.3)}
                />
                <ResultRow
                  label="EI"
                  valor={fmtPct(r.varEi)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varEi, 0.3)}
                />
                <ResultRow
                  label="D.I."
                  valor={fmtPct(r.varDi)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varDi, 0.3)}
                />
              </CollapsibleSection>
            );
          })}
        </CardContent>
      </Card>

      {/* 2.20 Compensación espesores */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.20b" title="Compensacion por espesores" icon={SlidersHorizontal}>
            Variacion de cada parametro respecto a base por espesor de Cu. Limite: &le; 30%.
          </StepHeader>
          {["1", "2", "3"].map((cu) => {
            const r = resultados.compEsp[cu];
            if (!r) return null;
            return (
              <CollapsibleSection key={cu} title={`Cu ${cu} mm`} defaultOpen>
                <ResultRow
                  label="mAs"
                  valor={fmtPct(r.varMas)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varMas, 0.3)}
                />
                <ResultRow
                  label="EI"
                  valor={fmtPct(r.varEi)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varEi, 0.3)}
                />
                <ResultRow
                  label="D.I."
                  valor={fmtPct(r.varDi)}
                  limite="≤ 30%"
                  concepto={conceptoLimite(r.varDi, 0.3)}
                />
              </CollapsibleSection>
            );
          })}
        </CardContent>
      </Card>

      <ManualDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pruebas={pruebasManual}
        pruebaCodigo={manualPrueba}
      />
    </div>
  );
}
