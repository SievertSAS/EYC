"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Sede } from "@/lib/db/types";
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
//  Dialog para crear / editar una sede
// ============================================================

interface SedeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  sede?: Sede;
  onSaved?: (id: number) => void;
}

export function SedeFormDialog({
  open,
  onOpenChange,
  clienteId,
  sede,
  onSaved,
}: SedeFormDialogProps) {
  const isEdit = !!sede;

  const [nombre, setNombre] = useState(sede?.nombre_sede ?? "");
  const [direccion, setDireccion] = useState(sede?.direccion_sede ?? "");
  const [ciudad, setCiudad] = useState(sede?.ciudad ?? "");
  const [departamento, setDepartamento] = useState(sede?.departamento ?? "");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setNombre(sede?.nombre_sede ?? "");
    setDireccion(sede?.direccion_sede ?? "");
    setCiudad(sede?.ciudad ?? "");
    setDepartamento(sede?.departamento ?? "");
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data: Omit<Sede, "id"> = {
        cliente_id: clienteId,
        nombre_sede: nombre.trim(),
        direccion_sede: direccion || undefined,
        ciudad: ciudad || undefined,
        departamento: departamento || undefined,
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };

      let savedId: number;
      if (isEdit && sede?.id) {
        await db.sedes.update(sede.id, data);
        savedId = sede.id;
      } else {
        savedId = (await db.sedes.add(data as Sede)) as number;
      }

      resetForm();
      onOpenChange(false);
      onSaved?.(savedId);

      pushSingle("sedes", savedId);
    } catch (err) {
      console.error("[SedeForm] Error:", err);
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
            {isEdit ? "Editar Sede" : "Nueva Sede"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Información de la sede del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Nombre de la Sede *
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Ej: Sede Principal, Urgencias..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Dirección
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Dirección de la sede"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Ciudad
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="Ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Departamento
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="Departamento"
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
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
              "Agregar Sede"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
