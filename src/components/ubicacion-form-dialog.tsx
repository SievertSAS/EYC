"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { UbicacionRx } from "@/lib/db/types";
import { pushSingle } from "@/lib/supabase/sync-engine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// ============================================================
//  Dialog para crear / editar una ubicación RX dentro de sede
// ============================================================

interface UbicacionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sedeId: number;
  ubicacion?: UbicacionRx;
  onSaved?: (id: number) => void;
}

export function UbicacionFormDialog({
  open,
  onOpenChange,
  sedeId,
  ubicacion,
  onSaved,
}: UbicacionFormDialogProps) {
  const isEdit = !!ubicacion;

  const [nombre, setNombre] = useState(ubicacion?.nombre_servicio ?? "");
  const [licencia, setLicencia] = useState(ubicacion?.licencia ?? "");
  const [fechaExp, setFechaExp] = useState(ubicacion?.fecha_expiracion_licencia ?? "");
  const [codigo, setCodigo] = useState(ubicacion?.codigo_habilitacion ?? "");
  const [horas, setHoras] = useState(ubicacion?.horas_x_dia?.toString() ?? "");
  // Sala y blindaje
  const [ubicFisica, setUbicFisica] = useState(ubicacion?.ubicacion_fisica ?? "");
  const [ancho, setAncho] = useState(ubicacion?.ancho_m?.toString() ?? "");
  const [largo, setLargo] = useState(ubicacion?.largo_m?.toString() ?? "");
  const [alto, setAlto] = useState(ubicacion?.alto_m?.toString() ?? "");
  const [zonaA, setZonaA] = useState(ubicacion?.zona_a_desc ?? "");
  const [zonaB, setZonaB] = useState(ubicacion?.zona_b_desc ?? "");
  const [zonaC, setZonaC] = useState(ubicacion?.zona_c_desc ?? "");
  const [zonaD, setZonaD] = useState(ubicacion?.zona_d_desc ?? "");
  const [saving, setSaving] = useState(false);

  // Área = ancho × largo (autocalculada)
  const areaCalc =
    ancho && largo ? Math.round(parseFloat(ancho) * parseFloat(largo) * 100) / 100 : undefined;

  function resetForm() {
    setNombre(ubicacion?.nombre_servicio ?? "");
    setLicencia(ubicacion?.licencia ?? "");
    setFechaExp(ubicacion?.fecha_expiracion_licencia ?? "");
    setCodigo(ubicacion?.codigo_habilitacion ?? "");
    setHoras(ubicacion?.horas_x_dia?.toString() ?? "");
    setUbicFisica(ubicacion?.ubicacion_fisica ?? "");
    setAncho(ubicacion?.ancho_m?.toString() ?? "");
    setLargo(ubicacion?.largo_m?.toString() ?? "");
    setAlto(ubicacion?.alto_m?.toString() ?? "");
    setZonaA(ubicacion?.zona_a_desc ?? "");
    setZonaB(ubicacion?.zona_b_desc ?? "");
    setZonaC(ubicacion?.zona_c_desc ?? "");
    setZonaD(ubicacion?.zona_d_desc ?? "");
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data: Omit<UbicacionRx, "id"> = {
        sede_id: sedeId,
        nombre_servicio: nombre.trim(),
        licencia: licencia || undefined,
        fecha_expiracion_licencia: fechaExp || undefined,
        codigo_habilitacion: codigo || undefined,
        horas_x_dia: horas ? parseInt(horas, 10) : undefined,
        ubicacion_fisica: ubicFisica || undefined,
        ancho_m: ancho ? parseFloat(ancho) : undefined,
        largo_m: largo ? parseFloat(largo) : undefined,
        alto_m: alto ? parseFloat(alto) : undefined,
        area_m2: areaCalc,
        zona_a_desc: zonaA || undefined,
        zona_b_desc: zonaB || undefined,
        zona_c_desc: zonaC || undefined,
        zona_d_desc: zonaD || undefined,
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };

      let savedId: number;
      if (isEdit && ubicacion?.id) {
        await db.ubicaciones_rx.update(ubicacion.id, data);
        savedId = ubicacion.id;
      } else {
        savedId = (await db.ubicaciones_rx.add(data as UbicacionRx)) as number;
      }

      resetForm();
      onOpenChange(false);
      onSaved?.(savedId);

      pushSingle("ubicaciones_rx", savedId);
    } catch (err) {
      console.error("[UbicacionForm] Error:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            {isEdit ? "Editar Ubicación" : "Nueva Ubicación RX"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Servicio o sala de rayos X dentro de la sede.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Nombre del Servicio *
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Ej: Rayos X Convencional - Sala 1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Licencia
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="No. de licencia"
                value={licencia}
                onChange={(e) => setLicencia(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Vencimiento Licencia
              </Label>
              <Input
                type="date"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={fechaExp}
                onChange={(e) => setFechaExp(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Código Habilitación
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="Código REPS"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Horas/Día
              </Label>
              <Input
                type="number"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="8"
                min="1"
                max="24"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
              />
            </div>
          </div>

          {/* ─── Sala y blindaje ─── */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">
              Sala y blindaje
            </p>
            <p className="text-[11px] text-slate-400 font-medium mb-3">
              Dimensiones del recinto y colindancias — se usan en la prueba 2.2 del informe.
            </p>

            <div className="space-y-2 mb-3">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Ubicación física del equipo
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="Ej: primer piso de las instalaciones"
                value={ubicFisica}
                onChange={(e) => setUbicFisica(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Ancho (m)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="3.40"
                  value={ancho}
                  onChange={(e) => setAncho(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Largo (m)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="6.10"
                  value={largo}
                  onChange={(e) => setLargo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Alto (m)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="2.30"
                  value={alto}
                  onChange={(e) => setAlto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Área (m²)
                </Label>
                <div className="rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 h-11 flex items-center px-3">
                  {areaCalc != null ? areaCalc.toFixed(2) : "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["A", zonaA, setZonaA],
                  ["B", zonaB, setZonaB],
                  ["C", zonaC, setZonaC],
                  ["D", zonaD, setZonaD],
                ] as const
              ).map(([z, val, setter]) => (
                <div key={z} className="space-y-2">
                  <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    Zona {z}
                  </Label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Limita con… / puertas / barreras"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex justify-end gap-3 border-none bg-transparent">
          <Button
            variant="ghost"
            className="rounded-xl font-black"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white"
            disabled={saving || !nombre.trim()}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar"
            ) : (
              "Agregar Ubicación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
