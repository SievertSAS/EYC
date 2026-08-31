"use client";

import { useState, useRef, useEffect } from "react";
import { randomUUID } from "@/lib/uuid";
import { parseDecimal } from "@/lib/decimal";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { deleteAndSync, pushSingle, updateAndSync } from "@/lib/supabase/sync-engine";
import {
  ArrowLeft,
  Check,
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
import { irAModulo } from "@/lib/modulo-nav";
import { ManualDrawer } from "@/components/manual-drawer";
import { getManualGrupo } from "@/lib/equipos/convencional/manual";
import { SetupField } from "@/components/visita-modulos/setup-field";
import { useRowSavedFlash } from "@/hooks/use-row-saved";
import { useImagenSrc } from "@/hooks/use-imagen-src";

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

/**
 * Grupos donde los disparos comparten la MISMA técnica nominal: el primer
 * disparo es editable y los demás se igualan a él (espejo bloqueado).
 * Aplica a todos los grupos con más de una repetición (1–6).
 */
const GRUPOS_ESPEJO = new Set(
  GRUPOS_DISPAROS.filter((g) => g.repeticiones > 1).map((g) => g.grupo)
);

type CampoNominal = "kv_nominal" | "ma_nominal" | "tiempo_nominal_s" | "mas_nominal";

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

/** Celda de solo lectura: valores medidos (RaySafe) o técnica en espejo. */
function CeldaLectura({
  value,
  tono = "medido",
  widthClass,
}: {
  value?: number | null;
  tono?: "medido" | "espejo";
  widthClass: string;
}) {
  const estilos =
    tono === "medido"
      ? "bg-blue-50/50 border border-blue-100 text-slate-600"
      : "bg-slate-50 border border-slate-100 text-slate-400";
  return (
    <div
      className={`h-7 flex items-center px-2 rounded-lg text-xs font-medium ${estilos} ${widthClass}`}
    >
      {value == null ? "—" : value.toLocaleString("es-CO", { maximumFractionDigits: 4 })}
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

function RaysafeUploadCard({
  onImport,
}: {
  onImport: (
    result: Awaited<ReturnType<typeof parseRaysafeXlsx>> | { tipo: "tsv"; data: RaysafeRow[] }
  ) => void;
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
              const { parseRaysafeTsv } = await import("@/lib/equipos/convencional/raysafe-parser");
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
  evidencia?: { id?: string; blob_local?: Blob | null; url_storage?: string | null };
  onCapture: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useImagenSrc(evidencia ?? {});

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

export function GrupoBModulo({ visitaId: id }: { visitaId: string }) {
  const visitaId = id;
  const { isReady } = useDb();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrueba, setManualPrueba] = useState<string | undefined>();
  const [importVersion, setImportVersion] = useState(0);
  const pruebasGrupoB = getManualGrupo("B");
  // Indicador liviano de "guardado" para las filas de las 4 tablas de
  // disparos RaySafe — ver useRowSavedFlash.
  const { isSaved, flash } = useRowSavedFlash();

  const data = useLiveQuery(async () => {
    if (!isReady || !visitaId) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const [setup, mediciones, evidencias] = await Promise.all([
      db.conv_raysafe_setup.where("visita_id").equals(visitaId).first(),
      db.conv_raysafe_mediciones.where("visita_id").equals(visitaId).sortBy("toma_numero"),
      db.conv_evidencias
        .where("visita_id")
        .equals(visitaId)
        .filter((r) => !r.deleted_at)
        .toArray(),
    ]);

    return { visita, setup, mediciones, evidencias };
  }, [isReady, visitaId]);

  // ─── Initialize setup ───
  // Guard síncrono: la consulta combinada (data) se reejecuta cada vez que
  // cualquiera de sus tablas cambia — incluida la que escribe el efecto
  // hermano de disparos. Eso puede reinvocar este efecto antes de que el
  // insert previo se refleje en `data`, duplicando filas. El ref evita un
  // segundo insert dentro del mismo montaje/visita.
  const setupInsertadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data || data.setup) return;
    if (setupInsertadoRef.current === visitaId) return;
    setupInsertadoRef.current = visitaId;
    db.conv_raysafe_setup.add({
      id: randomUUID(),
      visita_id: visitaId,
      distancia_foco_sensor_cm: 100,
      creado_en: new Date().toISOString(),
      sync_status: "pending" as const,
      last_modified: new Date().toISOString(),
    });
  }, [data, visitaId]);

  // ─── Initialize default shots ─── (mismo guard, ver arriba)
  const disparosInsertadosRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data || data.mediciones.length > 0) return;
    if (disparosInsertadosRef.current === visitaId) return;
    disparosInsertadosRef.current = visitaId;
    const now = new Date().toISOString();
    let toma = 1;
    const rows: import("@/lib/equipos/convencional/db/types").ConvRaysafeMedicion[] = [];

    // Grupos principales 1-8
    for (const g of GRUPOS_DISPAROS) {
      for (let r = 0; r < g.repeticiones; r++) {
        rows.push({
          id: randomUUID(),
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
        id: randomUUID(),
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
        id: randomUUID(),
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
        id: randomUUID(),
        visita_id: visitaId,
        tipo_medicion: "kerma",
        toma_numero: toma++,
        programa_clinico: prog,
        creado_en: now,
      });
    }

    db.conv_raysafe_mediciones.bulkAdd(
      rows.map((r) => ({ ...r, sync_status: "pending" as const, last_modified: now }))
    );
  }, [data, visitaId]);

  // ─── Backfill: rellenar sin_rejilla/kerma vacíos con la técnica ya
  //     capturada en con_rejilla (solo huecos — nunca sobreescribe lo ya
  //     digitado). Cubre visitas empezadas antes de este cambio. ───
  useEffect(() => {
    if (!data) return;
    const conRejillaMap = new Map(
      data.mediciones
        .filter((m) => m.tipo_medicion === "con_rejilla" && m.programa_clinico)
        .map((m) => [m.programa_clinico!, m])
    );
    for (const m of data.mediciones) {
      if (!m.id || !m.programa_clinico) continue;
      const ref = conRejillaMap.get(m.programa_clinico);
      if (!ref) continue;
      const updates: Record<string, unknown> = {};
      if (m.tipo_medicion === "sin_rejilla") {
        if (m.kv_nominal == null && ref.kv_nominal != null) updates.kv_nominal = ref.kv_nominal;
        if (m.ma_nominal == null && ref.ma_nominal != null) updates.ma_nominal = ref.ma_nominal;
        if (m.tiempo_nominal_s == null && ref.tiempo_nominal_s != null)
          updates.tiempo_nominal_s = ref.tiempo_nominal_s;
        if (m.mas_nominal == null && ref.mas_nominal != null) updates.mas_nominal = ref.mas_nominal;
      } else if (m.tipo_medicion === "kerma") {
        if (m.kv_nominal == null && ref.kv_nominal != null) updates.kv_nominal = ref.kv_nominal;
        if (m.mas_nominal == null && ref.mas_nominal != null) updates.mas_nominal = ref.mas_nominal;
      }
      if (Object.keys(updates).length > 0) updateAndSync("conv_raysafe_mediciones", m.id, updates);
    }
  }, [data, visitaId]);

  // ─── RaySafe import handlers ───
  async function importarRaysafe(rows: RaysafeRow[], medicionesFiltradas: typeof principales) {
    for (let i = 0; i < Math.min(rows.length, medicionesFiltradas.length); i++) {
      const m = medicionesFiltradas[i];
      const r = rows[i];
      if (!m.id) continue;
      await updateAndSync("conv_raysafe_mediciones", m.id, {
        kv_medido: r.kv ?? undefined,
        dosis_medida_mgy: r.dosis_mgy ?? undefined,
        tiempo_medido_s: r.tiempo_s ?? undefined,
        chr_medido_mmal: r.chr_mmal ?? undefined,
      });
    }
  }

  async function importarPlantilla(
    result: Awaited<ReturnType<typeof parseRaysafeXlsx>> | { tipo: "tsv"; data: RaysafeRow[] }
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
    setImportVersion((v) => v + 1);
  }

  // ─── Save helpers ───
  const setupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function updateSetup(fields: Record<string, unknown>) {
    if (!data?.setup?.id) return;
    if (setupTimer.current) clearTimeout(setupTimer.current);
    setupTimer.current = setTimeout(() => {
      updateAndSync("conv_raysafe_setup", data.setup!.id!, fields);
    }, 600);
  }

  async function updateMedicion(id: string, fields: Record<string, unknown>) {
    await updateAndSync("conv_raysafe_mediciones", id, fields);
  }

  /** Propaga la técnica nominal a todas las tomas del mismo grupo (espejo). */
  async function updateNominalGrupo(
    grupoNumero: number | undefined,
    fields: Record<string, unknown>
  ) {
    if (grupoNumero == null) return;
    const tomas = principales.filter((p) => p.grupo_numero === grupoNumero);
    await Promise.all(
      tomas.map((t) => (t.id ? updateAndSync("conv_raysafe_mediciones", t.id, fields) : undefined))
    );
  }

  /**
   * "Con rejilla" es la única técnica editable para un programa clínico; al
   * guardarla se propaga a la toma "sin rejilla" (mismos 4 campos) y a la
   * toma "kerma" (solo kV y mAs, los únicos que esa tabla usa) del mismo
   * programa, para no digitar la misma técnica tres veces.
   */
  async function updateNominalConRejilla(
    conRejillaId: string,
    programaClinico: string | undefined,
    field: CampoNominal,
    value: number | undefined
  ) {
    await updateAndSync("conv_raysafe_mediciones", conRejillaId, { [field]: value });
    if (!programaClinico) return;
    const sinRejillaMatch = sinRejilla.find((m) => m.programa_clinico === programaClinico);
    if (sinRejillaMatch?.id) {
      await updateAndSync("conv_raysafe_mediciones", sinRejillaMatch.id, { [field]: value });
    }
    if (field === "kv_nominal" || field === "mas_nominal") {
      const kermaMatch = kerma.find((m) => m.programa_clinico === programaClinico);
      if (kermaMatch?.id) {
        await updateAndSync("conv_raysafe_mediciones", kermaMatch.id, { [field]: value });
      }
    }
  }

  async function captureImage(pruebaCodigo: string, slot: string, file: File) {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const now = new Date().toISOString();
    const existing = data?.evidencias?.find(
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot
    );
    if (existing?.id) {
      // Reemplazo: re-marcar pending y limpiar url_storage para que el push
      // vuelva a subir el binario nuevo al bucket (#67).
      await db.conv_evidencias.update(existing.id, {
        blob_local: blob,
        url_storage: null,
        sync_status: "pending",
        last_modified: now,
      });
      pushSingle("conv_evidencias", existing.id);
    } else {
      const nuevoId = randomUUID();
      await db.conv_evidencias.add({
        id: nuevoId,
        visita_id: visitaId,
        prueba_codigo: pruebaCodigo,
        slot,
        blob_local: blob,
        fecha_captura: now,
        creado_en: now,
        sync_status: "pending" as const,
        last_modified: now,
      });
      pushSingle("conv_evidencias", nuevoId);
    }
  }

  async function removeImage(pruebaCodigo: string, slot: string) {
    const existing = data?.evidencias?.find(
      (e) => e.prueba_codigo === pruebaCodigo && e.slot === slot
    );
    if (existing?.id) await deleteAndSync("conv_evidencias", existing.id);
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
  // "Con rejilla" es la única técnica editable; sin rejilla y kerma la reflejan
  // en espejo por programa clínico (misma técnica real, sin volver a digitarla).
  const conRejillaPorPrograma = new Map(
    conRejilla.filter((m) => m.programa_clinico).map((m) => [m.programa_clinico!, m])
  );

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
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- navegación dura intencional (ver src/lib/visita-nav.ts): permite offline vía Service Worker */}
        <a
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </a>
        <div className="flex flex-col items-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <button
        type="button"
        onClick={() => irAModulo(id)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al workspace
      </button>

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
            Verifica que el tubo de rayos X dispara correctamente comparando los valores
            configurados con los medidos por el sensor RaySafe X2.
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
            Retire el Flat Panel o cassette del Bucky. Ubique el sensor RaySafe en el centro del haz
            a la distancia indicada.
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SetupField
              label="Distancia foco-sensor (cm)"
              defaultValue={setup?.distancia_foco_sensor_cm ?? 100}
              onSave={(v) => updateSetup({ distancia_foco_sensor_cm: v ? parseDecimal(v) : 100 })}
            />
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
            {principales.length} tomas en 8 grupos. Configura la técnica nominal; los valores
            medidos (kV, t, Dosis, CHR) se llenan automáticamente al importar el archivo del
            RaySafe.
          </StepHeader>

          <Alert>
            No confundir con los valores de la precarga. Estos son los parámetros que configuras en
            el equipo para cada disparo de prueba.
          </Alert>

          <Tip>
            En los grupos de 3 disparos (1–6) basta con diligenciar la técnica de la primera toma:
            las otras dos se igualan automáticamente. Los grupos 7–8 son disparos únicos de
            referencia para la dosis al receptor.
          </Tip>

          <div
            key={`principales-${importVersion}`}
            className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5"
          >
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
                  const esEspejo = GRUPOS_ESPEJO.has(m.grupo_numero ?? -1);
                  // Tomas 2-3 de un grupo de repetibilidad: técnica en espejo (solo lectura)
                  const nominalEspejo = esEspejo && !isFirstInGroup;

                  // Técnica nominal: editable en la 1a toma (o grupos sin espejo);
                  // solo lectura en las tomas espejadas. Al editar la 1a toma de un
                  // grupo espejo, el valor se propaga a las demás tomas del grupo.
                  const celdaNominal = (campo: CampoNominal, widthClass: string, step?: string) =>
                    nominalEspejo ? (
                      <CeldaLectura
                        value={m[campo] ?? null}
                        tono="espejo"
                        widthClass={widthClass}
                      />
                    ) : (
                      <Input
                        type="number"
                        step={step}
                        className={`rounded-lg h-7 text-xs font-medium border-slate-200 ${widthClass}`}
                        defaultValue={m[campo] ?? ""}
                        onBlur={(e) => {
                          if (!m.id) return;
                          const val = e.target.value ? parseDecimal(e.target.value) : undefined;
                          if (esEspejo && isFirstInGroup)
                            updateNominalGrupo(m.grupo_numero, { [campo]: val });
                          else updateMedicion(m.id, { [campo]: val });
                          flash(m.id);
                        }}
                      />
                    );

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
                      <td className="py-1.5 px-1 text-slate-500 font-mono">
                        <span className="inline-flex items-center gap-1">
                          {m.toma_numero}
                          {m.id && isSaved(m.id) && <Check className="w-3 h-3 text-emerald-500" />}
                        </span>
                      </td>
                      <td className="py-1.5 px-1">{celdaNominal("kv_nominal", "w-16")}</td>
                      <td className="py-1.5 px-1">{celdaNominal("ma_nominal", "w-16")}</td>
                      <td className="py-1.5 px-1">
                        {celdaNominal("tiempo_nominal_s", "w-20", "0.01")}
                      </td>
                      <td className="py-1.5 px-1">{celdaNominal("mas_nominal", "w-16")}</td>
                      {/* Valores medidos — solo lectura, se llenan desde el RaySafe */}
                      <td className="py-1.5 px-1">
                        <CeldaLectura value={m.kv_medido ?? null} widthClass="w-16" />
                      </td>
                      <td className="py-1.5 px-1">
                        <CeldaLectura value={m.tiempo_medido_s ?? null} widthClass="w-20" />
                      </td>
                      <td className="py-1.5 px-1">
                        <CeldaLectura value={m.dosis_medida_mgy ?? null} widthClass="w-20" />
                      </td>
                      <td className="py-1.5 px-1">
                        <CeldaLectura value={m.chr_medido_mmal ?? null} widthClass="w-20" />
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-16"
                          defaultValue={m.dap_medido ?? ""}
                          placeholder="—"
                          onBlur={(e) => {
                            if (!m.id) return;
                            updateMedicion(m.id, {
                              dap_medido: e.target.value ? parseDecimal(e.target.value) : undefined,
                            });
                            flash(m.id);
                          }}
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

          <div
            key={`con-rejilla-${importVersion}`}
            className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5"
          >
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    "#",
                    "Programa",
                    "kV",
                    "mA",
                    "t (s)",
                    "mAs",
                    "kV med.",
                    "t med.",
                    "Dosis (mGy)",
                  ].map((label) => (
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
                {conRejilla.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-1.5 px-1.5 font-black text-primary">
                      <span className="inline-flex items-center gap-1">
                        {m.toma_numero}
                        {m.id && isSaved(m.id) && <Check className="w-3 h-3 text-emerald-500" />}
                      </span>
                    </td>
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
                            onBlur={(e) => {
                              if (!m.id) return;
                              updateNominalConRejilla(
                                m.id,
                                m.programa_clinico,
                                field,
                                e.target.value ? parseDecimal(e.target.value) : undefined
                              );
                              flash(m.id);
                            }}
                          />
                        </td>
                      )
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
                            onBlur={(e) => {
                              if (!m.id) return;
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseDecimal(e.target.value) : undefined,
                              });
                              flash(m.id);
                            }}
                          />
                        </td>
                      )
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
            Mismos programas pero sin rejilla. Necesario para calcular la dosis al receptor. La
            técnica (kV, mA, t, mAs) se toma automáticamente de &ldquo;Con rejilla&rdquo;.
          </StepHeader>

          <Tip>
            Ubique: Detector Flat DR o CR → Profluoro 150 → Sensor RF RaySafe → Tubo. Registre las
            distancias d1 (foco-sensor) y d2 (foco-detector).
          </Tip>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <SetupField
              label="Distancia foco-sensor d1 (cm)"
              defaultValue={setup?.distancia_foco_sensor_d1_cm ?? ""}
              placeholder="100"
              onSave={(v) =>
                updateSetup({ distancia_foco_sensor_d1_cm: v ? parseDecimal(v) : undefined })
              }
            />
            <SetupField
              label="Distancia foco-detector d2 (cm)"
              defaultValue={setup?.distancia_foco_detector_d2_cm ?? ""}
              placeholder="110"
              onSave={(v) =>
                updateSetup({ distancia_foco_detector_d2_cm: v ? parseDecimal(v) : undefined })
              }
            />
          </div>

          <div
            key={`sin-rejilla-${importVersion}`}
            className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5"
          >
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    "#",
                    "Programa",
                    "kV",
                    "mA",
                    "t (s)",
                    "mAs",
                    "kV med.",
                    "t med.",
                    "Dosis (mGy)",
                    "Base (mGy)",
                  ].map((label) => (
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
                {sinRejilla.map((m) => {
                  const ref = m.programa_clinico
                    ? conRejillaPorPrograma.get(m.programa_clinico)
                    : undefined;
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 font-black text-primary">
                        <span className="inline-flex items-center gap-1">
                          {m.toma_numero}
                          {m.id && isSaved(m.id) && <Check className="w-3 h-3 text-emerald-500" />}
                        </span>
                      </td>
                      <td className="py-1.5 px-1.5 font-medium text-slate-700">
                        {m.programa_clinico}
                      </td>
                      {(
                        ["kv_nominal", "ma_nominal", "tiempo_nominal_s", "mas_nominal"] as const
                      ).map((field) => (
                        <td key={field} className="py-1.5 px-1.5">
                          <CeldaLectura
                            value={ref?.[field] ?? null}
                            tono="espejo"
                            widthClass="w-16"
                          />
                        </td>
                      ))}
                      {(["kv_medido", "tiempo_medido_s", "dosis_medida_mgy"] as const).map(
                        (field) => (
                          <td key={field} className="py-1.5 px-1.5">
                            <Input
                              type="number"
                              step="0.001"
                              className="rounded-lg h-7 text-xs font-medium border-blue-200 bg-blue-50/50 w-20"
                              defaultValue={m[field] ?? ""}
                              placeholder="—"
                              onBlur={(e) => {
                                if (!m.id) return;
                                updateMedicion(m.id, {
                                  [field]: e.target.value
                                    ? parseDecimal(e.target.value)
                                    : undefined,
                                });
                                flash(m.id);
                              }}
                            />
                          </td>
                        )
                      )}
                      <td className="py-1.5 px-1.5">
                        <Input
                          type="number"
                          step="0.001"
                          className="rounded-lg h-7 text-xs font-medium border-amber-200 bg-amber-50/50 w-20"
                          defaultValue={m.dosis_base_mgy ?? ""}
                          placeholder="—"
                          onBlur={(e) => {
                            if (!m.id) return;
                            updateMedicion(m.id, {
                              dosis_base_mgy: e.target.value
                                ? parseDecimal(e.target.value)
                                : undefined,
                            });
                            flash(m.id);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
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
            El kV y mAs se toman automáticamente de &ldquo;Con rejilla&rdquo;.
          </StepHeader>

          <Alert>Retire el filtro de cobre antes de estas mediciones.</Alert>

          <Tip>
            El factor de corrección PKA = DAP estimado / DAP nominal. Permite verificar si el
            medidor de dosis-área del equipo está calibrado correctamente.
          </Tip>

          <div
            key={`kerma-${importVersion}`}
            className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5"
          >
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
                {kerma.map((m) => {
                  const ref = m.programa_clinico
                    ? conRejillaPorPrograma.get(m.programa_clinico)
                    : undefined;
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-1 font-black text-primary">
                        <span className="inline-flex items-center gap-1">
                          {m.toma_numero}
                          {m.id && isSaved(m.id) && <Check className="w-3 h-3 text-emerald-500" />}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 font-medium text-slate-700">
                        {m.programa_clinico}
                      </td>
                      <td className="py-1.5 px-1">
                        <CeldaLectura
                          value={ref?.kv_nominal ?? null}
                          tono="espejo"
                          widthClass="w-20"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <CeldaLectura
                          value={ref?.mas_nominal ?? null}
                          tono="espejo"
                          widthClass="w-20"
                        />
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
                            defaultValue={
                              ((m as unknown as Record<string, unknown>)[field] as string) ?? ""
                            }
                            placeholder="—"
                            onBlur={(e) => {
                              if (!m.id) return;
                              updateMedicion(m.id, {
                                [field]: e.target.value ? parseDecimal(e.target.value) : undefined,
                              });
                              flash(m.id);
                            }}
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
              {
                codigo: "2.4",
                nombre: "Tiempo de exposición",
                criterio: "Desviación ≤ 10%, CV ≤ 10%",
              },
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
