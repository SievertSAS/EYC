"use client";

import { use, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, noBorrado } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Radio,
  MapPin,
  Building2,
  Hash,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  FileText,
  Truck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { TrasladarEquipoDialog } from "@/components/trasladar-equipo-dialog";

// ============================================================
//  Detalle de equipo — ubicación actual, historial de
//  traslados, visitas e informes ligados al equipo.
// ============================================================

function nombreEquipo(eq: { gen_marca?: string; gen_modelo?: string; tipo_equipo?: string }) {
  return (
    [eq.gen_marca, eq.gen_modelo].filter(Boolean).join(" ") || eq.tipo_equipo || "Equipo sin nombre"
  );
}

function fmtFecha(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-CO");
}

export default function EquipoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const equipoId = id;
  const { isReady } = useDb();
  const { hasPermission } = useRole();
  const canTrasladar = hasPermission("equipos", "editar");
  const [trasladarOpen, setTrasladarOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!isReady || !equipoId) return null;

    const equipo = await db.equipos.get(equipoId);
    if (!equipo) return null;

    const ubicacion = await db.ubicaciones_rx.get(equipo.ubicacion_id);
    const sede = ubicacion?.sede_id ? await db.sedes.get(ubicacion.sede_id) : undefined;
    const cliente = sede?.cliente_id ? await db.clientes.get(sede.cliente_id) : undefined;

    // Historial de traslados (más reciente primero)
    const movimientosRaw = await db.equipo_movimientos
      .where("equipo_id")
      .equals(equipoId)
      .toArray();
    movimientosRaw.sort((a, b) =>
      (b.fecha_movimiento ?? "").localeCompare(a.fecha_movimiento ?? "")
    );
    const movimientos = await Promise.all(
      movimientosRaw.map(async (m) => {
        const anterior = m.ubicacion_anterior_id
          ? await db.ubicaciones_rx.get(m.ubicacion_anterior_id)
          : undefined;
        const nueva = await db.ubicaciones_rx.get(m.ubicacion_nueva_id);
        return { mov: m, anterior, nueva };
      })
    );

    // Visitas del equipo (más reciente primero)
    const visitas = (await db.visitas.where("equipo_id").equals(equipoId).toArray()).filter(
      noBorrado
    );
    visitas.sort((a, b) => (b.creado_en ?? "").localeCompare(a.creado_en ?? ""));

    // Informes del equipo (más reciente primero)
    const informes = await db.informes.where("equipo_id").equals(equipoId).toArray();
    informes.sort((a, b) => (b.fecha_emision ?? "").localeCompare(a.fecha_emision ?? ""));

    return { equipo, ubicacion, sede, cliente, movimientos, visitas, informes };
  }, [isReady, equipoId]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando equipo...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/equipos"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a equipos
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-slate-500 font-bold">Equipo no encontrado</p>
        </div>
      </div>
    );
  }

  const { equipo, ubicacion, sede, cliente, movimientos, visitas, informes } = data;
  const ubicacionActualLabel = [
    cliente?.nombre_cliente,
    sede?.nombre_sede,
    ubicacion?.nombre_servicio,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <Link
        href="/dashboard/equipos"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a equipos
      </Link>

      {/* Header */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-primary/10 p-2.5 rounded-xl flex-shrink-0">
                <Radio className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">
                  {nombreEquipo(equipo)}
                </h2>
                {equipo.gen_numero_serie && (
                  <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {equipo.gen_numero_serie}
                  </p>
                )}
              </div>
            </div>
            {canTrasladar && (
              <Button
                variant="outline"
                className="rounded-xl font-black border-slate-200 hover:bg-primary/5 h-9 px-3 text-xs flex-shrink-0"
                onClick={() => setTrasladarOpen(true)}
              >
                <Truck className="w-3.5 h-3.5 mr-1.5" />
                Trasladar
              </Button>
            )}
          </div>

          {/* Ubicación actual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cliente && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Cliente
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {cliente.nombre_cliente}
                </p>
              </div>
            )}
            {(sede || ubicacion) && (
              <div className="space-y-1 sm:col-span-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Ubicación actual
                </p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {[sede?.nombre_sede, ubicacion?.nombre_servicio].filter(Boolean).join(" — ") ||
                    "Sin ubicación"}
                </p>
              </div>
            )}
            {equipo.tipo_equipo && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Tipo
                </p>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                  {equipo.tipo_equipo.replace(/_/g, " ")}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visitas del equipo */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-3 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Visitas ({visitas.length})
        </h3>
        {visitas.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium">Este equipo aún no tiene visitas.</p>
        ) : (
          <div className="space-y-2">
            {visitas.map((v) => (
              <a key={v.id} href={`/dashboard/visitas/${v.id}`}>
                <Card className="border-none shadow-sm hover:shadow-lg transition-all rounded-2xl bg-white group cursor-pointer overflow-hidden mb-2">
                  <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">Visita #{v.id}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {v.estado_visita.replace(/_/g, " ")} ·{" "}
                        {fmtFecha(v.fecha_visita ?? v.creado_en)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors flex-shrink-0" />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Informes del equipo */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Informes ({informes.length})
        </h3>
        {informes.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium">Este equipo aún no tiene informes.</p>
        ) : (
          <div className="space-y-2">
            {informes.map((inf) => (
              <Link key={inf.id} href={`/dashboard/informes/${inf.id}`}>
                <Card className="border-none shadow-sm hover:shadow-lg transition-all rounded-2xl bg-white group cursor-pointer overflow-hidden mb-2">
                  <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">
                        {inf.numero_informe}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {inf.estado.replace(/_/g, " ")} · Emitido {fmtFecha(inf.fecha_emision)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Historial de traslados */}
      <div>
        <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight mb-3 flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          Historial de traslados ({movimientos.length})
        </h3>
        {movimientos.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium">Sin traslados registrados.</p>
        ) : (
          <div className="space-y-2">
            {movimientos.map(({ mov, anterior, nueva }) => (
              <Card
                key={mov.id}
                className="border-none shadow-sm rounded-2xl bg-white overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5 space-y-1.5">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    {fmtFecha(mov.fecha_movimiento)}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 flex-wrap">
                    <span>{anterior?.nombre_servicio ?? "Origen desconocido"}</span>
                    <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{nueva?.nombre_servicio ?? "Destino desconocido"}</span>
                  </div>
                  {mov.motivo && <p className="text-xs text-slate-500 font-medium">{mov.motivo}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de traslado */}
      <TrasladarEquipoDialog
        open={trasladarOpen}
        onOpenChange={setTrasladarOpen}
        equipoId={equipoId}
        ubicacionActualId={equipo.ubicacion_id}
        ubicacionActualLabel={ubicacionActualLabel || undefined}
      />
    </div>
  );
}
