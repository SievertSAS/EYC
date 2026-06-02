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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronRight } from "lucide-react";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { updateWithTracking } from "@/lib/workflow/change-tracker";

// ============================================================
//  Dialog para crear una solicitud — flujo guiado paso a paso
//  1. Cliente → 2. Sede → 3. Ubicación → 4. Contacto
//  5. Técnico → 6. Detalles
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
  const [tecnicoId, setTecnicoId] = useState("");
  const [tipoServicio, setTipoServicio] = useState("CONTROL_CALIDAD");
  const [fechaSolicitud, setFechaSolicitud] = useState(new Date().toISOString().split("T")[0]);
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [pagoRecibido, setPagoRecibido] = useState(false);

  const [saving, setSaving] = useState(false);

  // Reset cascading selects
  useEffect(() => {
    setSedeId("");
    setUbicacionId("");
    setContactoId("");
  }, [clienteId]);

  useEffect(() => {
    setUbicacionId("");
  }, [sedeId]);

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

  const tecnicos = useLiveQuery(
    () => (isReady ? db.usuarios.filter((t) => t.activo && t.cargo === "tecnico").toArray() : []),
    [isReady],
    []
  );

  // Populate form from editSolicitud when dialog opens in edit mode
  useEffect(() => {
    if (!open || !editSolicitud) return;
    setClienteId(editSolicitud.cliente_id ? String(editSolicitud.cliente_id) : "");
    setContactoId(
      editSolicitud.contacto_programar_id ? String(editSolicitud.contacto_programar_id) : ""
    );
    setTecnicoId(
      editSolicitud.tecnico_asignado_id ? String(editSolicitud.tecnico_asignado_id) : ""
    );
    setTipoServicio(editSolicitud.tipo_servicio ?? "CONTROL_CALIDAD");
    setFechaSolicitud(editSolicitud.fecha_solicitud ?? new Date().toISOString().split("T")[0]);
    setFechaEstimada(editSolicitud.fecha_estimada_visita ?? "");
    setFormaPago(editSolicitud.forma_pago ?? "");
    setPagoRecibido(editSolicitud.pago_recibido ?? false);

    // Load sede/ubicacion from the existing solicitud
    if (editSolicitud.ubicacion_id) {
      db.ubicaciones_rx.get(editSolicitud.ubicacion_id).then((ub) => {
        if (ub?.sede_id) {
          setSedeId(String(ub.sede_id));
          setUbicacionId(String(editSolicitud.ubicacion_id));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editSolicitud]);

  function resetForm() {
    setClienteId("");
    setSedeId("");
    setUbicacionId("");
    setContactoId("");
    setTecnicoId("");
    setTipoServicio("CONTROL_CALIDAD");
    setFechaSolicitud(new Date().toISOString().split("T")[0]);
    setFechaEstimada("");
    setFormaPago("");
    setPagoRecibido(false);
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
          tecnico_asignado_id: tecnicoId ? parseInt(tecnicoId, 10) : undefined,
          tipo_servicio: tipoServicio || undefined,
          forma_pago: formaPago || undefined,
          pago_recibido: pagoRecibido,
          fecha_solicitud: fechaSolicitud || undefined,
          fecha_estimada_visita: fechaEstimada || undefined,
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
          tecnico_asignado_id: tecnicoId ? parseInt(tecnicoId, 10) : undefined,
          tipo_servicio: tipoServicio || undefined,
          pipeline_estado: "solicitudes",
          forma_pago: formaPago || undefined,
          pago_recibido: pagoRecibido,
          fecha_solicitud: fechaSolicitud || undefined,
          fecha_estimada_visita: fechaEstimada || undefined,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            {isEditing ? "Editar Solicitud" : "Nueva Solicitud"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            {isEditing
              ? "Modifica los campos necesarios y guarda los cambios."
              : "Selecciona cliente, ubicación y técnico para crear la solicitud."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 1. Cliente */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Cliente *
            </Label>
            <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "")}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
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
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Sede
              </Label>
              <Select value={sedeId} onValueChange={(v) => setSedeId(v ?? "")}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
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
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Ubicación RX
              </Label>
              <Select value={ubicacionId} onValueChange={(v) => setUbicacionId(v ?? "")}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
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
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Contacto para Programar
              </Label>
              <Select value={contactoId} onValueChange={(v) => setContactoId(v ?? "")}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
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

          {/* 5. Técnico */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Técnico Asignado
            </Label>
            <Select value={tecnicoId} onValueChange={(v) => setTecnicoId(v ?? "")}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
                <SelectValue placeholder="Seleccionar técnico..." />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 6. Detalles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Tipo de Servicio
              </Label>
              <Select
                value={tipoServicio}
                onValueChange={(v) => setTipoServicio(v ?? "CONTROL_CALIDAD")}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTROL_CALIDAD">Control de Calidad</SelectItem>
                  <SelectItem value="LEVANTAMIENTO">Levantamiento</SelectItem>
                  <SelectItem value="ASESORIA">Asesoría</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Forma de Pago
              </Label>
              <Input
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="Ej: Transferencia"
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Fecha Solicitud
              </Label>
              <Input
                type="date"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={fechaSolicitud}
                onChange={(e) => setFechaSolicitud(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Fecha Estimada Visita
              </Label>
              <Input
                type="date"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                value={fechaEstimada}
                onChange={(e) => setFechaEstimada(e.target.value)}
              />
            </div>
          </div>

          {/* Pago recibido */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={pagoRecibido}
              onChange={(e) => setPagoRecibido(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-bold text-slate-700">Pago recibido</span>
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
  );
}
