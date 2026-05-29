"use client";

import { use, useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
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
  Circle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";
import { generarPreInforme } from "@/lib/pdf/generar-pre-informe";

interface ModuloCheck {
  nombre: string;
  completado: boolean;
  detalle: string;
}

export default function PreInformePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recopilar estado de cada módulo
  const checks = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return undefined;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const moduloChecks: ModuloCheck[] = [];

    // Condiciones
    const tieneTemp = visita.temperatura_c != null;
    const tienePresion = visita.presion_hpa != null;
    moduloChecks.push({
      nombre: "Condiciones Ambientales",
      completado: tieneTemp && tienePresion,
      detalle: tieneTemp && tienePresion
        ? `${visita.temperatura_c}°C / ${visita.presion_hpa} hPa`
        : "Faltan datos de temperatura y/o presión",
    });

    // Levantamiento
    const mediciones = await db.mediciones_radiometricas
      .where("visita_id")
      .equals(visitaId)
      .count();
    moduloChecks.push({
      nombre: "Levantamiento Radiométrico",
      completado: mediciones > 0,
      detalle:
        mediciones > 0
          ? `${mediciones} punto${mediciones !== 1 ? "s" : ""} registrado${mediciones !== 1 ? "s" : ""}`
          : "Sin puntos de medición",
    });

    // Inspección
    const partes = visita.equipo_id
      ? await db.partes_equipo
          .where("equipo_id")
          .equals(visita.equipo_id)
          .count()
      : 0;
    moduloChecks.push({
      nombre: "Inspección Visual",
      completado: partes > 0,
      detalle:
        partes > 0
          ? `${partes} componente${partes !== 1 ? "s" : ""} evaluado${partes !== 1 ? "s" : ""}`
          : "Sin inspección registrada",
    });

    // Pruebas
    const pruebasTotal = await db.prueba_resultados
      .where("visita_id")
      .equals(visitaId)
      .count();
    const pruebasCompletadas = await db.prueba_resultados
      .where("visita_id")
      .equals(visitaId)
      .filter((p) => p.completado)
      .count();
    moduloChecks.push({
      nombre: "Pruebas de Control de Calidad",
      completado: pruebasTotal > 0 && pruebasCompletadas === pruebasTotal,
      detalle:
        pruebasTotal === 0
          ? "Sin pruebas inicializadas"
          : `${pruebasCompletadas}/${pruebasTotal} completadas`,
    });

    // Evidencias
    const evidencias = await db.evidencias
      .where("visita_id")
      .equals(visitaId)
      .count();
    moduloChecks.push({
      nombre: "Evidencias Fotográficas",
      completado: evidencias > 0,
      detalle:
        evidencias > 0
          ? `${evidencias} foto${evidencias !== 1 ? "s" : ""}`
          : "Sin evidencias (opcional)",
    });

    return moduloChecks;
  }, [isReady, visitaId]);

  const handleGenerar = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      setPdfUrl(null);

      const blob = await generarPreInforme(visitaId);
      if (!blob) {
        setError("No se pudo generar el pre-informe. Verifica los datos.");
        return;
      }

      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error("Error generando PDF:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al generar el PDF"
      );
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

  if (!isReady || checks === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando...</p>
      </div>
    );
  }

  if (checks === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
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

  const todosCompletos = checks.every((c) => c.completado);
  const algunoCompleto = checks.some((c) => c.completado);

  return (
    <div className="space-y-6">
      {/* Navegación entre módulos */}
      <ModuleNav visitaId={visitaId} currentModule="pre-informe" />

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          Pre-Informe
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Generar y previsualizar el informe preliminar en PDF
        </p>
      </div>

      {/* Checklist de módulos */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FileText className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Estado de los módulos
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {todosCompletos
                  ? "Todos los módulos están completos"
                  : "Algunos módulos tienen datos pendientes"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {checks.map((check) => (
              <div
                key={check.nombre}
                className="flex items-center gap-3 bg-slate-50 rounded-xl p-3"
              >
                {check.completado ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700">
                    {check.nombre}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {check.detalle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {!todosCompletos && (
            <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">
                Puedes generar el pre-informe con los datos disponibles, pero
                el informe estará incompleto. Se recomienda completar todos los
                módulos antes de generar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleGenerar}
          disabled={generating || !algunoCompleto}
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
        <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-xl">
                <Eye className="text-emerald-600 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Vista previa
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Pre-informe generado exitosamente
                </p>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200">
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] sm:h-[700px] md:h-[800px]"
                title="Pre-informe PDF"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
