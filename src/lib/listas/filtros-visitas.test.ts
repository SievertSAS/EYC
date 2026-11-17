import { describe, expect, it } from "vitest";
import type { EstadoVisita, TipoEquipo } from "@/lib/db/types";
import { ESTADO_ORDER } from "@/lib/workflow/visit-state-machine";
import {
  FILTROS_VISITAS_VACIOS,
  agruparVisitasPorEstado,
  aplicarFiltrosVisitas,
  contarFiltrosVisitasActivos,
  opcionesFiltrosVisitas,
  parseFiltrosVisitas,
  serializarFiltrosVisitas,
  type FilaVisitaFiltrable,
  type FiltrosVisitas,
} from "./filtros-visitas";

function fila(
  id: string,
  o: {
    estado?: EstadoVisita;
    tecnico?: [string, string];
    cliente?: [string, string];
    tipo?: TipoEquipo;
    ciudad?: string;
    fecha?: string;
    marca?: string;
  } = {}
): FilaVisitaFiltrable & { id: string } {
  return {
    id,
    visita: {
      estado_visita: o.estado ?? "asignada",
      tecnico_id: o.tecnico?.[0],
      fecha_visita: o.fecha,
    },
    tecnico: o.tecnico ? { id: o.tecnico[0], nombre: o.tecnico[1] } : undefined,
    cliente: o.cliente ? { id: o.cliente[0], nombre_cliente: o.cliente[1] } : undefined,
    equipo: { tipo_equipo: o.tipo, gen_marca: o.marca, gen_modelo: undefined },
    sede: o.ciudad ? { ciudad: o.ciudad } : undefined,
  };
}

const filas = [
  fila("1", {
    estado: "asignada",
    tecnico: ["t1", "Ana Pérez"],
    cliente: ["c1", "Clínica Norte"],
    tipo: "CONVENCIONAL",
    ciudad: "Bogotá",
    fecha: "2026-03-01",
    marca: "Siemens",
  }),
  fila("2", {
    estado: "en_progreso",
    tecnico: ["t2", "Luis Gómez"],
    cliente: ["c2", "Hospital Sur"],
    tipo: "CT",
    ciudad: "Medellín",
    fecha: "2026-03-15",
  }),
  fila("3", {
    estado: "aprobada",
    tecnico: ["t1", "Ana Pérez"],
    cliente: ["c2", "Hospital Sur"],
    tipo: "MAMOGRAFO",
    ciudad: "bogota",
    fecha: "2026-04-01",
  }),
  fila("4", { estado: "enviada" }),
];

const f = (o: Partial<FiltrosVisitas>): FiltrosVisitas => ({ ...FILTROS_VISITAS_VACIOS, ...o });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("aplicarFiltrosVisitas", () => {
  it("sin filtros devuelve todo", () => {
    expect(ids(aplicarFiltrosVisitas(filas, FILTROS_VISITAS_VACIOS))).toEqual(["1", "2", "3", "4"]);
  });

  it("estado (pestaña) agrupa estados", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ estado: "pendientes" })))).toEqual(["1"]);
    expect(ids(aplicarFiltrosVisitas(filas, f({ estado: "completadas" })))).toEqual(["3", "4"]);
  });

  it("ignorarEstado deja pasar todos los estados (vista kanban)", () => {
    const r = aplicarFiltrosVisitas(filas, f({ estado: "pendientes" }), { ignorarEstado: true });
    expect(ids(r)).toEqual(["1", "2", "3", "4"]);
  });

  it("técnico", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ tecnicos: ["t1"] })))).toEqual(["1", "3"]);
  });

  it("cliente", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ clientes: ["c2"] })))).toEqual(["2", "3"]);
  });

  it("tipo de equipo", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ tipos: ["CT"] })))).toEqual(["2"]);
  });

  it("ciudad sin importar tildes ni mayúsculas", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ ciudades: ["Bogotá"] })))).toEqual(["1", "3"]);
  });

  it("rango de fechas inclusivo; sin fecha queda fuera", () => {
    const r = aplicarFiltrosVisitas(filas, f({ desde: "2026-03-01", hasta: "2026-03-15" }));
    expect(ids(r)).toEqual(["1", "2"]);
  });

  it("varios valores en un campo = OR", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ tipos: ["CT", "CONVENCIONAL"] })))).toEqual([
      "1",
      "2",
    ]);
  });

  it("campos distintos = AND", () => {
    const r = aplicarFiltrosVisitas(filas, f({ tecnicos: ["t1"], clientes: ["c2"] }));
    expect(ids(r)).toEqual(["3"]);
  });

  it("búsqueda libre insensible a tildes", () => {
    expect(ids(aplicarFiltrosVisitas(filas, f({ q: "perez" })))).toEqual(["1", "3"]);
    expect(ids(aplicarFiltrosVisitas(filas, f({ q: "CLINICA" })))).toEqual(["1"]);
    expect(ids(aplicarFiltrosVisitas(filas, f({ q: "siemens" })))).toEqual(["1"]);
  });
});

