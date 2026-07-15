"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Zap,
  Gauge,
  SlidersHorizontal,
  MonitorCheck,
  Target,
} from "lucide-react";
import Link from "next/link";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import type { ConvInformeSeccion } from "@/lib/equipos/convencional/db/types";
import {
  cargarTablasConv,
  evaluarConceptoPrueba,
  tieneCriterio,
} from "@/lib/equipos/convencional/evaluacion";

// ─── Constants ───

const GRUPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  A: Gauge,
  B: Zap,
  C: SlidersHorizontal,
  D: MonitorCheck,
  E: Target,
};

type ConceptoType = "Conforme" | "No_conforme" | "No_aplica";

// ─── UI Components ───

function SeccionCard({
  seccion,
  catalogo,
  conceptoEfectivo,
  expanded,
  onToggleExpand,
  onToggleIncluida,
  onUpdateAcciones,
  onUpdateObservaciones,
}: {
  seccion: ConvInformeSeccion;
  catalogo: (typeof CATALOGO_SECCIONES)[0];
  /** Concepto calculado automáticamente desde los datos capturados. */
  conceptoEfectivo?: ConceptoType;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleIncluida: () => void;
  onUpdateAcciones: (v: string) => void;
  onUpdateObservaciones: (v: string) => void;
}) {
  const Icon = GRUPO_ICONS[catalogo.grupo] ?? FileText;
  const analisisRef = useRef<HTMLTextAreaElement>(null);
  const accionesRef = useRef<HTMLTextAreaElement>(null);
  const sinCriterio = !tieneCriterio(catalogo.codigo);

  // Acciones correctivas con predeterminado editable — solo 2.1, 2.2 y 2.13
  // (las demás pruebas usan el textarea libre, solo visible en No conforme).
  const tieneAccionesPredeterminadas = Boolean(
    catalogo.accionesConforme || catalogo.accionesNoConforme
  );
  const accionDefault =
    conceptoEfectivo === "Conforme"
      ? catalogo.accionesConforme
      : conceptoEfectivo === "No_conforme"
        ? catalogo.accionesNoConforme
        : undefined;

  return (
    <div
      className={`rounded-2xl border bg-white transition-all duration-200 ${
        seccion.incluida
          ? "border-slate-200 shadow-sm"
          : "border-dashed border-slate-300 bg-slate-50/50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-3">
        {/* Toggle */}
        <button type="button" onClick={onToggleIncluida} className="flex-shrink-0">
          {seccion.incluida ? (
            <ToggleRight className="w-6 h-6 text-primary" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-slate-300" />
          )}
        </button>

        {/* Icon */}
        <div
          className={`p-1.5 rounded-lg flex-shrink-0 ${
            seccion.incluida ? "bg-primary/10" : "bg-slate-100"
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${seccion.incluida ? "text-primary" : "text-slate-400"}`} />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${
                seccion.incluida ? "text-primary" : "text-slate-400"
              }`}
            >
              {catalogo.codigo}
            </span>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              Grupo {catalogo.grupo}
            </span>
          </div>
          <p
            className={`text-xs font-bold truncate ${
              seccion.incluida ? "text-slate-800" : "text-slate-400"
            }`}
          >
            {catalogo.nombre}
          </p>
        </div>

        {/* Concepto badge — incluye el estado del switch (apagado = No aplica) */}
        <ConceptoBadgeSmall concepto={conceptoEfectivo} />

        {/* Expand */}
        <button type="button" onClick={onToggleExpand} className="p-1 flex-shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && seccion.incluida && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3 ml-8">
          {/* Concepto — siempre automático desde los datos capturados */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              {sinCriterio
                ? "Esta prueba es de carácter descriptivo/referencial y no define un criterio de aceptación, por lo que no emite concepto."
                : "El concepto (Conforme / No conforme) se calcula automáticamente a partir de los datos capturados de la prueba. Usa el interruptor para marcar la prueba como no aplicable."}
            </p>
          </div>

          {/* Acciones correctivas — 2.1/2.2/2.13 traen predeterminado editable
              según el concepto (Conforme/No conforme); el resto usa texto
              libre, solo visible cuando el concepto es No conforme. */}
          {tieneAccionesPredeterminadas && accionDefault != null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Acciones correctivas
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (accionesRef.current) accionesRef.current.value = accionDefault;
                    onUpdateAcciones(accionDefault);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar predeterminado
                </button>
              </div>
              <textarea
                ref={accionesRef}
                key={`${seccion.id}-${conceptoEfectivo}`}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                defaultValue={seccion.acciones_correctivas ?? accionDefault}
                placeholder="Describa las acciones correctivas requeridas..."
                onBlur={(e) => onUpdateAcciones(e.target.value)}
              />
            </div>
          ) : (
            conceptoEfectivo === "No_conforme" && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Acciones correctivas
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  defaultValue={seccion.acciones_correctivas ?? ""}
                  placeholder="Describa las acciones correctivas requeridas..."
                  onBlur={(e) => onUpdateAcciones(e.target.value)}
                />
              </div>
            )
          )}

          {/* Análisis — solo para secciones con texto de análisis (2.2).
              Trae el texto por defecto editable y se guarda en observaciones. */}
          {catalogo.analisis && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Análisis
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const def = catalogo.analisis ?? "";
                    if (analisisRef.current) analisisRef.current.value = def;
                    onUpdateObservaciones(def);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar predeterminado
                </button>
              </div>
              <textarea
                ref={analisisRef}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium resize-none h-40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                defaultValue={seccion.observaciones ?? catalogo.analisis ?? ""}
                placeholder="Análisis de la inspección visual..."
                onBlur={(e) => onUpdateObservaciones(e.target.value)}
              />
            </div>
          )}

          {/* Preview de textos TECDOC (colapsado) */}
          <details className="group">
            <summary className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-primary">
              Ver textos del informe (objetivo, metodologia, criterio)
            </summary>
            <div className="mt-2 space-y-2 text-[10px] text-slate-500 leading-relaxed">
              <div>
                <span className="font-black text-slate-600">Objetivo: </span>
                {catalogo.objetivo}
              </div>
              <div>
                <span className="font-black text-slate-600">Instrumentacion: </span>
                {catalogo.instrumentacion}
              </div>
              <div>
                <span className="font-black text-slate-600">Metodologia: </span>
                {catalogo.metodologia}
              </div>
              <div>
                <span className="font-black text-slate-600">Criterio: </span>
                {catalogo.criterio}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ConceptoBadgeSmall({ concepto }: { concepto?: ConceptoType }) {
  if (!concepto) return null;
  if (concepto === "Conforme")
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
        <CheckCircle2 className="w-3 h-3" /> OK
      </span>
    );
  if (concepto === "No_conforme")
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
        <XCircle className="w-3 h-3" /> NC
      </span>
    );
  return (
    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
      N/A
    </span>
  );
}

