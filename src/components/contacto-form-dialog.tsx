"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Contacto } from "@/lib/db/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// ============================================================
//  Dialog para crear / editar un contacto de cliente
// ============================================================

interface ContactoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  contacto?: Contacto;
  onSaved?: (id: number) => void;
  /** Valor inicial del checkbox "para programar" al crear */
  defaultParaProgramar?: boolean;
}

const CARGO_OPTIONS = [
  { value: "medico_responsable", label: "Médico Responsable" },
  { value: "tecnologo", label: "Tecnólogo" },
  { value: "opr", label: "OPR" },
  { value: "representante", label: "Representante" },
  { value: "otro", label: "Otro" },
];

export function ContactoFormDialog({
  open,
  onOpenChange,
  clienteId,
  contacto,
  onSaved,
  defaultParaProgramar = false,
}: ContactoFormDialogProps) {
  const isEdit = !!contacto;

  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [cedula, setCedula] = useState(contacto?.cedula ?? "");
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [paraProgramar, setParaProgramar] = useState(
    contacto?.para_programar ?? defaultParaProgramar
  );
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setNombre(contacto?.nombre ?? "");
    setCargo(contacto?.cargo ?? "");
    setCedula(contacto?.cedula ?? "");
    setTelefono(contacto?.telefono ?? "");
    setEmail(contacto?.email ?? "");
    setParaProgramar(contacto?.para_programar ?? defaultParaProgramar);
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data: Omit<Contacto, "id"> = {
        cliente_id: clienteId,
        nombre: nombre.trim(),
        cargo: cargo as Contacto["cargo"],
        cedula: cedula || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        para_programar: paraProgramar,
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };

      let savedId: number;
      if (isEdit && contacto?.id) {
        await db.contactos.update(contacto.id, data);
        savedId = contacto.id;
      } else {
        savedId = (await db.contactos.add(data as Contacto)) as number;
      }

      resetForm();
      onOpenChange(false);
      onSaved?.(savedId);

      pushSingle("contactos", savedId);
    } catch (err) {
      console.error("[ContactoForm] Error:", err);
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
            {isEdit ? "Editar Contacto" : "Nuevo Contacto"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Información del contacto asociado al cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Nombre *
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Cargo
            </Label>
            <Select value={cargo} onValueChange={(v) => setCargo(v ?? "")}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
                <SelectValue placeholder="Seleccionar cargo..." />
              </SelectTrigger>
              <SelectContent>
                {CARGO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Cédula
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Número de cédula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Teléfono
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="300 000 0000"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Email
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="email@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Checkbox para programar */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={paraProgramar}
              onChange={(e) => setParaProgramar(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-700">Contacto para programar</p>
              <p className="text-[11px] text-slate-400">
                Este contacto se mostrará al crear solicitudes
              </p>
            </div>
          </label>
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
              "Agregar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
