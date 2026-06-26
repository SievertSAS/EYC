"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import {
  ArrowLeft,
  Target,
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

function ConceptoBadge({ concepto }: { concepto: "Conforme" | "No_conforme" | null | undefined }) {
  if (!concepto) return <span className="text-[10px] text-slate-300 font-bold">—</span>;
  return concepto === "Conforme" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
      <CheckCircle2 className="w-3 h-3" /> Conforme
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
      <XCircle className="w-3 h-3" /> No conforme
    </span>
  );
}

// ─── Constants ───

const DIRECCIONES = [
  { key: "anodo", label: "Anodo (cabeza)" },
  { key: "catodo", label: "Catodo (pies)" },
  { key: "izquierda", label: "Izquierda" },
  { key: "derecha", label: "Derecha" },
] as const;

const NIVELES_CONTRASTE = [
  { key: "contraste_9_4" as const, label: "9.4%" },
  { key: "contraste_8_0" as const, label: "8.0%" },
  { key: "contraste_5_6" as const, label: "5.6%" },
  { key: "contraste_4_0" as const, label: "4.0%" },
  { key: "contraste_2_8" as const, label: "2.8%" },
  { key: "contraste_1_8" as const, label: "1.8%" },
  { key: "contraste_1_3" as const, label: "1.3%" },
  { key: "contraste_0_9" as const, label: "0.9%" },
];

const POSICIONES_ESFERA = [
  { value: "Centro", label: "Centro — < 1.5°" },
  { value: "Primer circulo", label: "Primer circulo — < 3°" },
  { value: "Segundo circulo", label: "Segundo circulo — < 3°" },
  { value: "Fuera del circulo externo", label: "Fuera del circulo externo — > 3°" },
] as const;

// ─── Main Page ───