// ─── Main Page ───

export default function PreInformePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = id;
  const { isReady } = useDb();
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCodigo, setExpandedCodigo] = useState<string | null>(null);

  // ─── Live data ───
  const data = useLiveQuery(async () => {
    if (!isReady || !visitaId) return null;
    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const secciones = await db.conv_informe_secciones
      .where("visita_id")
      .equals(visitaId)
      .sortBy("orden");

    // Todas las tablas conv_* — el concepto de cada prueba se deriva de aquí
    const datos = await cargarTablasConv(visitaId);

    return { visita, secciones, datos };
  }, [isReady, visitaId]);

  const datos = data?.datos;

  // Concepto efectivo de una prueba: No aplica si está excluida, o el veredicto
  // automático del evaluador (undefined = pendiente / sin datos).
  const conceptoDe = useCallback(
    (seccion: ConvInformeSeccion): ConceptoType | undefined => {
      if (!seccion.incluida) return "No_aplica";
      if (!datos) return undefined;
      return evaluarConceptoPrueba(seccion.prueba_codigo, datos);
    },
    [datos]
  );

  // ─── Initialize secciones from catalog ───
  useEffect(() => {
    if (!data || data.secciones.length > 0) return;
    const now = new Date().toISOString();
    const rows = CATALOGO_SECCIONES.map((cat) => ({
      id: randomUUID(),
      visita_id: visitaId,
      prueba_codigo: cat.codigo,
      orden: cat.orden,
      incluida: true,
      creado_en: now,
    }));
    db.conv_informe_secciones.bulkAdd(rows);
  }, [data, visitaId]);

  // ─── Sorted secciones ───
  const secciones = useMemo(() => {
    const arr = [...(data?.secciones ?? [])];
    arr.sort((a, b) => a.orden - b.orden);
    return arr;
  }, [data?.secciones]);

  // ─── Catalog map ───
  const catalogoMap = useMemo(() => {
    const m = new Map<string, (typeof CATALOGO_SECCIONES)[0]>();
    for (const c of CATALOGO_SECCIONES) m.set(c.codigo, c);
    return m;
  }, []);

  // ─── Update helpers ───
  async function updateSeccion(id: string, fields: Partial<ConvInformeSeccion>) {
    await db.conv_informe_secciones.update(id, fields);
  }

  // ─── Toggle all ───
  async function toggleAll(incluida: boolean) {
    await Promise.all(
      secciones.map((s) => s.id && db.conv_informe_secciones.update(s.id, { incluida }))
    );
  }

  // ─── Stats ───
  const stats = useMemo(() => {
    // Todas las pruebas van al informe; el switch apagado = No aplica.
    // El concepto se deriva automáticamente de los datos capturados.
    const conformes = secciones.filter((s) => conceptoDe(s) === "Conforme").length;
    const noConformes = secciones.filter((s) => conceptoDe(s) === "No_conforme").length;
    const noAplica = secciones.filter((s) => conceptoDe(s) === "No_aplica").length;
    const sinConcepto = secciones.filter(
      (s) => s.incluida && conceptoDe(s) == null && tieneCriterio(s.prueba_codigo)
    ).length;
    return { total: secciones.length, conformes, noConformes, noAplica, sinConcepto };
  }, [secciones, conceptoDe]);

  // ─── Generate PDF ───
  const handleGenerar = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      setPdfUrl(null);

      const { generarPreInforme } = await import("@/lib/pdf/generar-pre-informe");
      const blob = await generarPreInforme(visitaId);
      if (!blob) {
        setError("No se pudo generar el pre-informe. Verifica los datos.");
        return;
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error("Error generando PDF:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al generar el PDF");
    } finally {
      setGenerating(false);
    }
  }, [visitaId]);

  const handleDescargar = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `pre-informe-visita-${id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
  }, [pdfUrl, id]);

  // ─── Loading / Error ───
  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando...</p>
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
      <div>
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pre-Informe</p>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
          Editor del Informe
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Organiza las secciones, asigna conceptos y genera el PDF.
        </p>
      </div>

      {/* Stats bar */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-lg font-black text-primary">{stats.total}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Pruebas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-emerald-600">{stats.conformes}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Conformes</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-red-600">{stats.noConformes}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">No conf.</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-slate-400">{stats.noAplica}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">N/A</p>
              </div>
              {stats.sinConcepto > 0 && (
                <div className="text-center">
                  <p className="text-lg font-black text-amber-500">{stats.sinConcepto}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Pendientes</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-[10px] font-bold h-8"
                onClick={() => toggleAll(true)}
              >
                Incluir todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-[10px] font-bold h-8"
                onClick={() => toggleAll(false)}
              >
                Excluir todas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secciones fijas — Portada, Información, Introducción */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          Secciones fijas
        </p>
        {[
          { label: "Portada", desc: "Identificacion del equipo e instalacion" },
          {
            label: "Informacion de la practica",
            desc: "Datos generales, generador, tubo, colimador",
          },
          { label: "Introduccion", desc: "Texto TECDOC normativo" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
          >
            <div className="bg-slate-200 p-1.5 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-600">{s.label}</p>
              <p className="text-[10px] text-slate-400">{s.desc}</p>
            </div>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Fija
            </span>
          </div>
        ))}
      </div>

      {/* Secciones de pruebas */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          Pruebas de control de calidad
        </p>

        {secciones.map((seccion) => {
          const cat = catalogoMap.get(seccion.prueba_codigo);
          if (!cat) return null;

          return (
            <SeccionCard
              key={seccion.id}
              seccion={seccion}
              catalogo={cat}
              conceptoEfectivo={conceptoDe(seccion)}
              expanded={expandedCodigo === seccion.prueba_codigo}
              onToggleExpand={() =>
                setExpandedCodigo(
                  expandedCodigo === seccion.prueba_codigo ? null : seccion.prueba_codigo
                )
              }
              onToggleIncluida={() =>
                seccion.id && updateSeccion(seccion.id, { incluida: !seccion.incluida })
              }
              onUpdateAcciones={(v) =>
                seccion.id && updateSeccion(seccion.id, { acciones_correctivas: v || undefined })
              }
              onUpdateObservaciones={(v) =>
                seccion.id && updateSeccion(seccion.id, { observaciones: v || undefined })
              }
            />
          );
        })}
      </div>

      {/* Secciones finales fijas */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          Secciones finales
        </p>
        {[
          { label: "Resumen de resultados", desc: "Tabla resumen auto-generada" },
          { label: "Concepto general", desc: "Favorable / No favorable" },
          { label: "Acciones correctivas", desc: "Consolidado de acciones" },
          { label: "Observaciones generales", desc: "Notas del fisico" },
          { label: "Firmas", desc: "Director tecnico y responsable de visita" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
          >
            <div className="bg-slate-200 p-1.5 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-600">{s.label}</p>
              <p className="text-[10px] text-slate-400">{s.desc}</p>
            </div>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Fija
            </span>
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleGenerar}
          disabled={generating || stats.total === 0}
          className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-12 px-6 flex-1"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Generando PDF...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Generar Pre-Informe
            </>
          )}
        </Button>

        {pdfUrl && (
          <Button
            onClick={handleDescargar}
            variant="outline"
            className="rounded-xl font-black border-slate-200 hover:bg-primary/5 h-12 px-6"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-xl p-4 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Preview del PDF */}
      {pdfUrl && (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-xl">
                <Eye className="text-emerald-600 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Vista previa</h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Pre-informe generado exitosamente
                </p>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200">
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] sm:h-[700px]"
                title="Pre-informe PDF"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
