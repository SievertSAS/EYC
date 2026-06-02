"use client";

import { use, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Plus, Trash2, Loader2, AlertCircle, Image } from "lucide-react";
import Link from "next/link";
import { ModuleNav } from "@/components/module-nav";

const TIPOS_EVIDENCIA = [
  "equipo_general",
  "placa_generador",
  "placa_tubo",
  "panel_control",
  "colimador",
  "sala_completa",
  "blindaje",
  "señalizacion",
  "elementos_proteccion",
  "detector",
  "medicion",
  "otro",
];

export default function EvidenciasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const evidencias = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return undefined;
    return db.evidencias.where("visita_id").equals(visitaId).toArray();
  }, [isReady, visitaId]);

  // Capturar foto
  const capturarFoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const now = new Date().toISOString();
      for (const file of Array.from(files)) {
        const blob = new Blob([await file.arrayBuffer()], {
          type: file.type,
        });
        await db.evidencias.add({
          visita_id: visitaId,
          tipo: "otro",
          descripcion: "",
          blob_local: blob,
          fecha_captura: now,
          sync_status: "pending",
          last_modified: now,
          creado_en: now,
        });
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [visitaId]
  );

  const actualizarEvidencia = useCallback(
    async (evidenciaId: number, campo: { tipo?: string; descripcion?: string }) => {
      await db.evidencias.update(evidenciaId, {
        ...campo,
        last_modified: new Date().toISOString(),
        sync_status: "pending",
      });
    },
    []
  );

  const eliminarEvidencia = useCallback(async (evidenciaId: number) => {
    await db.evidencias.delete(evidenciaId);
  }, []);

  if (!isReady || evidencias === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando evidencias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación entre módulos */}
      <ModuleNav visitaId={visitaId} currentModule="evidencias" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
            Evidencias Fotográficas
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {evidencias.length} foto{evidencias.length !== 1 ? "s" : ""} capturada
            {evidencias.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={capturarFoto}
          className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-10 px-4 text-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Agregar foto
        </Button>
      </div>

      {/* Input oculto para captura */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Grid de evidencias */}
      {evidencias.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Sin evidencias fotográficas</p>
          <p className="text-slate-400 text-sm max-w-xs">
            Toma fotos del equipo, placas de identificación, sala, blindaje y señalización.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {evidencias.map((ev) => (
            <EvidenciaCard
              key={ev.id}
              evidencia={ev}
              onUpdate={actualizarEvidencia}
              onDelete={eliminarEvidencia}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de evidencia ───

function EvidenciaCard({
  evidencia,
  onUpdate,
  onDelete,
}: {
  evidencia: {
    id?: number;
    tipo?: string;
    descripcion?: string;
    blob_local?: Blob;
    fecha_captura?: string;
  };
  onUpdate: (id: number, campo: { tipo?: string; descripcion?: string }) => void;
  onDelete: (id: number) => void;
}) {
  // Generar URL temporal del blob
  const imageUrl = evidencia.blob_local ? URL.createObjectURL(evidencia.blob_local) : null;

  return (
    <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
      {/* Preview de imagen */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={evidencia.descripcion || "Evidencia"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-10 h-10 text-slate-300" />
          </div>
        )}
        {/* Botón eliminar */}
        <button
          onClick={() => onDelete(evidencia.id!)}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-xl p-2 shadow-lg hover:bg-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Tipo de evidencia */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Tipo
          </Label>
          <select
            className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-9 text-sm px-3 outline-none transition-colors bg-white"
            defaultValue={evidencia.tipo ?? "otro"}
            onChange={(e) => onUpdate(evidencia.id!, { tipo: e.target.value })}
          >
            {TIPOS_EVIDENCIA.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Descripción
          </Label>
          <Input
            type="text"
            placeholder="Describe la foto..."
            className="rounded-xl border-slate-200 focus:border-primary font-medium h-9 text-sm"
            defaultValue={evidencia.descripcion ?? ""}
            onBlur={(e) => onUpdate(evidencia.id!, { descripcion: e.target.value })}
          />
        </div>

        {/* Fecha */}
        {evidencia.fecha_captura && (
          <p className="text-[10px] text-slate-400 font-medium">
            {new Date(evidencia.fecha_captura).toLocaleString("es-CO")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
