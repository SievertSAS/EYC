import { describe, expect, it } from "vitest";
import type { Solicitud } from "@/lib/db/types";
import {
  FILTROS_SOLICITUDES_VACIOS,
  PIPELINE_ORDER,
  agruparSolicitudesPorEstado,
  aplicarFiltrosSolicitudes,
  contarFiltrosSolicitudesActivos,
  opcionesFiltrosSolicitudes,
  parseFiltrosSolicitudes,
  serializarFiltrosSolicitudes,
  type FilaSolicitudFiltrable,
  type FiltrosSolicitudes,
} from "./filtros-solicitudes";

type Estado = NonNullable<Solicitud["pipeline_estado"]>;

function fila(
  id: string,
  o: {
    estado?: Estado;
    tecnico?: [string, string];
    cliente?: [string, string];
    tipo?: string;
    pago?: boolean;
    fecha?: string;
    numero?: string;
    ubicacion?: string;
  } = {}
): FilaSolicitudFiltrable & { id: string } {
  return {
    id,
    solicitud: {
      pipeline_estado: o.estado,
      tecnico_asignado_id: o.tecnico?.[0],
      cliente_id: o.cliente?.[0] ?? "",
      tipo_servicio: o.tipo,
      pago_recibido: o.pago ?? false,
      fecha_estimada_visita: o.fecha,
      numero_solicitud: o.numero,
    },
    tecnico: o.tecnico ? { id: o.tecnico[0], nombre: o.tecnico[1] } : undefined,
    cliente: o.cliente ? { id: o.cliente[0], nombre_cliente: o.cliente[1] } : undefined,
    ubicacion: o.ubicacion ? { nombre_servicio: o.ubicacion } : undefined,
  };
}

const filas = [
  fila("1", {
    estado: "solicitudes",
    tecnico: ["t1", "Ana Pérez"],
    cliente: ["c1", "Clínica Norte"],
    tipo: "control_calidad",
    pago: true,
    fecha: "2026-03-01",
    numero: "SOL-2026-001",
  }),
  fila("2", {
    estado: "programacion",
    tecnico: ["t2", "Luis Gómez"],
    cliente: ["c2", "Hospital Sur"],
    tipo: "levantamiento",
    fecha: "2026-03-20",
    ubicacion: "Radiología",
  }),
  fila("3", {
    estado: "cancelada",
    tecnico: ["t1", "Ana Pérez"],
    cliente: ["c2", "Hospital Sur"],
    tipo: "control_calidad",
  }),
  // Sin estado: se trata como "solicitudes" (igual que la fila de la tabla)
  fila("4", { cliente: ["c1", "Clínica Norte"] }),
];

const f = (o: Partial<FiltrosSolicitudes>): FiltrosSolicitudes => ({
  ...FILTROS_SOLICITUDES_VACIOS,
  ...o,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("aplicarFiltrosSolicitudes", () => {
  it("'todas' excluye canceladas", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, FILTROS_SOLICITUDES_VACIOS))).toEqual([
      "1",
      "2",
      "4",
    ]);
  });

  it("estado puntual, incluida la pestaña de canceladas", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ estado: "cancelada" })))).toEqual(["3"]);
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ estado: "solicitudes" })))).toEqual(["1", "4"]);
  });

  it("ignorarEstado no filtra por estado (el kanban decide las columnas)", () => {
    const r = aplicarFiltrosSolicitudes(filas, f({ estado: "programacion" }), {
      ignorarEstado: true,
    });
    expect(ids(r)).toEqual(["1", "2", "3", "4"]);
  });

  it("técnico asignado", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ tecnicos: ["t1"] })))).toEqual(["1"]);
  });

  it("cliente", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ clientes: ["c1"] })))).toEqual(["1", "4"]);
  });

  it("tipo de servicio (OR entre valores)", () => {
    expect(
      ids(
        aplicarFiltrosSolicitudes(filas, f({ tiposServicio: ["levantamiento", "control_calidad"] }))
      )
    ).toEqual(["1", "2"]);
  });

  it("pago recibido sí / no", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ pago: "si" })))).toEqual(["1"]);
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ pago: "no" })))).toEqual(["2", "4"]);
  });

  it("rango de fecha estimada inclusivo; sin fecha queda fuera", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ desde: "2026-03-01" })))).toEqual(["1", "2"]);
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ hasta: "2026-03-01" })))).toEqual(["1"]);
  });

  it("campos distintos = AND", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ clientes: ["c1"], pago: "no" })))).toEqual([
      "4",
    ]);
  });

  it("búsqueda libre insensible a tildes", () => {
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ q: "radiologia" })))).toEqual(["2"]);
    expect(ids(aplicarFiltrosSolicitudes(filas, f({ q: "sol-2026" })))).toEqual(["1"]);
  });
});

describe("contarFiltrosSolicitudesActivos", () => {
  it("cuenta campos activos; no cuenta búsqueda, estado, vista ni canceladas", () => {
    expect(contarFiltrosSolicitudesActivos(FILTROS_SOLICITUDES_VACIOS)).toBe(0);
    expect(
      contarFiltrosSolicitudesActivos(
        f({ clientes: ["c1"], pago: "si", hasta: "2026-01-01", q: "x", canceladas: true })
      )
    ).toBe(3);
  });
});

describe("URL ⇄ filtros de solicitudes", () => {
  it("ida y vuelta conserva el estado", () => {
    const original = f({
      vista: "kanban",
      q: "sur",
      estado: "cancelada",
      tecnicos: ["t1"],
      clientes: ["c1", "c2"],
      tiposServicio: ["control_calidad"],
      pago: "no",
      desde: "2026-02-01",
      hasta: "2026-02-28",
      canceladas: true,
    });
    const p = serializarFiltrosSolicitudes(original);
    expect(parseFiltrosSolicitudes(new URLSearchParams(p.toString()))).toEqual(original);
  });

  it("los valores por defecto no ensucian la URL", () => {
    expect(serializarFiltrosSolicitudes(FILTROS_SOLICITUDES_VACIOS).toString()).toBe("");
  });

  it("ignora valores inválidos", () => {
    const p = new URLSearchParams("estado=x&pago=quizas&desde=2026-02-31&canceladas=tal");
    expect(parseFiltrosSolicitudes(p)).toEqual(FILTROS_SOLICITUDES_VACIOS);
  });
});

describe("opcionesFiltrosSolicitudes", () => {
  it("valores distintos presentes, ordenados", () => {
    const o = opcionesFiltrosSolicitudes(filas);
    expect(o.tecnicos.map((t) => t.value)).toEqual(["t1", "t2"]);
    expect(o.clientes.map((c) => c.label)).toEqual(["Clínica Norte", "Hospital Sur"]);
    expect(o.tiposServicio).toEqual([
      { value: "control_calidad", label: "control calidad" },
      { value: "levantamiento", label: "levantamiento" },
    ]);
  });
});

describe("agruparSolicitudesPorEstado", () => {
  it("columnas en orden del pipeline, sin canceladas por defecto", () => {
    const g = agruparSolicitudesPorEstado(filas);
    expect(g.map((c) => c.estado)).toEqual(PIPELINE_ORDER.filter((e) => e !== "cancelada"));
    expect(ids(g[0].items)).toEqual(["1", "4"]);
  });

  it("con incluirCanceladas agrega la columna al final", () => {
    const g = agruparSolicitudesPorEstado(filas, { incluirCanceladas: true });
    expect(g.map((c) => c.estado)).toEqual(PIPELINE_ORDER);
    expect(ids(g[g.length - 1].items)).toEqual(["3"]);
  });
});
