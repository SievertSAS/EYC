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
  onSaved?: () => void;
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
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setNombre(ubicacion?.nombre_servicio ?? "");
    setLicencia(ubicacion?.licencia ?? "");
    setFechaExp(ubicacion?.fecha_expiracion_licencia ?? "");
    setCodigo(ubicacion?.codigo_habilitacion ?? "");
    setHoras(ubicacion?.horas_x_dia?.toString() ?? "");
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
      onSaved?.();

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
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            {isEdit ? "Editar Ubicación" : "Nueva Ubicación RX"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Servicio o sala de rayos X dentro de la sede.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
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
