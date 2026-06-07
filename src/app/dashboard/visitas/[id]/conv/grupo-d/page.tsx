"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import {
  ArrowLeft,
  MonitorCheck,
  Loader2,
  AlertCircle,
  Lightbulb,
  Camera,
  Trash2,
  Plus,
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

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

type Concepto = "Conforme" | "No_conforme";

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

function ConceptoSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: "Conforme" | "No_conforme") => void;
}) {
  const color =
    value === "Conforme"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : value === "No_conforme"
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-slate-200 bg-white text-slate-600";
  return (
    <select
      className={`rounded-xl font-bold text-xs h-7 px-2 border ${color} min-w-[100px]`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as "Conforme" | "No_conforme")}
    >
      <option value="">—</option>
      <option value="Conforme">Conforme</option>
      <option value="No_conforme">No conforme</option>
    </select>
  );
}

// ─── Constants ───

const CAMPOS_CASSETTE = [
  { key: "integridad_externa" as const, label: "Integridad externa" },
  { key: "estado_interno" as const, label: "Estado interno pantalla IP" },
  { key: "polvo_suciedad" as const, label: "Polvo / suciedad" },
  { key: "rayones_defectos" as const, label: "Rayones / defectos" },
  { key: "limpieza_realizada" as const, label: "Limpieza realizada" },
];

// ─── Main Page ───