describe("contarFiltrosVisitasActivos", () => {
  it("cuenta campos activos (rango de fechas = 1); no cuenta búsqueda, estado ni vista", () => {
    expect(contarFiltrosVisitasActivos(FILTROS_VISITAS_VACIOS)).toBe(0);
    expect(
      contarFiltrosVisitasActivos(
        f({
          tecnicos: ["a", "b"],
          ciudades: ["X"],
          desde: "2026-01-01",
          hasta: "2026-02-01",
          q: "x",
          estado: "pendientes",
          vista: "kanban",
        })
      )
    ).toBe(3);
  });
});

describe("URL ⇄ filtros de visitas", () => {
  it("ida y vuelta conserva el estado", () => {
    const original = f({
      vista: "kanban",
      q: "ana",
      estado: "en_progreso",
      tecnicos: ["t1", "t2"],
      clientes: ["c1"],
      tipos: ["CT"],
      ciudades: ["Bogotá"],
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
    const params = serializarFiltrosVisitas(original);
    expect(parseFiltrosVisitas(new URLSearchParams(params.toString()))).toEqual(original);
  });

  it("los valores por defecto no ensucian la URL", () => {
    expect(serializarFiltrosVisitas(FILTROS_VISITAS_VACIOS).toString()).toBe("");
  });

  it("ignora claves desconocidas y valores inválidos", () => {
    const p = new URLSearchParams(
      "vista=grilla&estado=raro&tipo=NOPE&tipo=CT&desde=2026-13-01&hasta=ayer&otro=1"
    );
    expect(parseFiltrosVisitas(p)).toEqual(f({ tipos: ["CT"] }));
  });
});

describe("opcionesFiltrosVisitas", () => {
  it("valores distintos presentes en los datos, ordenados", () => {
    const o = opcionesFiltrosVisitas(filas);
    expect(o.tecnicos).toEqual([
      { value: "t1", label: "Ana Pérez" },
      { value: "t2", label: "Luis Gómez" },
    ]);
    expect(o.clientes.map((c) => c.value)).toEqual(["c1", "c2"]);
    expect(o.tipos.map((t) => t.value)).toEqual(["CONVENCIONAL", "CT", "MAMOGRAFO"]);
    expect(o.tipos[0].label).toBe("Convencional");
    // "Bogotá" y "bogota" son la misma ciudad
    expect(o.ciudades.map((c) => c.value)).toEqual(["Bogotá", "Medellín"]);
  });
});

describe("agruparVisitasPorEstado", () => {
  it("una columna por estado en el orden de ESTADO_ORDER", () => {
    const g = agruparVisitasPorEstado(filas);
    expect(g.map((c) => c.estado)).toEqual(ESTADO_ORDER);
    expect(g.find((c) => c.estado === "en_revision")?.items).toEqual([]);
    expect(ids(g.find((c) => c.estado === "aprobada")!.items)).toEqual(["3"]);
  });
});
