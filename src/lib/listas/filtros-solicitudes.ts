// ============================================================
//  Filtros combinables del pipeline de solicitudes (tabla y kanban).
//  Campos distintos se combinan con AND; varios valores de un mismo
//  campo, con OR. El estado completo vive en la URL (ver parse/serializar).
// ============================================================

import type { Cliente, Solicitud, UbicacionRx, Usuario } from "@/lib/db/types";
import {
  agregarMultiple,
  agruparPorEstado,
  coincideBusqueda,
  dentroDeRango,
  normalizar,
  opcionesDistintas,
  parseFecha,
  parseMultiple,
  parseVista,
  type OpcionFiltro,
  type VistaLista,
} from "./comun";

export type EstadoPipeline = NonNullable<Solicitud["pipeline_estado"]>;
export type TabSolicitudes = "todas" | EstadoPipeline;
export type FiltroPago = "todos" | "si" | "no";

export const PIPELINE_ORDER: EstadoPipeline[] = [
  "solicitudes",
  "programacion",
  "ejecucion",
  "notificado",
  "enviado",
  "cancelada",
];

export const PIPELINE_LABEL: Record<EstadoPipeline, string> = {
  solicitudes: "Por programar",
  programacion: "Programación",
  ejecucion: "Ejecución",
  notificado: "Notificado",
  enviado: "Enviado",
  cancelada: "Cancelada",
};

export const PIPELINE_BADGE: Record<EstadoPipeline, { bg: string; text: string; border: string }> =
  {
    solicitudes: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
    programacion: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
    ejecucion: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    notificado: { bg: "bg-indigo-100", text: "text-indigo-600", border: "border-indigo-200" },
    enviado: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200" },
    cancelada: { bg: "bg-red-100", text: "text-red-600", border: "border-red-200" },
  };

/** Estado efectivo: una solicitud sin estado se muestra como "Por programar". */
export function estadoPipeline(s: Pick<Solicitud, "pipeline_estado">): EstadoPipeline {
  return s.pipeline_estado ?? "solicitudes";
}

export interface FiltrosSolicitudes {
  vista: VistaLista;
  /** Búsqueda libre (número, cliente, ubicación, técnico). */
  q: string;
  /** Pestaña de estado. Solo aplica en la vista de tabla; "todas" excluye canceladas. */
  estado: TabSolicitudes;
  /** ids de usuario (técnico asignado). */
  tecnicos: string[];
  /** ids de cliente. */
  clientes: string[];
  tiposServicio: string[];
  pago: FiltroPago;
  /** fecha_estimada_visita, YYYY-MM-DD inclusivo. */
  desde: string | null;
  hasta: string | null;
  /** Kanban: mostrar la columna de canceladas. */
  canceladas: boolean;
}

export const FILTROS_SOLICITUDES_VACIOS: FiltrosSolicitudes = {
  vista: "tabla",
  q: "",
  estado: "todas",
  tecnicos: [],
  clientes: [],
  tiposServicio: [],
  pago: "todos",
  desde: null,
  hasta: null,
  canceladas: false,
};

/** Forma mínima de una fila del listado que necesitan los filtros. */
export interface FilaSolicitudFiltrable {
  solicitud: Pick<
    Solicitud,
    | "pipeline_estado"
    | "tecnico_asignado_id"
    | "cliente_id"
    | "tipo_servicio"
    | "pago_recibido"
    | "fecha_estimada_visita"
    | "numero_solicitud"
  >;
  cliente?: Pick<Cliente, "id" | "nombre_cliente">;
  ubicacion?: Pick<UbicacionRx, "nombre_servicio">;
  tecnico?: Pick<Usuario, "id" | "nombre">;
}

