"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { ImageCaptureSlot } from "@/components/image-capture-slot";
import {
  evaluateFormulaSummaries,
  evaluateCriterios,
  suggestConcepto,
} from "@/lib/pruebas/engine";
import type { ImagenEmbebida } from "@/lib/db/types";

// ─── Helpers ───

function generarId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function GrupoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; grupoId: string }>;
}) {
  const { id, grupoId } = use(params);
  const visitaId = parseInt(id, 10);
  const grupoDefId = parseInt(grupoId, 10);
  const { isReady } = useDb();

  const [mediciones, setMediciones] = useState<Record<string, unknown>[]>([]);
  const [imagenes, setImagenes] = useState<ImagenEmbebida[]>([]);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Data loading ───

  const grupoDef = useLiveQuery(async () => {
    if (!isReady || isNaN(grupoDefId)) return null;
    return db.grupo_pruebas.get(grupoDefId);
  }, [isReady, grupoDefId]);

  const grupoResultado = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId) || isNaN(grupoDefId)) return null;
    return db.grupo_resultados
      .where("visita_id")
      .equals(visitaId)
      .filter((g) => g.grupo_id === grupoDefId)
      .first();
  }, [isReady, visitaId, grupoDefId]);

  const pruebaDefs = useLiveQuery(async () => {
    if (!isReady || isNaN(grupoDefId)) return [];
    return db.prueba_definiciones
      .where("grupo_id")
      .equals(grupoDefId)
      .sortBy("orden_en_grupo");
  }, [isReady, grupoDefId]);

  const pruebaResultados = useLiveQuery(async () => {
    if (!grupoResultado?.id) return [];
    return db.prueba_resultados
      .where("grupo_resultado_id")
      .equals(grupoResultado.id!)
      .toArray();
  }, [grupoResultado?.id]);

  // ─── Initialize form from existing data ───

  useEffect(() => {
    if (grupoResultado && !initialized) {
      if (grupoResultado.mediciones_json?.length > 0) {
        setMediciones(grupoResultado.mediciones_json);
      } else {
        // Start with one empty row
        setMediciones([{ _id: generarId() }]);
      }
      setImagenes(grupoResultado.imagenes ?? []);
      setInitialized(true);
    }
  }, [grupoResultado, initialized]);

  // ─── Auto-save with debounce ───

  const save = useCallback(
    async (
      newMediciones: Record<string, unknown>[],
      newImagenes: ImagenEmbebida[]
    ) => {
      if (!grupoResultado?.id) return;
      setSaveStatus("saving");
      try {
        await db.grupo_resultados.update(grupoResultado.id!, {
          mediciones_json: newMediciones,
          imagenes: newImagenes,
          last_modified: new Date().toISOString(),
          sync_status: "pending",
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("error");
      }
    },
    [grupoResultado?.id]
  );

  const debouncedSave = useCallback(
    (newMediciones: Record<string, unknown>[], newImagenes: ImagenEmbebida[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save(newMediciones, newImagenes);
      }, 800);
    },
    [save]
  );

  // ─── Mediciones CRUD ───

  function addRow() {
    const newRows = [...mediciones, { _id: generarId() }];
    setMediciones(newRows);
    debouncedSave(newRows, imagenes);
  }

  function removeRow(index: number) {
    const newRows = mediciones.filter((_, i) => i !== index);
    setMediciones(newRows);
    debouncedSave(newRows, imagenes);
  }

  function updateCell(index: number, key: string, value: string) {
    const newRows = [...mediciones];
    const col = grupoDef?.schema_mediciones.columnas.find((c) => c.key === key);
    if (col?.type === "number") {
      newRows[index] = { ...newRows[index], [key]: value === "" ? null : parseFloat(value) };
    } else {
      newRows[index] = { ...newRows[index], [key]: value };
    }
    setMediciones(newRows);
    debouncedSave(newRows, imagenes);
  }

  // ─── Image handlers ───

  function handleCapture(slotKey: string, blob: Blob) {
    const newImg: ImagenEmbebida = {
      slot_key: slotKey,
      blob_local: blob,
      fecha_captura: new Date().toISOString(),
    };
    const newImagenes = [...imagenes, newImg];
    setImagenes(newImagenes);
    debouncedSave(mediciones, newImagenes);
  }

  function handleDeleteImage(slotKey: string, slotIndex: number) {
    const slotImages = imagenes.filter((img) => img.slot_key === slotKey);
    const toDelete = slotImages[slotIndex];
    if (!toDelete) return;
    const globalIndex = imagenes.indexOf(toDelete);
    const newImagenes = imagenes.filter((_, i) => i !== globalIndex);
    setImagenes(newImagenes);
    debouncedSave(mediciones, newImagenes);
  }

  // ─── Auto-calculated results ───

  const calculatedResults = useMemo(() => {
    if (!pruebaDefs || pruebaDefs.length === 0 || mediciones.length === 0) {
      return new Map<number, { resultados: Record<string, number | null>; evaluaciones: { campo: string; valor_obtenido: number; criterio_descripcion: string; cumple: boolean }[]; concepto: "FAVORABLE" | "NO_FAVORABLE" }>();
    }

    const map = new Map<number, {
      resultados: Record<string, number | null>;
      evaluaciones: { campo: string; valor_obtenido: number; criterio_descripcion: string; cumple: boolean }[];
      concepto: "FAVORABLE" | "NO_FAVORABLE";
    }>();

    for (const def of pruebaDefs) {
      if (!def.formulas?.length && !def.criterios_aceptacion?.length) continue;

      const resultados = evaluateFormulaSummaries(
        def.formulas ?? [],
        mediciones
      );
      const evaluaciones = evaluateCriterios(
        def.criterios_aceptacion ?? [],
        resultados
      );
      const concepto =
        evaluaciones.length > 0
          ? suggestConcepto(evaluaciones)
          : "FAVORABLE";

      map.set(def.id!, { resultados, evaluaciones, concepto });
    }

    return map;
  }, [pruebaDefs, mediciones]);

  // ─── Save test results ───

  async function saveTestResults() {
    if (!pruebaResultados || !pruebaDefs || !grupoResultado?.id) return;

    setSaveStatus("saving");
    try {
      for (const def of pruebaDefs) {
        const resultado = pruebaResultados.find(
          (r) => r.prueba_definicion_id === def.id
        );
        if (!resultado) continue;

        const calc = calculatedResults.get(def.id!);
        await db.prueba_resultados.update(resultado.id!, {
          resultados_calculados: calc?.resultados ?? {},
          evaluacion_criterios: calc?.evaluaciones ?? [],
          concepto:
            calc?.concepto ??
            (def.criterios_aceptacion?.length ? undefined : "FAVORABLE"),
          completado: true,
          fecha_ejecucion: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          sync_status: "pending",
        });
      }

      // Marcar grupo como completado
      await db.grupo_resultados.update(grupoResultado.id!, {
        completado: true,
        fecha_ejecucion: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        sync_status: "pending",
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  // ─── Toggle expanded test ───

  function toggleTest(defId: number) {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(defId)) next.delete(defId);
      else next.add(defId);
      return next;
    });
  }

  // ─── Loading / Error ───

  if (!isReady || grupoDef === undefined || grupoResultado === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando grupo...</p>
      </div>
    );
  }

  if (!grupoDef || !grupoResultado) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/visitas/${id}/pruebas`}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a pruebas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">
            Grupo no encontrado
          </p>
        </div>
      </div>
    );
  }

  const columnas = grupoDef.schema_mediciones.columnas;

  return (
    <div className="space-y-6">
      {/* Nav */}
      <Link
        href={`/dashboard/visitas/${id}/pruebas`}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a pruebas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              {grupoDef.codigo}
            </span>
            {saveStatus === "saving" && (
              <Badge className="bg-amber-100 text-amber-600 border-amber-200 rounded-full text-[9px] font-black">
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Guardando
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge className="bg-emerald-100 text-emerald-600 border-emerald-200 rounded-full text-[9px] font-black">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Guardado
              </Badge>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">
            {grupoDef.nombre}
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {pruebaDefs?.length ?? 0} pruebas en este grupo
          </p>
        </div>
      </div>

      {/* ═══ TABLA DE MEDICIONES ═══ */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <h3 className="text-base font-black text-slate-800 tracking-tight mb-4">
            Datos de medición
          </h3>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider w-8">
                    #
                  </th>
                  {columnas.map((col) => (
                    <th
                      key={col.key}
                      className="text-left py-2 px-1 text-[10px] font-black text-slate-400 uppercase tracking-wider"
                    >
                      {col.label}
                      {col.unit && (
                        <span className="text-slate-300 font-medium ml-0.5">
                          ({col.unit})
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {mediciones.map((row, rowIdx) => (
                  <tr
                    key={(row._id as string) ?? rowIdx}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="py-1.5 px-1 text-xs font-bold text-slate-400">
                      {rowIdx + 1}
                    </td>
                    {columnas.map((col) => (
                      <td key={col.key} className="py-1.5 px-1">
                        {col.type === "select" ? (
                          <select
                            className="w-full rounded-lg border border-slate-200 text-xs py-1.5 px-2 font-medium focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                            value={(row[col.key] as string) ?? ""}
                            onChange={(e) =>
                              updateCell(rowIdx, col.key, e.target.value)
                            }
                          >
                            <option value="">—</option>
                            {col.opciones?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={col.type === "number" ? "number" : "text"}
                            step={
                              col.type === "number" && col.decimal_places
                                ? Math.pow(10, -col.decimal_places).toString()
                                : undefined
                            }
                            className="rounded-lg border-slate-200 text-xs h-8 font-medium"
                            placeholder={col.placeholder ?? ""}
                            value={
                              row[col.key] != null
                                ? String(row[col.key])
                                : ""
                            }
                            onChange={(e) =>
                              updateCell(rowIdx, col.key, e.target.value)
                            }
                          />
                        )}
                      </td>
                    ))}
                    <td className="py-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIdx)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
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
            type="button"
            variant="outline"
            onClick={addRow}
            className="mt-3 rounded-xl border-dashed border-2 border-slate-200 hover:border-primary/40 hover:bg-primary/5 font-bold text-sm text-slate-500 h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Agregar fila
          </Button>
        </CardContent>
      </Card>

      {/* ═══ IMÁGENES ═══ */}
      {grupoDef.slots_imagen.length > 0 && (
        <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
            <h3 className="text-base font-black text-slate-800 tracking-tight">
              Evidencias gráficas
            </h3>
            {grupoDef.slots_imagen.map((slot) => (
              <ImageCaptureSlot
                key={slot.key}
                slot={slot}
                imagenes={imagenes}
                onCapture={handleCapture}
                onDelete={handleDeleteImage}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ RESULTADOS CALCULADOS POR PRUEBA ═══ */}
      {pruebaDefs && pruebaDefs.length > 0 && (
        <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6 space-y-3">
            <h3 className="text-base font-black text-slate-800 tracking-tight">
              Evaluación por prueba
            </h3>

            {pruebaDefs.map((def) => {
              const calc = calculatedResults.get(def.id!);
              const isExpanded = expandedTests.has(def.id!);
              const hasCriteria = (def.criterios_aceptacion?.length ?? 0) > 0;
              const allPass = calc?.evaluaciones?.every((e) => e.cumple) ?? true;

              return (
                <div
                  key={def.id}
                  className="border border-slate-100 rounded-xl overflow-hidden"
                >
                  {/* Test header */}
                  <button
                    type="button"
                    onClick={() => toggleTest(def.id!)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest flex-shrink-0">
                        {def.numero_tecdoc}
                      </span>
                      <span className="font-bold text-slate-800 text-sm truncate">
                        {def.nombre}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasCriteria && calc && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            allPass
                              ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                              : "bg-red-100 text-red-600 border border-red-200"
                          }`}
                        >
                          {allPass ? "FAVORABLE" : "NO FAVORABLE"}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Test detail */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-slate-100 pt-3">
                      {/* Calculated values */}
                      {calc &&
                        Object.entries(calc.resultados).map(([key, val]) => {
                          const formula = def.formulas?.find(
                            (f) => f.campo_resultado === key
                          );
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-slate-500 font-medium">
                                {formula?.label ?? key}
                              </span>
                              <span className="font-black text-slate-900">
                                {val != null ? val.toFixed(2) : "—"}
                                {formula?.unit && (
                                  <span className="text-slate-400 font-medium ml-1 text-xs">
                                    {formula.unit}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}

                      {/* Criteria evaluation */}
                      {calc?.evaluaciones && calc.evaluaciones.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Criterios
                          </p>
                          {calc.evaluaciones.map((ev, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs"
                            >
                              {ev.cumple ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              )}
                              <span className="text-slate-600 font-medium">
                                {ev.criterio_descripcion}
                              </span>
                              <span className="ml-auto font-bold text-slate-800">
                                {ev.valor_obtenido.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ═══ BOTÓN GUARDAR / COMPLETAR ═══ */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={saveTestResults}
          className="rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6"
          disabled={saveStatus === "saving" || mediciones.length === 0}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          Completar grupo
        </Button>
      </div>
    </div>
  );
}
