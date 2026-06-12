"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Solicitud } from "@/lib/db/types";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { updateWithTracking } from "@/lib/workflow/change-tracker";
import { ClienteFormDialog } from "@/components/cliente-form-dialog";
import { SedeFormDialog } from "@/components/sede-form-dialog";
import { UbicacionFormDialog } from "@/components/ubicacion-form-dialog";
import { ContactoFormDialog } from "@/components/contacto-form-dialog";

// ============================================================
//  Dialog para crear una solicitud — flujo guiado paso a paso
//  1. Cliente → 2. Sede → 3. Ubicación → 4. Contacto
//  Cliente, sede, ubicación y contacto pueden crearse inline
//  con los botones "+ Nuevo" si no existen aún.
//  Técnico y fecha de visita se asignan al programar la visita.
// ============================================================

interface SolicitudFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: number) => void;
  /** Si se pasa, el dialog entra en modo edición */
  editSolicitud?: Solicitud;
}

export function SolicitudFormDialog({
  open,
  onOpenChange,
  onSaved,
  editSolicitud,
}: SolicitudFormDialogProps) {
  const isEditing = !!editSolicitud;
  const { isReady } = useDb();
  const { role } = useRole();

  // Step state
  const [clienteId, setClienteId] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [contactoId, setContactoId] = useState("");

  const [saving, setSaving] = useState(false);

  // Dialogs para crear entidades auxiliares inline
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [sedeDialogOpen, setSedeDialogOpen] = useState(false);
  const [ubicacionDialogOpen, setUbicacionDialogOpen] = useState(false);
  const [contactoDialogOpen, setContactoDialogOpen] = useState(false);

  // Reset cascading selects al cambiar el padre
  function selectCliente(id: string) {
    setClienteId(id);
    setSedeId("");
    setUbicacionId("");
    setContactoId("");
  }

  function selectSede(id: string) {
    setSedeId(id);
    setUbicacionId("");
  }

  // Data queries
  const clientes = useLiveQuery(() => (isReady ? db.clientes.toArray() : []), [isReady], []);

  const sedes = useLiveQuery(
    () =>
      isReady && clienteId
        ? db.sedes.where("cliente_id").equals(parseInt(clienteId, 10)).toArray()
        : [],
    [isReady, clienteId],
    []
  );

  const ubicaciones = useLiveQuery(
    () =>
      isReady && sedeId
        ? db.ubicaciones_rx.where("sede_id").equals(parseInt(sedeId, 10)).toArray()
        : [],
    [isReady, sedeId],
    []
  );

  const contactos = useLiveQuery(
    () =>
      isReady && clienteId
        ? db.contactos
            .where("cliente_id")
            .equals(parseInt(clienteId, 10))
            .filter((c) => c.para_programar)
            .toArray()
        : [],
    [isReady, clienteId],
    []
  );

  // Populate form from editSolicitud when dialog opens in edit mode
  useEffect(() => {
    if (!open || !editSolicitud) return;
    void (async () => {
      const ubicacion = editSolicitud.ubicacion_id
        ? await db.ubicaciones_rx.get(editSolicitud.ubicacion_id)
        : undefined;

      setClienteId(editSolicitud.cliente_id ? String(editSolicitud.cliente_id) : "");
      setSedeId(ubicacion?.sede_id ? String(ubicacion.sede_id) : "");
      setUbicacionId(
        ubicacion?.sede_id && editSolicitud.ubicacion_id ? String(editSolicitud.ubicacion_id) : ""
      );
      setContactoId(
        editSolicitud.contacto_programar_id ? String(editSolicitud.contacto_programar_id) : ""
      );
    })();
  }, [open, editSolicitud]);

  function resetForm() {
    setClienteId("");
    setSedeId("");
    setUbicacionId("");
    setContactoId("");
  }

  async function handleSave() {
    if (!clienteId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (isEditing && editSolicitud?.id) {
        // Modo edición — actualizar con tracking de cambios
        const changes: Partial<Solicitud> = {
          cliente_id: parseInt(clienteId, 10),
          contacto_programar_id: contactoId ? parseInt(contactoId, 10) : undefined,
          ubicacion_id: ubicacionId ? parseInt(ubicacionId, 10) : undefined,
          sync_status: "pending",
          last_modified: now,
        };
        await updateWithTracking(
          "solicitudes",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          db.solicitudes as any,
          editSolicitud.id,
          changes as Record<string, unknown>,
          role?.usuarioId ?? 0
        );
        resetForm();
        onOpenChange(false);
        onSaved?.(editSolicitud.id);

        pushSingle("solicitudes", editSolicitud.id);
      } else {
        // Modo creación
        const data: Omit<Solicitud, "id"> = {
          cliente_id: parseInt(clienteId, 10),
          contacto_programar_id: contactoId ? parseInt(contactoId, 10) : undefined,
          ubicacion_id: ubicacionId ? parseInt(ubicacionId, 10) : undefined,
          pipeline_estado: "solicitudes",
          pago_recibido: false,
          fecha_solicitud: now.split("T")[0],
          creado_en: now,
          sync_status: "pending",
          last_modified: now,
        };

        const id = (await db.solicitudes.add(data as Solicitud)) as number;
        resetForm();
        onOpenChange(false);
        onSaved?.(id);

        pushSingle("solicitudes", id);
      }
    } catch (err) {
      console.error("[SolicitudForm] Error:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next && !isEditing) resetForm();
    onOpenChange(next);
  }

  const labelClass = "text-xs font-black text-slate-600 uppercase tracking-wider";
  const addButtonClass = "h-7 rounded-lg text-primary font-black text-xs hover:bg-primary/5";
  const selectTriggerClass =
    "w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
              {isEditing ? "Editar Solicitud" : "Nueva Solicitud"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-sm">
              {isEditing
                ? "Modifica los campos necesarios y guarda los cambios."
                : "Selecciona cliente, sede, ubicación y contacto, o créalos aquí mismo si no existen."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* 1. Cliente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className={labelClass}>Cliente *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className={addButtonClass}
                  onClick={() => setClienteDialogOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nuevo
                </Button>
              </div>
              <Select value={clienteId} onValueChange={(v) => selectCliente(v ?? "")}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nombre_cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Sede (filtrada por cliente) */}
            {clienteId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelClass}>Sede</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={addButtonClass}
                    onClick={() => setSedeDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nueva
                  </Button>
                </div>
                <Select value={sedeId} onValueChange={(v) => selectSede(v ?? "")}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Seleccionar sede..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nombre_sede}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 3. Ubicación (filtrada por sede) */}
            {sedeId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelClass}>Ubicación RX</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={addButtonClass}
                    onClick={() => setUbicacionDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nueva
                  </Button>
                </div>
                <Select value={ubicacionId} onValueChange={(v) => setUbicacionId(v ?? "")}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Seleccionar ubicación..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ubicaciones.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nombre_servicio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 4. Contacto para programar */}
            {clienteId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelClass}>Contacto para Programar</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={addButtonClass}
                    onClick={() => setContactoDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nuevo
                  </Button>
                </div>
                <Select value={contactoId} onValueChange={(v) => setContactoId(v ?? "")}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Seleccionar contacto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contactos.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                        {c.telefono ? ` — ${c.telefono}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              disabled={saving || !clienteId}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creando...
                </>
              ) : isEditing ? (
                "Guardar Cambios"
              ) : (
                "Crear Solicitud"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs de creación inline (se apilan sobre el dialog principal) */}
      <ClienteFormDialog
        open={clienteDialogOpen}
        onOpenChange={setClienteDialogOpen}
        onSaved={(id) => selectCliente(String(id))}
      />
      {clienteId && (
        <SedeFormDialog
          open={sedeDialogOpen}
          onOpenChange={setSedeDialogOpen}
          clienteId={parseInt(clienteId, 10)}
          onSaved={(id) => selectSede(String(id))}
        />
      )}
      {sedeId && (
        <UbicacionFormDialog
          open={ubicacionDialogOpen}
          onOpenChange={setUbicacionDialogOpen}
          sedeId={parseInt(sedeId, 10)}
          onSaved={(id) => setUbicacionId(String(id))}
        />
      )}
      {clienteId && (
        <ContactoFormDialog
          open={contactoDialogOpen}
          onOpenChange={setContactoDialogOpen}
          clienteId={parseInt(clienteId, 10)}
          defaultParaProgramar
          onSaved={(id) => setContactoId(String(id))}
        />
      )}
    </>
  );
}
