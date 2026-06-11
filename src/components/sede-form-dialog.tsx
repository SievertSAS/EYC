"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// ============================================================
//  Dialog para crear / editar una sede
//
//  Departamento y municipio se eligen del catálogo DIVIPOLA
//  (tablas departamentos/municipios sincronizadas desde Supabase).
//  Se guardan los ids normalizados + los nombres denormalizados
//  en ciudad/departamento para informes y listados.
// ============================================================

interface SedeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  sede?: Sede;
  onSaved?: (id: number) => void;
}

const labelClass = "text-xs font-black text-slate-600 uppercase tracking-wider";
const inputClass = "rounded-xl border-slate-200 focus:border-primary font-medium h-11";

/** Busca el id de un departamento/municipio por nombre (sedes antiguas con texto plano) */
function matchIdPorNombre(items: { id: number; nombre: string }[], nombre?: string): string {
  if (!nombre) return "";
  const target = nombre.trim().toLowerCase();
  const match = items.find((item) => item.nombre.toLowerCase() === target);
  return match ? String(match.id) : "";
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
  const [email, setEmail] = useState(sede?.email ?? "");
  const [telefono, setTelefono] = useState(sede?.telefono ?? "");
  // null = sin tocar por el usuario → se deriva de la sede (id directo
  // o match por nombre para sedes antiguas que solo tienen texto)
  const [departamentoIdState, setDepartamentoIdState] = useState<string | null>(null);
  const [municipioIdState, setMunicipioIdState] = useState<string | null>(null);
  // Fallback de texto libre cuando el catálogo aún no se ha sincronizado
  const [ciudadTexto, setCiudadTexto] = useState(sede?.ciudad ?? "");
  const [departamentoTexto, setDepartamentoTexto] = useState(sede?.departamento ?? "");
  const [saving, setSaving] = useState(false);

  const departamentos =
    useLiveQuery(
      async () =>
        (await db.departamentos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      []
    ) ?? [];

  const departamentoId =
    departamentoIdState ??
    (sede?.departamento_id
      ? String(sede.departamento_id)
      : matchIdPorNombre(departamentos, sede?.departamento));

  const municipios =
    useLiveQuery(
      async () =>
        departamentoId
          ? (
              await db.municipios
                .where("departamento_id")
                .equals(parseInt(departamentoId, 10))
                .toArray()
            ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
          : [],
      [departamentoId]
    ) ?? [];

  const municipioId =
    municipioIdState ??
    (sede?.municipio_id ? String(sede.municipio_id) : matchIdPorNombre(municipios, sede?.ciudad));

  const catalogoListo = departamentos.length > 0;

  function resetForm() {
    setNombre(sede?.nombre_sede ?? "");
    setDireccion(sede?.direccion_sede ?? "");
    setEmail(sede?.email ?? "");
    setTelefono(sede?.telefono ?? "");
    setDepartamentoIdState(null);
    setMunicipioIdState(null);
    setCiudadTexto(sede?.ciudad ?? "");
    setDepartamentoTexto(sede?.departamento ?? "");
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const departamentoSel = departamentos.find((d) => String(d.id) === departamentoId);
      const municipioSel = municipios.find((m) => String(m.id) === municipioId);

      const now = new Date().toISOString();
      const data: Omit<Sede, "id"> = {
        cliente_id: clienteId,
        nombre_sede: nombre.trim(),
        direccion_sede: direccion || undefined,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        departamento_id: departamentoSel?.id,
        municipio_id: municipioSel?.id,
        // Nombres denormalizados para informes/listados
        ciudad: municipioSel?.nombre ?? (ciudadTexto.trim() || undefined),
        departamento: departamentoSel?.nombre ?? (departamentoTexto.trim() || undefined),
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
            <Label className={labelClass}>Nombre de la Sede *</Label>
            <Input
              className={inputClass}
              placeholder="Ej: Sede Principal, Urgencias..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Dirección</Label>
            <Input
              className={inputClass}
              placeholder="Dirección de la sede"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          {catalogoListo ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={labelClass}>Departamento</Label>
                <Select
                  value={departamentoId}
                  onValueChange={(v) => {
                    setDepartamentoIdState(v ?? "");
                    setMunicipioIdState("");
                  }}
                >
                  <SelectTrigger className={`${inputClass} w-full`}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Municipio</Label>
                <Select
                  value={municipioId}
                  onValueChange={(v) => setMunicipioIdState(v ?? "")}
                  disabled={!departamentoId}
                >
                  <SelectTrigger className={`${inputClass} w-full`}>
                    <SelectValue
                      placeholder={departamentoId ? "Seleccionar..." : "Elige departamento"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            // Catálogo aún no sincronizado — permitir texto libre
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={labelClass}>Departamento</Label>
                <Input
                  className={inputClass}
                  placeholder="Departamento"
                  value={departamentoTexto}
                  onChange={(e) => setDepartamentoTexto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Municipio</Label>
                <Input
                  className={inputClass}
                  placeholder="Municipio"
                  value={ciudadTexto}
                  onChange={(e) => setCiudadTexto(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={labelClass}>Teléfono</Label>
              <Input
                className={inputClass}
                type="tel"
                placeholder="Teléfono de contacto"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Email</Label>
              <Input
                className={inputClass}
                type="email"
                placeholder="correo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