export function aplicarFiltrosSolicitudes<T extends FilaSolicitudFiltrable>(
  filas: T[],
  f: FiltrosSolicitudes,
  opts: { ignorarEstado?: boolean } = {}
): T[] {
  const q = normalizar(f.q.trim());

  return filas.filter(({ solicitud: s, cliente, ubicacion, tecnico }) => {
    if (!opts.ignorarEstado) {
      const estado = estadoPipeline(s);
      if (f.estado === "todas" ? estado === "cancelada" : estado !== f.estado) return false;
    }
    if (f.tecnicos.length && !f.tecnicos.includes(s.tecnico_asignado_id ?? "")) return false;
    if (f.clientes.length && !f.clientes.includes(s.cliente_id)) return false;
    if (f.tiposServicio.length && !f.tiposServicio.includes(s.tipo_servicio ?? "")) return false;
    if (f.pago !== "todos" && !!s.pago_recibido !== (f.pago === "si")) return false;
    if (!dentroDeRango(s.fecha_estimada_visita, f.desde, f.hasta)) return false;
    return coincideBusqueda(q, [
      s.numero_solicitud,
      cliente?.nombre_cliente,
      ubicacion?.nombre_servicio,
      tecnico?.nombre,
    ]);
  });
}

/** Filtros del panel activos (no cuenta búsqueda, pestaña, vista ni canceladas). */
export function contarFiltrosSolicitudesActivos(f: FiltrosSolicitudes): number {
  return (
    [f.tecnicos, f.clientes, f.tiposServicio].filter((v) => v.length > 0).length +
    (f.pago !== "todos" ? 1 : 0) +
    (f.desde || f.hasta ? 1 : 0)
  );
}

const esTab = (v: string | null): v is TabSolicitudes =>
  v === "todas" || (PIPELINE_ORDER as (string | null)[]).includes(v);

export function parseFiltrosSolicitudes(params: URLSearchParams): FiltrosSolicitudes {
  const estado = params.get("estado");
  const pago = params.get("pago");
  return {
    vista: parseVista(params),
    q: params.get("q") ?? "",
    estado: esTab(estado) ? estado : "todas",
    tecnicos: parseMultiple(params, "tecnico"),
    clientes: parseMultiple(params, "cliente"),
    tiposServicio: parseMultiple(params, "tipo"),
    pago: pago === "si" || pago === "no" ? pago : "todos",
    desde: parseFecha(params.get("desde")),
    hasta: parseFecha(params.get("hasta")),
    canceladas: params.get("canceladas") === "1",
  };
}

export function serializarFiltrosSolicitudes(f: FiltrosSolicitudes): URLSearchParams {
  const p = new URLSearchParams();
  if (f.vista !== "tabla") p.set("vista", f.vista);
  if (f.q) p.set("q", f.q);
  if (f.estado !== "todas") p.set("estado", f.estado);
  agregarMultiple(p, "tecnico", f.tecnicos);
  agregarMultiple(p, "cliente", f.clientes);
  agregarMultiple(p, "tipo", f.tiposServicio);
  if (f.pago !== "todos") p.set("pago", f.pago);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.canceladas) p.set("canceladas", "1");
  return p;
}

export interface OpcionesFiltrosSolicitudes {
  tecnicos: OpcionFiltro[];
  clientes: OpcionFiltro[];
  tiposServicio: OpcionFiltro[];
}

/** Etiqueta legible de un tipo de servicio (igual que en la fila). */
export function etiquetaTipoServicio(tipo: string): string {
  return tipo.replace(/_/g, " ");
}

export function opcionesFiltrosSolicitudes(
  filas: FilaSolicitudFiltrable[]
): OpcionesFiltrosSolicitudes {
  return {
    tecnicos: opcionesDistintas(
      filas.map((f) =>
        f.tecnico?.id ? { value: f.tecnico.id, label: f.tecnico.nombre } : undefined
      )
    ),
    clientes: opcionesDistintas(
      filas.map((f) =>
        f.cliente?.id ? { value: f.cliente.id, label: f.cliente.nombre_cliente } : undefined
      )
    ),
    tiposServicio: opcionesDistintas(
      filas.map(({ solicitud: s }) =>
        s.tipo_servicio
          ? { value: s.tipo_servicio, label: etiquetaTipoServicio(s.tipo_servicio) }
          : undefined
      )
    ),
  };
}

export function agruparSolicitudesPorEstado<T extends FilaSolicitudFiltrable>(
  filas: T[],
  opts: { incluirCanceladas?: boolean } = {}
) {
  const orden = opts.incluirCanceladas
    ? PIPELINE_ORDER
    : PIPELINE_ORDER.filter((e) => e !== "cancelada");
  return agruparPorEstado(filas, (f) => estadoPipeline(f.solicitud), orden);
}
