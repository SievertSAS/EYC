"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
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
import { pushSingle } from "@/lib/supabase/sync-engine";
import {
  ArrowLeft,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  Radio,
  CheckCircle2,
  ExternalLink,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { crearVisitaDesdeSolicitud } from "@/lib/workflow/visita-service";
import { SolicitudFormDialog } from "@/components/solicitud-form-dialog";

// ============================================================
//  Detalle de solicitud + botón "Programar Visita"
// ============================================================

const ESTADO_LABEL: Record<string, string> = {
  solicitudes: "Por programar",
  programacion: "Programación",
  ejecucion: "Ejecución",
  notificado: "Notificado",
  enviado: "Enviado",
};

const ESTADO_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  solicitudes: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  programacion: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  ejecucion: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  notificado: {
    bg: "bg-indigo-100",
    text: "text-indigo-600",
    border: "border-indigo-200",
  },
  enviado: {
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
};

export default function SolicitudDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const solicitudId = id;
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const canEditSolicitud = hasPermission("solicitudes", "editar");
  const canCrearVisitas = hasPermission("visitas", "crear");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creatingVisita, setCreatingVisita] = useState(false);
  const [tecnicoSel, setTecnicoSel] = useState("");
  const [fechaVisitaSel, setFechaVisitaSel] = useState("");
  const [resultado, setResultado] = useState<{
    total: number;
    exitosas: number;
    pruebasCreadas: number;
    errores: string[];
  } | null>(null);

  const data = useLiveQuery(async () => {
    if (!isReady || !solicitudId) return null;

    const solicitud = await db.solicitudes.get(solicitudId);
    if (!solicitud) return null;

    const cliente = await db.clientes.get(solicitud.cliente_id);
    const ubicacion = solicitud.ubicacion_id
      ? await db.ubicaciones_rx.get(solicitud.ubicacion_id)
      : undefined;
    const tecnico = solicitud.tecnico_asignado_id
      ? await db.usuarios.get(solicitud.tecnico_asignado_id)
      : undefined;
    const contacto = solicitud.contacto_programar_id
      ? await db.contactos.get(solicitud.contacto_programar_id)
      : undefined;

    // Equipos disponibles en la ubicación
    const equipos = solicitud.ubicacion_id
      ? await db.equipos.where("ubicacion_id").equals(solicitud.ubicacion_id).toArray()
      : [];

    // Visitas ya creadas para esta solicitud
    const visitas = await db.visitas.where("solicitud_id").equals(solicitudId).toArray();

    return { solicitud, cliente, ubicacion, tecnico, contacto, equipos, visitas };
  }, [isReady, solicitudId]);

  const tecnicos = useLiveQuery(
    () => (isReady ? db.usuarios.filter((t) => t.activo && t.cargo === "tecnico").toArray() : []),
    [isReady],
    []
  );

  // IDs de equipos sin visita (para inicializar/reconciliar la selección)
  const equiposSinVisitaIds = useMemo(() => {
    if (!data) return [];
    const conVisita = new Set(data.visitas.map((v) => v.equipo_id));
    return data.equipos.filter((e) => !conVisita.has(e.id!)).map((e) => e.id!);
  }, [data]);

  // Selección de equipos a programar. Por defecto todos los pendientes quedan
  // marcados; se conservan los "destildados" por el usuario para equipos ya vistos.
  const [selectedEquipos, setSelectedEquipos] = useState<Set<string>>(new Set());
  const seenPendingRef = useRef<Set<string>>(new Set());
  const pendingKey = equiposSinVisitaIds.join(",");
  useEffect(() => {
    setSelectedEquipos((prev) => {
      const next = new Set<string>();
      for (const id of equiposSinVisitaIds) {
        const seen = seenPendingRef.current.has(id);
        if (seen ? prev.has(id) : true) next.add(id);
      }
      return next;
    });
    seenPendingRef.current = new Set(equiposSinVisitaIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  function toggleEquipo(id: string) {
    setSelectedEquipos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando solicitud...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/solicitudes"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a solicitudes
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Solicitud no encontrada</p>
        </div>
      </div>
    );
  }

  const { solicitud, cliente, ubicacion, tecnico, contacto, equipos, visitas } = data;
  const estado = solicitud.pipeline_estado ?? "solicitudes";
  const badge = ESTADO_BADGE[estado] ?? ESTADO_BADGE.solicitudes;

  // Equipos que ya tienen visita creada
  const equiposConVisita = new Set(visitas.map((v) => v.equipo_id));
  const equiposSinVisita = equipos.filter((e) => !equiposConVisita.has(e.id!));
  // Equipos marcados para programar en esta tanda
  const equiposAProgramar = equiposSinVisita.filter((e) => selectedEquipos.has(e.id!));

  // Valores efectivos para programar: lo seleccionado, o lo ya guardado en la solicitud
  const tecnicoValue =
    tecnicoSel || (solicitud.tecnico_asignado_id ? String(solicitud.tecnico_asignado_id) : "");
  const fechaVisitaValue = fechaVisitaSel || solicitud.fecha_estimada_visita || "";

  async function handleCrearVisitas() {
    const aProgramar = equiposSinVisita.filter((e) => selectedEquipos.has(e.id!));
    if (aProgramar.length === 0 || !tecnicoValue) return;
    setCreatingVisita(true);
    setResultado(null);
    try {
      // Guardar técnico y fecha en la solicitud; la visita los hereda
      const now = new Date().toISOString();
      await db.solicitudes.update(solicitudId, {
        tecnico_asignado_id: tecnicoValue,
        fecha_estimada_visita: fechaVisitaValue || undefined,
        sync_status: "pending",
        last_modified: now,
      });

      let exitosas = 0;
      let pruebasTotal = 0;
      const errores: string[] = [];

      for (const eq of aProgramar) {
        const result = await crearVisitaDesdeSolicitud(solicitudId, eq.id!);
        if (result.success) {
          exitosas++;
          pruebasTotal += result.pruebasCreadas ?? 0;
        } else {
          errores.push(`${eq.gen_marca ?? ""} ${eq.gen_modelo ?? ""}: ${result.error}`);
        }
      }

      setResultado({
        total: aProgramar.length,
        exitosas,
        pruebasCreadas: pruebasTotal,
        errores,
      });

      pushSingle("solicitudes", solicitudId);
    } catch (err) {
      console.error("[SolicitudDetail] Error:", err);
    } finally {
      setCreatingVisita(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <Link
        href="/dashboard/solicitudes"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a solicitudes
      </Link>

      {/* Header */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Solicitud #{solicitud.id}
              </h2>
              <p className="text-sm text-slate-500 font-medium">{cliente?.nombre_cliente}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.bg} ${badge.text} border ${badge.border}`}
              >
                {ESTADO_LABEL[estado] ?? estado.replace("_", " ")}
              </span>
              {canEditSolicitud && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black border-slate-200 hover:bg-primary/5 h-9 px-3 text-xs"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ubicacion && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Ubicación
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {ubicacion.nombre_servicio}
                </p>
              </div>
            )}
            {tecnico && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Técnico
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {tecnico.nombre.split(" ").slice(0, 2).join(" ")}
                </p>
              </div>
            )}
            {contacto && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Contacto
                </p>
                <p className="text-sm font-bold text-slate-700">{contacto.nombre}</p>
              </div>
            )}
            {solicitud.tipo_servicio && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Tipo
                </p>
                <p className="text-sm font-bold text-slate-700">
                  {solicitud.tipo_servicio.replace("_", " ")}
                </p>
              </div>
            )}
            {solicitud.fecha_solicitud && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Fecha Solicitud
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {solicitud.fecha_solicitud}
                </p>
              </div>
            )}
            {solicitud.fecha_estimada_visita && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Fecha Estimada
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {solicitud.fecha_estimada_visita}
                </p>
              </div>
            )}
          </div>

          {/* Pago (solo para solicitudes con datos de pago registrados) */}
          {(solicitud.forma_pago || solicitud.pago_recibido) && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                {solicitud.forma_pago ?? "Sin definir"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  solicitud.pago_recibido
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-red-100 text-red-500"
                }`}
              >
                {solicitud.pago_recibido ? "Pagado" : "Pendiente"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visitas existentes */}
      {visitas.length > 0 && (
        <div>
          <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-3">
            Visitas Creadas
          </h3>
          <div className="space-y-2">
            {visitas.map((visita) => {
              const eq = equipos.find((e) => e.id === visita.equipo_id);
              const eqNombre = eq
                ? [eq.gen_marca, eq.gen_modelo].filter(Boolean).join(" ") ||
                  eq.tipo_equipo ||
                  `Equipo #${eq.id}`
                : null;
              return (
                <a key={visita.id} href={`/dashboard/visitas/${visita.id}`}>
                  <Card className="border-none shadow-sm hover:shadow-lg transition-all rounded-2xl bg-white group cursor-pointer overflow-hidden mb-2">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
                            <ClipboardCheck className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">
                              Visita #{visita.id}
                              {eqNombre ? ` — ${eqNombre}` : ""}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Estado: {visita.estado_visita.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Crear visitas para todos los equipos pendientes */}
      {canCrearVisitas && equiposSinVisita.length > 0 && (
        <Card className="border-2 border-dashed border-primary/30 shadow-none rounded-2xl bg-primary/5 overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Programar Visitas
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {equiposSinVisita.length === 1
                  ? "1 equipo pendiente en esta ubicación."
                  : `${equiposSinVisita.length} equipos pendientes en esta ubicación. Selecciona cuáles programar.`}
              </p>
            </div>

            {/* Selección de equipos a programar */}
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Equipos a programar
              </Label>
              <div className="space-y-2">
                {equiposSinVisita.map((eq) => {
                  const nombre =
                    [eq.gen_marca, eq.gen_modelo].filter(Boolean).join(" ") ||
                    eq.tipo_equipo ||
                    `Equipo #${eq.id}`;
                  return (
                    <label
                      key={eq.id}
                      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-primary/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEquipos.has(eq.id!)}
                        onChange={() => toggleEquipo(eq.id!)}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{nombre}</p>
                        {eq.tipo_equipo && (
                          <p className="text-[11px] text-slate-400 font-medium">{eq.tipo_equipo}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Técnico y fecha de la visita */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Técnico Asignado *
                </Label>
                <Select value={tecnicoValue} onValueChange={(v) => setTecnicoSel(v ?? "")}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium bg-white">
                    <SelectValue placeholder="Seleccionar técnico...">
                      {(v) =>
                        tecnicos.find((t) => String(t.id) === v)?.nombre || "Seleccionar técnico..."
                      }
                    </SelectValue>
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
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Fecha de Visita
                </Label>
                <Input
                  type="date"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11 bg-white"
                  value={fechaVisitaValue}
                  onChange={(e) => setFechaVisitaSel(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-11 px-6 flex-shrink-0"
                disabled={creatingVisita || !tecnicoValue || equiposAProgramar.length === 0}
                onClick={handleCrearVisitas}
              >
                {creatingVisita ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creando...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    {equiposAProgramar.length <= 1
                      ? "Crear Visita"
                      : `Crear ${equiposAProgramar.length} Visitas`}
                  </>
                )}
              </Button>
            </div>

            {resultado && (
              <div
                className={`p-3 rounded-xl text-sm font-medium ${
                  resultado.errores.length === 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {resultado.errores.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {resultado.exitosas}{" "}
                      {resultado.exitosas === 1 ? "visita creada" : "visitas creadas"} con{" "}
                      {resultado.pruebasCreadas} pruebas en total.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        {resultado.exitosas}/{resultado.total} visitas creadas.
                      </span>
                    </div>
                    {resultado.errores.map((err, i) => (
                      <p key={i} className="text-xs ml-6">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Todos los equipos ya tienen visita */}
      {equiposSinVisita.length === 0 && equipos.length > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Todos los equipos de esta ubicación ya tienen visita programada.
        </div>
      )}

      {/* Dialog edición */}
      <SolicitudFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editSolicitud={solicitud}
      />
    </div>
  );
}
