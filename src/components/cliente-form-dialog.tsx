"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Cliente } from "@/lib/db/types";
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
//  Dialog para crear / editar un cliente
//  Todos los campos opcionales excepto nombre_cliente
// ============================================================

interface ClienteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, modo edición */
  cliente?: Cliente;
  onSaved?: (id: number) => void;
}

const EMPTY: Partial<Cliente> = {
  nombre_cliente: "",
  nombre_prestador: "",
  nit: "",
  digito_verificacion: "",
  naturaleza: undefined,
  direccion: "",
  telefono: "",
  email: "",
  nombre_representante_legal: "",
};

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: ClienteFormDialogProps) {
  const isEdit = !!cliente;
  const [form, setForm] = useState<Partial<Cliente>>(cliente ? { ...cliente } : { ...EMPTY });
  const [saving, setSaving] = useState(false);

  function update(field: keyof Cliente, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.nombre_cliente?.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let savedId: number;
      if (isEdit && cliente?.id) {
        await db.clientes.update(cliente.id, {
          ...form,
          nombre_cliente: form.nombre_cliente!.trim(),
          sync_status: "pending",
          last_modified: now,
        });
        savedId = cliente.id;
      } else {
        savedId = (await db.clientes.add({
          ...form,
          nombre_cliente: form.nombre_cliente!.trim(),
          creado_en: now,
          sync_status: "pending",
          last_modified: now,
        } as Cliente)) as number;
      }
      onSaved?.(savedId);
      setForm({ ...EMPTY });
      onOpenChange(false);

      // Push inmediato a Supabase (no bloquea la UI)
      pushSingle("clientes", savedId);
    } catch (err) {
      console.error("[ClienteForm] Error al guardar:", err);
    } finally {
      setSaving(false);
    }
  }

  // Reset form when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(cliente ? { ...cliente } : { ...EMPTY });
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
        {/* Header con gradiente */}
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            {isEdit ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            {isEdit
              ? "Actualiza la información del cliente."
              : "Ingresa los datos básicos del cliente. Solo el nombre es obligatorio."}
          </DialogDescription>
        </DialogHeader>

        {/* Campos */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Nombre cliente (requerido) */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Nombre del Cliente *
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Nombre de la institución o persona"
              value={form.nombre_cliente ?? ""}
              onChange={(e) => update("nombre_cliente", e.target.value)}
            />
          </div>

          {/* Nombre prestador */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Nombre Prestador
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Nombre del prestador de servicios"
              value={form.nombre_prestador ?? ""}
              onChange={(e) => update("nombre_prestador", e.target.value)}
            />
          </div>

          {/* NIT + Dígito */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                NIT
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="000000000"
                value={form.nit ?? ""}
                onChange={(e) => update("nit", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                DV
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="0"
                maxLength={1}
                value={form.digito_verificacion ?? ""}
                onChange={(e) => update("digito_verificacion", e.target.value)}
              />
            </div>
          </div>

          {/* Naturaleza */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Naturaleza
            </Label>
            <Select
              value={form.naturaleza ?? ""}
              onValueChange={(val) => update("naturaleza", (val ?? "") as string)}
            >
              <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="privado">Privado</SelectItem>
                <SelectItem value="publico">Público</SelectItem>
                <SelectItem value="mixto">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dirección */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Dirección
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Dirección principal"
              value={form.direccion ?? ""}
              onChange={(e) => update("direccion", e.target.value)}
            />
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Teléfono
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="300 000 0000"
                value={form.telefono ?? ""}
                onChange={(e) => update("telefono", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Email
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="email@ejemplo.com"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
          </div>

          {/* Representante legal */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Representante Legal
            </Label>
            <Input
              className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
              placeholder="Nombre completo"
              value={form.nombre_representante_legal ?? ""}
              onChange={(e) => update("nombre_representante_legal", e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
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
            disabled={saving || !form.nombre_cliente?.trim()}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear Cliente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