export default function GrupoDPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const pruebasManual = getManualGrupo("D");

  // ─── Live data ───
  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [ddiMediciones, cassettes, uniformidad, evidencias] = await Promise.all([
      db.conv_ddi_mediciones.where("visita_id").equals(visitaId).sortBy("toma_numero"),
      db.conv_cassette_inspeccion.where("visita_id").equals(visitaId).sortBy("item_numero"),
      db.conv_uniformidad_cr.where("visita_id").equals(visitaId).sortBy("item_numero"),
      db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
    ]);

    return { visita, ddiMediciones, cassettes, uniformidad, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize default DDI rows (6 tomas: grupo 1 ×3, grupos 2-4 ×1) ───
  useEffect(() => {
    if (!data || data.ddiMediciones.length > 0) return;
    const now = new Date().toISOString();
    const rows = [
      { grupo: 1, toma_numero: 1 },
      { grupo: 1, toma_numero: 2 },
      { grupo: 1, toma_numero: 3 },
      { grupo: 2, toma_numero: 4 },
      { grupo: 3, toma_numero: 5 },
      { grupo: 4, toma_numero: 6 },
    ].map((r) => ({
      visita_id: visitaId,
      grupo: r.grupo,
      toma_numero: r.toma_numero,
      kv_nominal: 70,
      creado_en: now,
    }));
    db.conv_ddi_mediciones.bulkAdd(rows);
  }, [data, visitaId]);

  // ─── Valores base (precarga) para 2.9 ───
  const [baseEi29, setBaseEi29] = useState("");
  const [baseDi29, setBaseDi29] = useState("");

  // ─── Save helpers ───
  async function updateDdi(id: number, fields: Record<string, unknown>) {
    await db.conv_ddi_mediciones.update(id, fields);
  }

  async function addCassette() {
    const next = (data?.cassettes?.length ?? 0) + 1;
    await db.conv_cassette_inspeccion.add({
      visita_id: visitaId,
      item_numero: next,
      creado_en: new Date().toISOString(),
    });
  }

  async function updateCassette(id: number, fields: Record<string, unknown>) {
    await db.conv_cassette_inspeccion.update(id, fields);
  }

  async function removeCassette(id: number) {
    await db.conv_cassette_inspeccion.delete(id);
  }

  async function addUniformidad() {
    const next = (data?.uniformidad?.length ?? 0) + 1;
    await db.conv_uniformidad_cr.add({
      visita_id: visitaId,
      item_numero: next,
      creado_en: new Date().toISOString(),
    });
  }

  async function updateUniformidad(id: number, fields: Record<string, unknown>) {
    await db.conv_uniformidad_cr.update(id, fields);
  }

  async function removeUniformidad(id: number) {
    await db.conv_uniformidad_cr.delete(id);
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

  // ─── Cálculos auto ───
  const ddiMediciones = useMemo(() => data?.ddiMediciones ?? [], [data?.ddiMediciones]);

  const resultados = useMemo(() => {
    // 2.9: primer disparo del grupo 1 (toma 1) vs base
    const t1 = ddiMediciones.find((m) => m.toma_numero === 1);
    const eiMedido = num(t1?.ei);
    const diMedido = num(t1?.di);
    const eiBase = num(baseEi29);
    const diBase = num(baseDi29);
    const varEi29 = eiBase > 0 ? Math.abs(eiMedido - eiBase) / eiBase : null;
    const varDi29 = diBase !== 0 ? Math.abs(diMedido - diBase) / Math.abs(diBase) : null;

    // 2.10: CV de las 3 repeticiones del grupo 1 (tomas 1-3)
    const grupo1 = ddiMediciones.filter((m) => m.grupo === 1);
    const eiArr = grupo1.map((m) => num(m.ei)).filter((v) => v > 0);
    const diArr = grupo1.map((m) => num(m.di)).filter((v) => v !== 0);
    const cvEi = eiArr.length >= 2 ? stdev(eiArr) / avg(eiArr) : null;
    const cvDi = diArr.length >= 2 ? stdev(diArr) / avg(diArr) : null;

    // 2.15: promedio y desviación del EI por cassette
    const unifRows = data?.uniformidad ?? [];
    const eiUnif = unifRows.map((r) => num(r.ei)).filter((v) => v > 0);
    const promedioEi = eiUnif.length > 0 ? avg(eiUnif) : null;
    const desvEi = eiUnif.length >= 2 ? stdev(eiUnif) : null;

    return {
      prueba29: { varEi: varEi29, varDi: varDi29 },
      prueba210: { cvEi, cvDi },
      prueba215: { promedioEi, desvEi },
    };
  }, [ddiMediciones, baseEi29, baseDi29, data?.uniformidad]);

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
            Grupo D — Pruebas 2.9, 2.10, 2.14, 2.15
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            DDI/EI, Integridad y Uniformidad CR
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Control de calidad del indicador de dosis digital, repetibilidad, inspeccion de cassettes
            y uniformidad de pantallas IP.
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

      {/* ═══════════════════════════════════════════
          PRUEBAS 2.9 y 2.10 — DDI/EI
          ═══════════════════════════════════════════ */}

      {/* Setup */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Pruebas 2.9 / 2.10 — Setup" title="Preparacion DDI/EI" icon={MonitorCheck}>
            Configura el montaje para la medicion del indicador de dosis digital.
          </StepHeader>

          <Alert>Poner filtro de cobre 1 mm a la salida del tubo.</Alert>
          <Alert>Dejar colimadores totalmente abiertos.</Alert>

          <Tip>
            Tecnica: 70 kVp, distancia foco-detector 100 cm. Registra marca, modelo y serie del
            detector CR o DR.
          </Tip>

          <ImageSlot
            label="Montaje experimental DDI/EI"
            evidencia={getEvidencia("2.9", "montaje_ddi")}
            onCapture={(file) => captureImage("2.9", "montaje_ddi", file)}
            onRemove={() => removeImage("2.9", "montaje_ddi")}
          />
        </CardContent>
      </Card>

      {/* Tabla de mediciones DDI */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Registro de mediciones" title="Disparos DDI/EI" icon={MonitorCheck}>
            Grupo 1 (3 repeticiones) para prueba 2.9 y repetibilidad 2.10. Grupos 2-4 para
            cassettes adicionales.
          </StepHeader>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Grp", "#", "Serie CR/DR", "kVp", "mAs", "EI", "D.I.", "TEI"].map((label) => (
                    <th
                      key={label}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1.5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ddiMediciones.map((m) => {
                  const isFirstInGroup =
                    ddiMediciones.find((p) => p.grupo === m.grupo)?.id === m.id;

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                        isFirstInGroup ? "border-t-2 border-t-slate-200" : ""
                      }`}
                    >
                      <td className="py-1.5 px-1.5 font-black text-primary">
                        {isFirstInGroup ? m.grupo : ""}
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-500 font-mono">{m.toma_numero}</td>
                      <td className="py-1.5 px-1.5">
                        <Input
                          className="rounded-lg h-7 text-xs font-medium border-slate-200 w-28"
                          defaultValue={m.serie_detector ?? ""}
                          placeholder="Serie"
                          onBlur={(e) =>
                            m.id && updateDdi(m.id, { serie_detector: e.target.value || undefined })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-1.5 text-slate-600 font-mono">{m.kv_nominal}</td>
                      {(["carga_mas", "ei", "di", "tei"] as const).map((field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                            defaultValue={m[field] ?? ""}
                            placeholder="—"
                            onBlur={(e) =>
                              m.id &&
                              updateDdi(m.id, {
                                [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Valores base para 2.9 */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Valores base" title="Referencia visita anterior (2.9)" icon={MonitorCheck}>
            Si es primera visita, estos campos quedan vacios y se establece la referencia.
          </StepHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                EI base
              </label>
              <Input
                type="number"
                step="0.01"
                className="rounded-xl h-9 text-sm font-medium"
                value={baseEi29}
                onChange={(e) => setBaseEi29(e.target.value)}
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
                value={baseDi29}
                onChange={(e) => setBaseDi29(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado 2.9 */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.9" title="Control de calidad DDI/EI" icon={MonitorCheck}>
            Desviacion del EI y D.I. medidos vs base. Limite: &le; 20%.
          </StepHeader>
          <ResultRow
            label="EI"
            valor={fmtPct(resultados.prueba29.varEi)}
            limite="≤ 20%"
            concepto={
              resultados.prueba29.varEi !== null
                ? resultados.prueba29.varEi <= 0.2
                  ? "Conforme"
                  : "No_conforme"
                : null
            }
          />
          <ResultRow
            label="D.I."
            valor={fmtPct(resultados.prueba29.varDi)}
            limite="≤ 20%"
            concepto={
              resultados.prueba29.varDi !== null
                ? resultados.prueba29.varDi <= 0.2
                  ? "Conforme"
                  : "No_conforme"
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Resultado 2.10 */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <StepHeader step="Prueba 2.10" title="Repetibilidad DDI/EI" icon={MonitorCheck}>
            CV de las 3 repeticiones del grupo 1. Limite: CV &le; 20%.
          </StepHeader>
          <ResultRow
            label="EI"
            valor={fmtPct(resultados.prueba210.cvEi)}
            limite="CV ≤ 20%"
            concepto={
              resultados.prueba210.cvEi !== null
                ? resultados.prueba210.cvEi <= 0.2
                  ? "Conforme"
                  : "No_conforme"
                : null
            }
          />
          <ResultRow
            label="D.I."
            valor={fmtPct(resultados.prueba210.cvDi)}
            limite="CV ≤ 20%"
            concepto={
              resultados.prueba210.cvDi !== null
                ? resultados.prueba210.cvDi <= 0.2
                  ? "Conforme"
                  : "No_conforme"
                : null
            }
          />
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.14 — INTEGRIDAD CASSETTES
          ═══════════════════════════════════════════ */}

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.14" title="Integridad y limpieza de cassettes / pantallas IP" icon={MonitorCheck}>
            Inspecciona cada cassette o detector CR disponible.
          </StepHeader>

          <Alert>Solicitar al cliente que realice limpieza antes de la inspeccion.</Alert>

          {(data.cassettes ?? []).map((c, idx) => (
            <CollapsibleSection key={c.id} title={`Cassette ${idx + 1}${c.serie_detector ? ` — ${c.serie_detector}` : ""}`}>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Serie del detector
                  </label>
                  <Input
                    className="rounded-xl h-8 text-xs font-medium"
                    defaultValue={c.serie_detector ?? ""}
                    placeholder="Ej: SN-12345"
                    onBlur={(e) =>
                      c.id && updateCassette(c.id, { serie_detector: e.target.value || undefined })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CAMPOS_CASSETTE.map((campo) => (
                    <div key={campo.key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <span className="text-[11px] font-medium text-slate-600">{campo.label}</span>
                      <ConceptoSelect
                        value={c[campo.key]}
                        onChange={(v) => c.id && updateCassette(c.id, { [campo.key]: v })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-700">Concepto global</span>
                  <ConceptoSelect
                    value={c.concepto}
                    onChange={(v) => c.id && updateCassette(c.id, { concepto: v })}
                  />
                </div>
                <Input
                  className="rounded-xl h-8 text-xs font-medium"
                  placeholder="Observaciones"
                  defaultValue={c.observacion ?? ""}
                  onBlur={(e) =>
                    c.id && updateCassette(c.id, { observacion: e.target.value || undefined })
                  }
                />
                <button
                  type="button"
                  onClick={() => c.id && removeCassette(c.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-bold"
                >
                  Eliminar cassette
                </button>
              </div>
            </CollapsibleSection>
          ))}

          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed border-2 h-10 font-bold text-sm"
            onClick={addCassette}
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar cassette / detector
          </Button>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.15 — UNIFORMIDAD CR
          ═══════════════════════════════════════════ */}

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.15" title="Uniformidad de sensibilidad de pantallas IP CR" icon={MonitorCheck}>
            Mide la uniformidad del EI entre cassettes. Tecnica: 70 kVp, Cu 1mm, distancia 100 cm.
          </StepHeader>

          <Tip>
            Solo aplica a sistemas CR (con cassettes). No aplica a detectores DR fijos.
          </Tip>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[500px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {["#", "Serie cassette", "mAs", "EI", "D.I.", "TEI", ""].map((label) => (
                    <th
                      key={label}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left py-2 px-1.5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.uniformidad ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-black text-primary">{u.item_numero}</td>
                    <td className="py-1.5 px-1.5">
                      <Input
                        className="rounded-lg h-7 text-xs font-medium border-slate-200 w-28"
                        defaultValue={u.serie_cassette ?? ""}
                        placeholder="Serie"
                        onBlur={(e) =>
                          u.id &&
                          updateUniformidad(u.id, { serie_cassette: e.target.value || undefined })
                        }
                      />
                    </td>
                    {(["carga_mas", "ei", "di", "tei"] as const).map((field) => (
                      <td key={field} className="py-1.5 px-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                          defaultValue={u[field] ?? ""}
                          placeholder="—"
                          onBlur={(e) =>
                            u.id &&
                            updateUniformidad(u.id, {
                              [field]: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="py-1.5 px-1.5">
                      <button
                        type="button"
                        onClick={() => u.id && removeUniformidad(u.id)}
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
            onClick={addUniformidad}
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar cassette
          </Button>

          {/* Resultado 2.15 */}
          {resultados.prueba215.promedioEi !== null && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                Resultado uniformidad
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">Promedio EI</p>
                  <p className="text-sm font-black text-slate-800">
                    {resultados.prueba215.promedioEi?.toFixed(2) ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">Desviacion estandar EI</p>
                  <p className="text-sm font-black text-slate-800">
                    {resultados.prueba215.desvEi?.toFixed(2) ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
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