export default function GrupoEPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const pruebasManual = getManualGrupo("E");

  // ─── Live data ───
  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [colimacion, uniformidadDet, resolucion, bajoContraste, mtf, evidencias] =
      await Promise.all([
        db.conv_colimacion.where("visita_id").equals(visitaId).first(),
        db.conv_uniformidad_detector.where("visita_id").equals(visitaId).sortBy("item_numero"),
        db.conv_resolucion.where("visita_id").equals(visitaId).first(),
        db.conv_bajo_contraste.where("visita_id").equals(visitaId).first(),
        db.conv_mtf.where("visita_id").equals(visitaId).first(),
        db.conv_evidencias.where("visita_id").equals(visitaId).toArray(),
      ]);

    return { visita, colimacion, uniformidadDet, resolucion, bajoContraste, mtf, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize singletons ───
  useEffect(() => {
    if (!data) return;
    const now = new Date().toISOString();
    if (!data.colimacion) {
      db.conv_colimacion.add({ visita_id: visitaId, sid_cm: 100, tecnica_kv: 75, creado_en: now });
    }
    if (!data.resolucion) {
      db.conv_resolucion.add({ visita_id: visitaId, sid_cm: 100, tecnica_kv: 75, creado_en: now });
    }
    if (!data.bajoContraste) {
      db.conv_bajo_contraste.add({
        visita_id: visitaId,
        sid_cm: 100,
        tecnica_kv: 75,
        creado_en: now,
      });
    }
    if (!data.mtf) {
      db.conv_mtf.add({
        visita_id: visitaId,
        distancia_foco_sensor_cm: 150,
        tecnica_kv: 70,
        creado_en: now,
      });
    }
  }, [data, visitaId]);

  // ─── Save helpers ───
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function updateColimacion(fields: Record<string, unknown>) {
    if (!data?.colimacion?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.conv_colimacion.update(data.colimacion!.id!, fields);
    }, 600);
  }

  function updateResolucion(fields: Record<string, unknown>) {
    if (!data?.resolucion?.id) return;
    db.conv_resolucion.update(data.resolucion.id, fields);
  }

  function updateBajoContraste(fields: Record<string, unknown>) {
    if (!data?.bajoContraste?.id) return;
    db.conv_bajo_contraste.update(data.bajoContraste.id, fields);
  }

  function updateMtf(fields: Record<string, unknown>) {
    if (!data?.mtf?.id) return;
    db.conv_mtf.update(data.mtf.id, fields);
  }

  async function addUniformidadDet() {
    const next = (data?.uniformidadDet?.length ?? 0) + 1;
    await db.conv_uniformidad_detector.add({
      visita_id: visitaId,
      item_numero: next,
      creado_en: new Date().toISOString(),
    });
  }

  async function updateUniformidadDet(id: number, fields: Record<string, unknown>) {
    await db.conv_uniformidad_detector.update(id, fields);
  }

  async function removeUniformidadDet(id: number) {
    await db.conv_uniformidad_detector.delete(id);
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

  // ─── Cálculos colimación ───
  const colimacionResults = useMemo(() => {
    const c = data?.colimacion;
    if (!c) return null;
    const sid = num(c.sid_cm) || 100;
    const dirs = DIRECCIONES.map((d) => {
      const nominal = num(c[`${d.key}_nominal` as keyof typeof c]);
      const medido = num(c[`${d.key}_medido` as keyof typeof c]);
      const diff = Math.abs(medido - nominal);
      const varPct = (diff * 100) / sid;
      const concepto: "Conforme" | "No_conforme" = varPct < 2 ? "Conforme" : "No_conforme";
      return { ...d, nominal, medido, diff, varPct, concepto };
    });
    const totalVar = dirs.reduce((s, d) => s + d.varPct, 0);
    const conceptoTotal: "Conforme" | "No_conforme" =
      dirs.every((d) => d.varPct < 2) && totalVar < 4 ? "Conforme" : "No_conforme";

    const esfera = c.posicion_esfera;
    const perpConcepto: "Conforme" | "No_conforme" | null =
      esfera === "Centro" || esfera === "Primer circulo" || esfera === "Segundo circulo"
        ? "Conforme"
        : esfera === "Fuera del circulo externo"
          ? "No_conforme"
          : null;

    return { dirs, totalVar, conceptoTotal, perpConcepto };
  }, [data?.colimacion]);

  // ─── Cálculos uniformidad detector ───
  const uniformidadResults = useMemo(() => {
    return (data?.uniformidadDet ?? []).map((det) => {
      const calcOrientation = (suffix: "ac" | "ca") => {
        const center = num(det[`roi_0_vmp_${suffix}` as keyof typeof det]);
        if (!center) return { uniformidades: [] as number[], max: null as number | null };
        const uniformidades = [1, 2, 3, 4].map((i) => {
          const roi = num(det[`roi_${i}_vmp_${suffix}` as keyof typeof det]);
          return roi && center ? Math.abs(100 * (roi - center) / center) : 0;
        });
        return { uniformidades, max: Math.max(...uniformidades) };
      };
      const ac = calcOrientation("ac");
      const ca = calcOrientation("ca");
      const maxGlobal =
        ac.max !== null && ca.max !== null
          ? Math.max(ac.max, ca.max)
          : ac.max ?? ca.max;
      return { det, ac, ca, maxGlobal };
    });
  }, [data?.uniformidadDet]);

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

  const colim = data.colimacion;
  const resol = data.resolucion;
  const bc = data.bajoContraste;
  const mtfData = data.mtf;

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
            Grupo E — Pruebas 2.3, 2.11, 2.12, 2.13, 2.16
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            Colimacion, Resolucion, Contraste y MTF
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Sistema de colimacion, uniformidad del detector, resolucion espacial, bajo contraste y
            funcion de transferencia de modulacion.
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
          PRUEBA 2.3 — COLIMACIÓN
          ═══════════════════════════════════════════ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.3" title="Sistema de colimacion y perpendicularidad" icon={Target}>
            Coincidencia del campo luminoso con el campo de radiacion. Tolerancia: &lt; 2% por lado, &lt; 4% total.
          </StepHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageSlot
              label="Montaje experimental colimacion"
              evidencia={getEvidencia("2.3", "montaje_colimacion")}
              onCapture={(file) => captureImage("2.3", "montaje_colimacion", file)}
              onRemove={() => removeImage("2.3", "montaje_colimacion")}
            />
            <ImageSlot
              label="Imagen del patron de prueba (radiografia)"
              evidencia={getEvidencia("2.3", "patron_colimacion")}
              onCapture={(file) => captureImage("2.3", "patron_colimacion", file)}
              onRemove={() => removeImage("2.3", "patron_colimacion")}
            />
          </div>

          <CollapsibleSection title="Tecnica y distancia">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SID (cm)</label>
                <Input type="number" className="rounded-xl h-9 text-sm font-medium" defaultValue={colim?.sid_cm ?? 100}
                  onBlur={(e) => updateColimacion({ sid_cm: e.target.value ? parseFloat(e.target.value) : 100 })} />
              </div>
              {[
                ["tecnica_kv", "kVp", "75"],
                ["tecnica_ma", "mA", ""],
                ["tecnica_mas", "mAs", ""],
              ].map(([field, label, ph]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                  <Input type="number" step="0.01" className="rounded-xl h-9 text-sm font-medium"
                    defaultValue={(colim as Record<string, unknown> | undefined)?.[field] as string ?? ""}
                    placeholder={ph}
                    onBlur={(e) => updateColimacion({ [field]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Nominal / Medido por dirección */}
          <CollapsibleSection title="Mediciones por direccion">
            <div className="space-y-3">
              {DIRECCIONES.map((d) => (
                <div key={d.key} className="grid grid-cols-3 gap-2 items-end">
                  <div className="text-xs font-black text-primary">{d.label}</div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Nominal (cm)</label>
                    <Input type="number" step="0.1" className="rounded-lg h-8 text-xs font-medium"
                      defaultValue={(colim as Record<string, unknown> | undefined)?.[`${d.key}_nominal`] as string ?? ""}
                      placeholder="—"
                      onBlur={(e) => updateColimacion({ [`${d.key}_nominal`]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Medido (cm)</label>
                    <Input type="number" step="0.1" className="rounded-lg h-8 text-xs font-medium border-blue-200 bg-blue-50/50"
                      defaultValue={(colim as Record<string, unknown> | undefined)?.[`${d.key}_medido`] as string ?? ""}
                      placeholder="—"
                      onBlur={(e) => updateColimacion({ [`${d.key}_medido`]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Resultados colimación */}
          {colimacionResults && (
            <CollapsibleSection title="Resultados colimacion">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["Direccion", "Nominal", "Medido", "Dif (cm)", "Var %", "Tol", ""].map((h) => (
                        <th key={h} className="text-[9px] font-black text-slate-400 uppercase text-left py-1.5 px-1.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {colimacionResults.dirs.map((d) => (
                      <tr key={d.key} className="border-b border-slate-100">
                        <td className="py-1.5 px-1.5 font-medium text-slate-700">{d.label}</td>
                        <td className="py-1.5 px-1.5 font-mono">{d.nominal || "—"}</td>
                        <td className="py-1.5 px-1.5 font-mono">{d.medido || "—"}</td>
                        <td className="py-1.5 px-1.5 font-mono">{d.diff.toFixed(1)}</td>
                        <td className="py-1.5 px-1.5 font-mono font-bold">{d.varPct.toFixed(1)}%</td>
                        <td className="py-1.5 px-1.5 text-slate-400">&lt; 2%</td>
                        <td className="py-1.5 px-1.5"><ConceptoBadge concepto={d.concepto} /></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200">
                      <td className="py-1.5 px-1.5 font-black text-slate-700" colSpan={4}>Total</td>
                      <td className="py-1.5 px-1.5 font-mono font-black">{colimacionResults.totalVar.toFixed(1)}%</td>
                      <td className="py-1.5 px-1.5 text-slate-400">&lt; 4%</td>
                      <td className="py-1.5 px-1.5"><ConceptoBadge concepto={colimacionResults.conceptoTotal} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Perpendicularidad */}
          <CollapsibleSection title="Perpendicularidad del rayo central">
            <Tip>Selecciona donde se ubico la esfera en la imagen del patron de colimacion.</Tip>
            <select
              className="w-full rounded-xl border border-slate-200 h-9 text-xs font-medium px-3 bg-white"
              value={colim?.posicion_esfera ?? ""}
              onChange={(e) => updateColimacion({ posicion_esfera: e.target.value || undefined })}
            >
              <option value="">Seleccionar posicion</option>
              {POSICIONES_ESFERA.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {colimacionResults?.perpConcepto && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-medium text-slate-600">Concepto perpendicularidad</span>
                <ConceptoBadge concepto={colimacionResults.perpConcepto} />
              </div>
            )}
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.11 — UNIFORMIDAD DETECTOR
          ═══════════════════════════════════════════ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.11" title="Uniformidad y artefactos del detector" icon={Target}>
            Analisis de ROIs en imagenes DICOM a 0° y 180°. Se repite por cada chasis CR o DR.
          </StepHeader>

          <Alert>Poner el lado mas largo del detector en orientacion anodo-catodo.</Alert>
          <Alert>Hacer esta prueba ANTES que el resto o dejar reposar el detector 30 min.</Alert>
          <Alert>Poner filtro de cobre a la salida del tubo. Colimar para cubrir el cobre.</Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageSlot label="Imagen DICOM 0°" evidencia={getEvidencia("2.11", "dicom_0")}
              onCapture={(f) => captureImage("2.11", "dicom_0", f)} onRemove={() => removeImage("2.11", "dicom_0")} />
            <ImageSlot label="Imagen DICOM 180°" evidencia={getEvidencia("2.11", "dicom_180")}
              onCapture={(f) => captureImage("2.11", "dicom_180", f)} onRemove={() => removeImage("2.11", "dicom_180")} />
          </div>

          {uniformidadResults.map((ur, idx) => (
            <CollapsibleSection key={ur.det.id} title={`Detector ${idx + 1}${ur.det.serie_detector ? ` — ${ur.det.serie_detector}` : ""}`}>
              <div className="space-y-3">
                <Input className="rounded-xl h-8 text-xs font-medium" placeholder="Serie del detector"
                  defaultValue={ur.det.serie_detector ?? ""}
                  onBlur={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { serie_detector: e.target.value || undefined })} />

                {/* Tolerancia */}
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Tolerancia (%)</label>
                  <Input type="number" step="1" className="rounded-lg h-7 text-xs font-medium w-20"
                    defaultValue={ur.det.tolerancia_pct ?? 15}
                    onBlur={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { tolerancia_pct: e.target.value ? parseFloat(e.target.value) : 15 })} />
                </div>

                {(["ac", "ca"] as const).map((orient) => (
                  <div key={orient} className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{orient === "ac" ? "0° (Anodo-Catodo)" : "180° (Catodo-Anodo)"}</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map((i) => {
                        const vmpField = `roi_${i}_vmp_${orient}` as keyof typeof ur.det;
                        const desvField = `roi_${i}_desv_${orient}` as keyof typeof ur.det;
                        return (
                          <div key={i} className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">
                              {i === 0 ? "ROIc" : `ROI${i}`}
                            </label>
                            <Input type="number" step="0.1" className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50"
                              defaultValue={ur.det[vmpField] as number ?? ""}
                              placeholder="VMP"
                              onBlur={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { [vmpField]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                            <Input type="number" step="0.1" className="rounded-lg h-7 text-xs font-medium border-slate-200"
                              defaultValue={ur.det[desvField] as number ?? ""}
                              placeholder="Desv."
                              onBlur={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { [desvField]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                          </div>
                        );
                      })}
                    </div>
                    {(orient === "ac" ? ur.ac : ur.ca).max !== null && (
                      <p className="text-[10px] text-slate-500">
                        Uniformidad max: <span className="font-black text-slate-800">{(orient === "ac" ? ur.ac : ur.ca).max?.toFixed(1)}%</span>
                      </p>
                    )}
                  </div>
                ))}

                {/* Artefactos */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" checked={ur.det.pixeles_defectuosos ?? false}
                      onChange={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { pixeles_defectuosos: e.target.checked })} />
                    <span className="text-xs text-slate-600">Pixeles defectuosos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" checked={ur.det.artefactos ?? false}
                      onChange={(e) => ur.det.id && updateUniformidadDet(ur.det.id, { artefactos: e.target.checked })} />
                    <span className="text-xs text-slate-600">Artefactos visibles</span>
                  </div>
                </div>

                {ur.maxGlobal !== null && (
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-xs font-bold text-slate-700">Uniformidad max global</span>
                    <span className="text-xs font-black text-primary">{ur.maxGlobal.toFixed(1)}%</span>
                  </div>
                )}

                <button type="button" onClick={() => ur.det.id && removeUniformidadDet(ur.det.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-bold">
                  Eliminar detector
                </button>
              </div>
            </CollapsibleSection>
          ))}

          <Button variant="outline" className="w-full rounded-xl border-dashed border-2 h-10 font-bold text-sm"
            onClick={addUniformidadDet}>
            <Plus className="w-4 h-4 mr-2" /> Agregar detector / chasis
          </Button>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.12 — RESOLUCIÓN ALTO CONTRASTE
          ═══════════════════════════════════════════ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.12" title="Resolucion espacial de alto contraste" icon={Target}>
            Identifica el grupo de barras mas fino visible en el patron de resolucion.
          </StepHeader>

          <ImageSlot label="Montaje patron de resolucion" evidencia={getEvidencia("2.12", "montaje_resolucion")}
            onCapture={(f) => captureImage("2.12", "montaje_resolucion", f)} onRemove={() => removeImage("2.12", "montaje_resolucion")} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SID (cm)</label>
              <Input type="number" className="rounded-xl h-9 text-sm font-medium" defaultValue={resol?.sid_cm ?? 100}
                onBlur={(e) => updateResolucion({ sid_cm: e.target.value ? parseFloat(e.target.value) : 100 })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">kVp</label>
              <Input type="number" className="rounded-xl h-9 text-sm font-medium" defaultValue={resol?.tecnica_kv ?? 75}
                onBlur={(e) => updateResolucion({ tecnica_kv: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">mAs</label>
              <Input type="number" className="rounded-xl h-9 text-sm font-medium" defaultValue={resol?.tecnica_mas ?? ""}
                onBlur={(e) => updateResolucion({ tecnica_mas: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">pl/mm visibles</label>
              <Input type="number" step="0.1" className="rounded-xl h-9 text-sm font-black border-blue-200 bg-blue-50/50"
                defaultValue={resol?.pares_lineas_plmm ?? ""} placeholder="Ej: 2.5"
                onBlur={(e) => updateResolucion({ pares_lineas_plmm: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.13 — BAJO CONTRASTE
          ═══════════════════════════════════════════ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.13" title="Umbral de sensibilidad a bajo contraste" icon={Target}>
            Marca los niveles de contraste visibles en la imagen del phantom.
          </StepHeader>

          <ImageSlot label="Montaje patron bajo contraste" evidencia={getEvidencia("2.13", "montaje_bajo_contraste")}
            onCapture={(f) => captureImage("2.13", "montaje_bajo_contraste", f)} onRemove={() => removeImage("2.13", "montaje_bajo_contraste")} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NIVELES_CONTRASTE.map((nc) => {
              const checked = bc?.[nc.key] ?? false;
              return (
                <button
                  key={nc.key}
                  type="button"
                  onClick={() => updateBajoContraste({ [nc.key]: !checked })}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    checked
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <p className="text-xs font-black">{nc.label}</p>
                  <p className="text-[10px] mt-0.5">{checked ? "Visible" : "No visible"}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          PRUEBA 2.16 — MTF
          ═══════════════════════════════════════════ */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-5">
          <StepHeader step="Prueba 2.16" title="Funcion de transferencia de modulacion (MTF)" icon={Target}>
            Analisis MTF con ImageJ. Registra los valores MTF50 y MTF20 horizontal y vertical.
          </StepHeader>

          <Alert>Quitar el filtro de cobre para esta prueba.</Alert>

          <ImageSlot label="Imagen DICOM para MTF" evidencia={getEvidencia("2.16", "dicom_mtf")}
            onCapture={(f) => captureImage("2.16", "dicom_mtf", f)} onRemove={() => removeImage("2.16", "dicom_mtf")} />

          <CollapsibleSection title="Tecnica y parametros">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["distancia_foco_sensor_cm", "Foco-sensor (cm)", "150"],
                ["tecnica_kv", "kVp", "70"],
                ["pixel_size_mm", "Pixel size (mm)", "0.15"],
                ["nyquist_lpmm", "Nyquist (lp/mm)", "3.33"],
              ].map(([field, label, ph]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                  <Input type="number" step="0.01" className="rounded-xl h-9 text-sm font-medium"
                    defaultValue={(mtfData as Record<string, unknown> | undefined)?.[field] as string ?? ""}
                    placeholder={ph}
                    onBlur={(e) => updateMtf({ [field]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Valores MTF medidos">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["mtf50_horizontal", "MTF50 Horizontal (lp/mm)"],
                ["mtf20_horizontal", "MTF20 Horizontal (lp/mm)"],
                ["mtf50_vertical", "MTF50 Vertical (lp/mm)"],
                ["mtf20_vertical", "MTF20 Vertical (lp/mm)"],
              ].map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                  <Input type="number" step="0.01" className="rounded-xl h-9 text-sm font-medium border-blue-200 bg-blue-50/50"
                    defaultValue={(mtfData as Record<string, unknown> | undefined)?.[field] as string ?? ""}
                    placeholder="—"
                    onBlur={(e) => updateMtf({ [field]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Valores base (referencia)" defaultOpen={false}>
            <Tip>Valores de la visita anterior. Si es primera visita, dejar vacios.</Tip>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["mtf50_base_horizontal", "MTF50 Base Horiz."],
                ["mtf20_base_horizontal", "MTF20 Base Horiz."],
                ["mtf50_base_vertical", "MTF50 Base Vert."],
                ["mtf20_base_vertical", "MTF20 Base Vert."],
              ].map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                  <Input type="number" step="0.01" className="rounded-xl h-9 text-sm font-medium"
                    defaultValue={(mtfData as Record<string, unknown> | undefined)?.[field] as string ?? ""}
                    placeholder="—"
                    onBlur={(e) => updateMtf({ [field]: e.target.value ? parseFloat(e.target.value) : undefined })} />
                </div>
              ))}
            </div>
          </CollapsibleSection>
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
