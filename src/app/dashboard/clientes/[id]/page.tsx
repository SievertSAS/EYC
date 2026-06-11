"use client";

import { use, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  MapPin,
  Plus,
  Radio,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { ClienteFormDialog } from "@/components/cliente-form-dialog";
import { ContactoFormDialog } from "@/components/contacto-form-dialog";
import { SedeFormDialog } from "@/components/sede-form-dialog";
import { UbicacionFormDialog } from "@/components/ubicacion-form-dialog";
import { EquipoFormDialog } from "@/components/equipo-form-dialog";
import type { Sede, UbicacionRx, Equipo, Contacto } from "@/lib/db/types";

// ============================================================
//  Detalle de cliente con tabs: Info, Contactos, Sedes
// ============================================================

const CARGO_LABELS: Record<string, string> = {
  medico_responsable: "Médico Responsable",
  tecnologo: "Tecnólogo",
  opr: "OPR",
  representante: "Representante",
  otro: "Otro",
};

const TIPO_EQUIPO_LABELS: Record<string, string> = {
  CONVENCIONAL: "Convencional",
  CT: "CT",
  CT_DENTAL: "CT Dental",
  MAMOGRAFO: "Mamógrafo",
  PANORAMICO: "Panorámico",
  PERIAPICAL: "Periapical",
  PERIAPICAL_PORTATIL: "Periapical Portátil",
  RX_PORTATIL: "RX Portátil",
  ARCOENC: "Arco en C",
  FLUOROSCOPIOS: "Fluoroscopio",
  DENSITOMETRO: "Densitómetro",
  ANGIOGRAFO: "Angiógrafo",
  INDUSTRIAL: "Industrial",
  VETERINARIO: "Veterinario",
  MULTIPROPOSITO: "Multipropósito",
  LITOTRIPTOR: "Litotriptor",
  VARIOS_RX: "Varios RX",
};

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clienteId = parseInt(id, 10);
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const canCreateCliente = hasPermission("clientes", "crear");
  const canEditCliente = hasPermission("clientes", "editar");
  const canCreateEquipo = hasPermission("equipos", "crear");
  const canEditEquipo = hasPermission("equipos", "editar");

  // Dialog states
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [contactoDialogOpen, setContactoDialogOpen] = useState(false);
  const [editContacto, setEditContacto] = useState<Contacto | undefined>();
  const [sedeDialogOpen, setSedeDialogOpen] = useState(false);
  const [editSede, setEditSede] = useState<Sede | undefined>();
  const [ubicacionDialogOpen, setUbicacionDialogOpen] = useState(false);
  const [ubicacionSedeId, setUbicacionSedeId] = useState<number>(0);
  const [editUbicacion, setEditUbicacion] = useState<UbicacionRx | undefined>();
  const [equipoDialogOpen, setEquipoDialogOpen] = useState(false);
  const [equipoUbicacionId, setEquipoUbicacionId] = useState<number>(0);
  const [editEquipo, setEditEquipo] = useState<Equipo | undefined>();

  // Expandable sedes
  const [expandedSedes, setExpandedSedes] = useState<Set<number>>(new Set());
  const [expandedUbis, setExpandedUbis] = useState<Set<number>>(new Set());

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(clienteId)) return null;

    const cliente = await db.clientes.get(clienteId);
    if (!cliente) return null;

    const contactos = await db.contactos.where("cliente_id").equals(clienteId).toArray();

    const sedes = await db.sedes.where("cliente_id").equals(clienteId).toArray();

    // Enrichir sedes con ubicaciones y equipos
    const sedesEnriched = await Promise.all(
      sedes.map(async (sede) => {
        const ubicaciones = await db.ubicaciones_rx.where("sede_id").equals(sede.id!).toArray();

        const ubicacionesEnriched = await Promise.all(
          ubicaciones.map(async (ubi) => {
            const equipos = await db.equipos.where("ubicacion_id").equals(ubi.id!).toArray();
            return { ubicacion: ubi, equipos };
          })
        );

        return { sede, ubicaciones: ubicacionesEnriched };
      })
    );

    return { cliente, contactos, sedes: sedesEnriched };
  }, [isReady, clienteId]);

  function toggleSede(sedeId: number) {
    setExpandedSedes((prev) => {
      const next = new Set(prev);
      if (next.has(sedeId)) next.delete(sedeId);
      else next.add(sedeId);
      return next;
    });
  }

  function toggleUbi(ubiId: number) {
    setExpandedUbis((prev) => {
      const next = new Set(prev);
      if (next.has(ubiId)) next.delete(ubiId);
      else next.add(ubiId);
      return next;
    });
  }

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando cliente...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/clientes"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Cliente no encontrado</p>
        </div>
      </div>
    );
  }

  const { cliente, contactos, sedes } = data;
  const totalEquipos = sedes.reduce(
    (acc, s) => acc + s.ubicaciones.reduce((a, u) => a + u.equipos.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <Link
        href="/dashboard/clientes"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            {cliente.nombre_cliente}
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            NIT: {cliente.nit}
            {cliente.digito_verificacion ? `-${cliente.digito_verificacion}` : ""}
          </p>
        </div>
        {canEditCliente && (
          <Button
            variant="outline"
            className="rounded-xl font-black border-slate-200 hover:bg-primary/5"
            onClick={() => setEditClienteOpen(true)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Contactos
              </p>
              <p className="text-lg font-black text-slate-900">{contactos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Sedes
              </p>
              <p className="text-lg font-black text-slate-900">{sedes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Radio className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Equipos
              </p>
              <p className="text-lg font-black text-slate-900">{totalEquipos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList variant="line" className="w-full justify-start border-b border-slate-200 pb-0">
          <TabsTrigger value="info" className="font-black text-sm">
            Info
          </TabsTrigger>
          <TabsTrigger value="contactos" className="font-black text-sm">
            Contactos ({contactos.length})
          </TabsTrigger>
          <TabsTrigger value="sedes" className="font-black text-sm">
            Sedes ({sedes.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Info ─── */}
        <TabsContent value="info" className="pt-4">
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-5 space-y-4">
              <InfoRow label="Nombre Prestador" value={cliente.nombre_prestador} />
              <InfoRow
                label="Naturaleza"
                value={
                  cliente.naturaleza
                    ? cliente.naturaleza.charAt(0).toUpperCase() + cliente.naturaleza.slice(1)
                    : undefined
                }
              />
              <InfoRow label="Dirección" value={cliente.direccion} />
              <InfoRow label="Teléfono" value={cliente.telefono} />
              <InfoRow label="Email" value={cliente.email} />
              <InfoRow label="Representante Legal" value={cliente.nombre_representante_legal} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Contactos ─── */}
        <TabsContent value="contactos" className="pt-4 space-y-3">
          {canCreateCliente && (
            <Button
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-10"
              onClick={() => {
                setEditContacto(undefined);
                setContactoDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Contacto
            </Button>
          )}

          {contactos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="bg-primary/10 p-5 rounded-3xl">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <p className="text-slate-500 font-bold">Sin contactos</p>
            </div>
          ) : (
            contactos.map((contacto) => (
              <Card
                key={contacto.id}
                className="border-none shadow-sm rounded-2xl bg-white overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 text-sm">{contacto.nombre}</p>
                        {contacto.para_programar && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                            Programar
                          </span>
                        )}
                      </div>
                      {contacto.cargo && (
                        <p className="text-xs text-slate-500 font-medium">
                          {CARGO_LABELS[contacto.cargo] ?? contacto.cargo}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 text-[11px] text-slate-400 font-medium">
                        {contacto.telefono && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contacto.telefono}
                          </span>
                        )}
                        {contacto.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {contacto.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {canEditCliente && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-slate-400 hover:text-primary"
                        onClick={() => {
                          setEditContacto(contacto);
                          setContactoDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── Tab: Sedes ─── */}
        <TabsContent value="sedes" className="pt-4 space-y-3">
          {canCreateCliente && (
            <Button
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-10"
              onClick={() => {
                setEditSede(undefined);
                setSedeDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Sede
            </Button>
          )}

          {sedes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="bg-primary/10 p-5 rounded-3xl">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <p className="text-slate-500 font-bold">Sin sedes</p>
            </div>
          ) : (
            sedes.map(({ sede, ubicaciones }) => {
              const isExpanded = expandedSedes.has(sede.id!);
              return (
                <Card
                  key={sede.id}
                  className="border-none shadow-sm rounded-2xl bg-white overflow-hidden"
                >
                  <CardContent className="p-0">
                    {/* Sede header */}
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleSede(sede.id!)}
                        className="flex-1 min-w-0 flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-primary/10 p-2 rounded-xl flex-shrink-0">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-black text-slate-900 text-sm truncate">
                                {sede.nombre_sede}
                              </p>
                              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                                Sede
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {[sede.ciudad, sede.departamento].filter(Boolean).join(", ") ||
                                sede.direccion_sede}
                            </p>
                            {(sede.telefono || sede.email) && (
                              <p className="text-[11px] text-slate-400 font-medium truncate">
                                {[sede.telefono, sede.email].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500">
                            {ubicaciones.length} ubic.
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>
                      {canEditCliente && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-slate-400 hover:text-primary mr-3 flex-shrink-0"
                          aria-label={`Editar sede ${sede.nombre_sede}`}
                          onClick={() => {
                            setEditSede(sede);
                            setSedeDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Ubicaciones */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Ubicaciones RX ({ubicaciones.length})
                          </p>
                          {canCreateCliente && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg font-bold border-dashed border-slate-300 text-slate-500 hover:text-primary hover:border-primary"
                              onClick={() => {
                                setUbicacionSedeId(sede.id!);
                                setEditUbicacion(undefined);
                                setUbicacionDialogOpen(true);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Agregar Ubicación
                            </Button>
                          )}
                        </div>

                        {ubicaciones.length === 0 ? (
                          <p className="text-xs text-slate-400 font-medium py-4 text-center">
                            Sin ubicaciones registradas
                          </p>
                        ) : (
                          ubicaciones.map(({ ubicacion, equipos }) => {
                            const ubiExpanded = expandedUbis.has(ubicacion.id!);
                            return (
                              <div
                                key={ubicacion.id}
                                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                              >
                                {/* Ubicación header */}
                                <div className="flex items-center">
                                  <button
                                    onClick={() => toggleUbi(ubicacion.id!)}
                                    className="flex-1 min-w-0 flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">
                                          {ubicacion.nombre_servicio}
                                        </p>
                                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600 border border-indigo-200 flex-shrink-0">
                                          Ubicación RX
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 font-medium">
                                        {ubicacion.codigo_habilitacion ?? "Sin código"}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary">
                                        {equipos.length} eq.
                                      </span>
                                      {ubiExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </div>
                                  </button>
                                  {canEditCliente && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-lg text-slate-400 hover:text-primary mr-2 flex-shrink-0"
                                      aria-label={`Editar ubicación ${ubicacion.nombre_servicio}`}
                                      onClick={() => {
                                        setUbicacionSedeId(sede.id!);
                                        setEditUbicacion(ubicacion);
                                        setUbicacionDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>

                                {/* Equipos */}
                                {ubiExpanded && (
                                  <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/30">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Equipos ({equipos.length})
                                      </p>
                                      {canCreateEquipo && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-lg font-bold border-dashed border-slate-300 text-slate-500 hover:text-primary hover:border-primary text-xs"
                                          onClick={() => {
                                            setEquipoUbicacionId(ubicacion.id!);
                                            setEditEquipo(undefined);
                                            setEquipoDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Agregar Equipo
                                        </Button>
                                      )}
                                    </div>

                                    {equipos.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-medium py-3 text-center">
                                        Sin equipos
                                      </p>
                                    ) : (
                                      equipos.map((equipo) => (
                                        <div
                                          key={equipo.id}
                                          className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100"
                                        >
                                          <Radio className="w-4 h-4 text-primary flex-shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <p className="text-sm font-bold text-slate-800 truncate">
                                                {[equipo.gen_marca, equipo.gen_modelo]
                                                  .filter(Boolean)
                                                  .join(" ") || "Equipo sin marca"}
                                              </p>
                                              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 border border-emerald-200 flex-shrink-0">
                                                Equipo
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                              {equipo.tipo_equipo
                                                ? (TIPO_EQUIPO_LABELS[equipo.tipo_equipo] ??
                                                  equipo.tipo_equipo)
                                                : "Tipo no definido"}
                                              {equipo.gen_numero_serie
                                                ? ` • S/N: ${equipo.gen_numero_serie}`
                                                : ""}
                                            </p>
                                          </div>
                                          {canEditEquipo && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="rounded-lg text-slate-400 hover:text-primary flex-shrink-0"
                                              aria-label={`Editar equipo ${equipo.gen_marca ?? ""} ${equipo.gen_modelo ?? ""}`}
                                              onClick={() => {
                                                setEquipoUbicacionId(ubicacion.id!);
                                                setEditEquipo(equipo);
                                                setEquipoDialogOpen(true);
                                              }}
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ClienteFormDialog
        open={editClienteOpen}
        onOpenChange={setEditClienteOpen}
        cliente={cliente}
      />
      {/* key fuerza el remount al cambiar la entidad, para que el form
          se reinicialice con los datos correctos (crear vs editar) */}
      <ContactoFormDialog
        key={editContacto?.id ?? "nuevo-contacto"}
        open={contactoDialogOpen}
        onOpenChange={setContactoDialogOpen}
        clienteId={clienteId}
        contacto={editContacto}
      />
      <SedeFormDialog
        key={editSede?.id ?? "nueva-sede"}
        open={sedeDialogOpen}
        onOpenChange={setSedeDialogOpen}
        clienteId={clienteId}
        sede={editSede}
      />
      <UbicacionFormDialog
        key={editUbicacion?.id ?? "nueva-ubicacion"}
        open={ubicacionDialogOpen}
        onOpenChange={setUbicacionDialogOpen}
        sedeId={ubicacionSedeId}
        ubicacion={editUbicacion}
      />
      <EquipoFormDialog
        key={editEquipo?.id ?? "nuevo-equipo"}
        open={equipoDialogOpen}
        onOpenChange={setEquipoDialogOpen}
        ubicacionId={equipoUbicacionId}
        equipo={editEquipo}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-40 flex-shrink-0">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}
