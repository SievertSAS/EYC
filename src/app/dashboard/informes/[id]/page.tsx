"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileText,
  Building2,
  Radio,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Hash,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { generarPreInforme } from "@/lib/pdf/generar-pre-informe";

// ============================================================
//  Detalle de informe con historial de versiones
// ============================================================

const MOTIVO_LABELS: Record<string, string> = {
  emision_inicial: "Emisión inicial",
  correccion_fisico: "Corrección del físico",
  correccion_cliente: "Corrección por cliente",
  actualizacion: "Actualización",
};

const VERSION_ESTADO_BADGE: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  borrador: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
  },
  en_revision: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  aprobado: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  reemplazado: {
    bg: "bg-slate-100",
    text: "text-slate-400",
    border: "border-slate-200",
  },
};

export default function InformeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const informeId = parseInt(id, 10);
  const { isReady } = useDb();

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(informeId)) return null;

    const informe = await db.informes.get(informeId);
    if (!informe) return null;

    const equipo = await db.equipos.get(informe.equipo_id);
    const ubicacion = await db.ubicaciones_rx.get(informe.ubicacion_id);
    const visita = await db.visitas.get(informe.visita_id);
    const solicitud = visita
      ? await db.solicitudes.get(visita.solicitud_id)
      : undefined;
    const cliente = solicitud
      ? await db.clientes.get(solicitud.cliente_id)
      : undefined;

    const versiones = await db.informe_versiones
      .where("informe_id")
      .equals(informeId)
      .toArray();

    // Enriquecer versiones con nombres
    const versionesEnriched = await Promise.all(
      versiones.map(async (v) => {
        const generador = v.generado_por_id
          ? await db.usuarios.get(v.generado_por_id)
          : undefined;
        const revisor = v.revisado_por_id
          ? await db.usuarios.get(v.revisado_por_id)
          : undefined;
        return { ...v, generador, revisor };
      })
    );

    const hoy = new Date().toISOString().split("T")[0];
    const vigente = informe.fecha_vencimiento >= hoy;

    return {
      informe,
      equipo,
      ubicacion,
      cliente,
      visita,
      versiones: versionesEnriched.sort(
        (a, b) => b.numero_version - a.numero_version
      ),
      vigente,
    };
  }, [isReady, informeId]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando informe...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/informes"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a informes
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Informe no encontrado</p>
        </div>
      </div>
    );
  }

  const { informe, equipo, cliente, visita, versiones, vigente } = data;

  async function handleRegenerar() {
    if (!visita) return;
    try {
      const blob = await generarPreInforme(visita.id!);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error("[Informe] Error al regenerar PDF:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <Link
        href="/dashboard/informes"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a informes
      </Link>

      {/* Header */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {informe.numero_informe}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                {cliente?.nombre_cliente}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                informe.concepto_general === "FAVORABLE"
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-red-100 text-red-600 border border-red-200"
              }`}
            >
              {informe.concepto_general === "FAVORABLE" ? (
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
              ) : (
                <XCircle className="w-3 h-3 inline mr-1" />
              )}
              {informe.concepto_general}
            </span>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Equipo
              </p>
              <p className="text-sm font-bold text-slate-700">
                {equipo?.gen_marca} {equipo?.gen_modelo}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Emisión
              </p>
              <p className="text-sm font-bold text-slate-700">
                {informe.fecha_emision}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Vencimiento
              </p>
              <p
                className={`text-sm font-bold ${
                  vigente ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {informe.fecha_vencimiento}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                QR Token
              </p>
              <p className="text-xs font-mono text-slate-500 truncate">
                {informe.qr_token.substring(0, 8)}...
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleRegenerar}
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historial de versiones */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-4">
          Historial de Versiones
        </h3>
        <div className="space-y-3">
          {versiones.map((version) => {
            const estadoBadge = VERSION_ESTADO_BADGE[version.estado ?? "borrador"];
            return (
              <Card
                key={version.id}
                className="border-none shadow-sm rounded-2xl bg-white overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          Versión {version.numero_version}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${estadoBadge.bg} ${estadoBadge.text} border ${estadoBadge.border}`}
                        >
                          {version.estado}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {MOTIVO_LABELS[version.motivo_cambio ?? ""] ??
                          version.motivo_cambio}
                        {version.descripcion_cambio &&
                          ` — ${version.descripcion_cambio}`}
                      </p>
                      <div className="flex flex-wrap gap-x-4 text-[11px] text-slate-400 font-medium">
                        {version.generador && (
                          <span>Generado: {version.generador.nombre}</span>
                        )}
                        {version.revisor && (
                          <span>Revisado: {version.revisor.nombre}</span>
                        )}
                        <span>
                          {version.fecha_generacion
                            ? new Date(
                                version.fecha_generacion
                              ).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
