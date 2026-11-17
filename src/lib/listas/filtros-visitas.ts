// ============================================================
//  Filtros combinables del listado de visitas (tabla y kanban).
//  Campos distintos se combinan con AND; varios valores de un mismo
//  campo, con OR. El estado completo vive en la URL (ver parse/serializar).
// ============================================================

import {
  TIPOS_EQUIPO,
  TIPO_LABELS,
  type Cliente,
  type EstadoVisita,
  type Equipo,
  type Sede,
  type TipoEquipo,
  type Usuario,
  type VisitaEjecucion,
} from "@/lib/db/types";
import { ESTADO_ORDER } from "@/lib/workflow/visit-state-machine";
import {
  agregarMultiple,
  agruparPorEstado,
  coincideBusqueda,
  dentroDeRango,
  incluyeNormalizado,
  normalizar,
  opcionesDistintas,
  parseFecha,
  parseMultiple,
  parseVista,
  type OpcionFiltro,
  type VistaLista,
} from "./comun";

export type TabVisitas = "todas" | "pendientes" | "en_progreso" | "completadas";

export const TABS_VISITAS: { id: TabVisitas; label: string; states: EstadoVisita[] }[] = [
  { id: "todas", label: "Todas", states: [] },
  { id: "pendientes", label: "Pendientes", states: ["asignada"] },
  { id: "en_progreso", label: "En Progreso", states: ["en_progreso", "en_revision"] },
  { id: "completadas", label: "Completadas", states: ["aprobada", "enviada"] },
];

export interface FiltrosVisitas {
  vista: VistaLista;
  /** Búsqueda libre (cliente, equipo, técnico). */
  q: string;
  /** Pestaña de estado. Solo aplica en la vista de tabla. */
  estado: TabVisitas;
  /** ids de usuario (técnico asignado). */
  tecnicos: string[];
  /** ids de cliente. */
  clientes: string[];
  tipos: TipoEquipo[];
  /** Ciudad de la sede, tal como se muestra. */
  ciudades: string[];
  /** fecha_visita, YYYY-MM-DD inclusivo. */
  desde: string | null;
  hasta: string | null;
}

export const FILTROS_VISITAS_VACIOS: FiltrosVisitas = {
  vista: "tabla",
  q: "",
  estado: "todas",
  tecnicos: [],
  clientes: [],
  tipos: [],
  ciudades: [],
  desde: null,
  hasta: null,
};

/** Forma mínima de una fila del listado que necesitan los filtros. */
export interface FilaVisitaFiltrable {
  visita: Pick<VisitaEjecucion, "estado_visita" | "tecnico_id" | "fecha_visita">;
  equipo?: Pick<Equipo, "gen_marca" | "gen_modelo" | "tipo_equipo">;
  cliente?: Pick<Cliente, "id" | "nombre_cliente">;
  sede?: Pick<Sede, "ciudad">;
  tecnico?: Pick<Usuario, "id" | "nombre">;
}

export function aplicarFiltrosVisitas<T extends FilaVisitaFiltrable>(
  filas: T[],
  f: FiltrosVisitas,
  opts: { ignorarEstado?: boolean } = {}
): T[] {
  const tab = TABS_VISITAS.find((t) => t.id === f.estado);
  const estados = !opts.ignorarEstado && tab && tab.states.length > 0 ? tab.states : null;
  const q = normalizar(f.q.trim());

  return filas.filter((fila) => {
    if (estados && !estados.includes(fila.visita.estado_visita)) return false;
    if (f.tecnicos.length && !f.tecnicos.includes(fila.visita.tecnico_id ?? "")) return false;
    if (f.clientes.length && !f.clientes.includes(fila.cliente?.id ?? "")) return false;
    if (f.tipos.length && !f.tipos.includes(fila.equipo?.tipo_equipo as TipoEquipo)) return false;
    if (f.ciudades.length && !incluyeNormalizado(f.ciudades, fila.sede?.ciudad)) return false;
    if (!dentroDeRango(fila.visita.fecha_visita, f.desde, f.hasta)) return false;
    return coincideBusqueda(q, [
      fila.cliente?.nombre_cliente,
      fila.equipo?.gen_marca,
      fila.equipo?.gen_modelo,
      fila.equipo?.tipo_equipo?.replace(/_/g, " "),
      fila.tecnico?.nombre,
    ]);
  });
}

/** Filtros del panel activos (no cuenta búsqueda, pestaña ni vista). Rango de fechas = 1. */
export function contarFiltrosVisitasActivos(f: FiltrosVisitas): number {
  return (
    [f.tecnicos, f.clientes, f.tipos, f.ciudades].filter((v) => v.length > 0).length +
    (f.desde || f.hasta ? 1 : 0)
  );
}

const esTab = (v: string | null): v is TabVisitas => TABS_VISITAS.some((t) => t.id === v);
const esTipo = (v: string): v is TipoEquipo => (TIPOS_EQUIPO as readonly string[]).includes(v);

export function parseFiltrosVisitas(params: URLSearchParams): FiltrosVisitas {
  const estado = params.get("estado");
  return {
    vista: parseVista(params),
    q: params.get("q") ?? "",
    estado: esTab(estado) ? estado : "todas",
    tecnicos: parseMultiple(params, "tecnico"),
    clientes: parseMultiple(params, "cliente"),
    tipos: parseMultiple(params, "tipo", esTipo) as TipoEquipo[],
    ciudades: parseMultiple(params, "ciudad"),
    desde: parseFecha(params.get("desde")),
    hasta: parseFecha(params.get("hasta")),
  };
}

export function serializarFiltrosVisitas(f: FiltrosVisitas): URLSearchParams {
  const p = new URLSearchParams();
  if (f.vista !== "tabla") p.set("vista", f.vista);
  if (f.q) p.set("q", f.q);
  if (f.estado !== "todas") p.set("estado", f.estado);
  agregarMultiple(p, "tecnico", f.tecnicos);
  agregarMultiple(p, "cliente", f.clientes);
  agregarMultiple(p, "tipo", f.tipos);
  agregarMultiple(p, "ciudad", f.ciudades);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  return p;
}

export interface OpcionesFiltrosVisitas {
  tecnicos: OpcionFiltro[];
  clientes: OpcionFiltro[];
  tipos: OpcionFiltro[];
  ciudades: OpcionFiltro[];
}

/** Opciones a partir de los datos cargados. Ciudades iguales salvo tildes se unifican. */
export function opcionesFiltrosVisitas(filas: FilaVisitaFiltrable[]): OpcionesFiltrosVisitas {
  const ciudades = new Map<string, OpcionFiltro>();
  for (const fila of filas) {
    const c = fila.sede?.ciudad?.trim();
    if (c && !ciudades.has(normalizar(c))) ciudades.set(normalizar(c), { value: c, label: c });
  }
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
    tipos: opcionesDistintas(
      filas.map((f) => {
        const t = f.equipo?.tipo_equipo as TipoEquipo | undefined;
        return t ? { value: t, label: TIPO_LABELS[t] ?? t } : undefined;
      })
    ),
    ciudades: opcionesDistintas([...ciudades.values()]),
  };
}

export function agruparVisitasPorEstado<T extends FilaVisitaFiltrable>(filas: T[]) {
  return agruparPorEstado(filas, (f) => f.visita.estado_visita, ESTADO_ORDER);
}
