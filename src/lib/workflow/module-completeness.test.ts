import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import {
  getModuleStatuses,
  getVisitCompleteness,
  getVisitCompletenessBulk,
  getCamposFaltantesInfo,
} from "./module-completeness";

// module-completeness decide si una visita puede avanzar ("enviar a revisión").
// Tests con una base sembrada real (conv_* vía Dexie).

const CODIGOS = [
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "2.5",
  "2.6",
  "2.7",
  "2.8",
  "2.9",
  "2.10",
  "2.11",
  "2.12",
  "2.13",
  "2.14",
  "2.15",
  "2.16",
  "2.17",
  "2.18",
  "2.19",
  "2.20",
  "2.21",
];

async function excluirTodasLasSecciones(visitaId: string) {
  // incluida: false → getEstadoPruebasPorGrupo trata cada prueba como resuelta.
  await db.conv_informe_secciones.bulkAdd(
    CODIGOS.map((codigo, i) => ({
      id: `${visitaId}-${codigo}`,
      visita_id: visitaId,
      prueba_codigo: codigo,
      orden: i + 1,
      incluida: false,
      sync_status: "synced" as const,
      last_modified: new Date().toISOString(),
    }))
  );
}

describe("module-completeness — visita CONVENCIONAL", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("visita recién creada (sin datos conv_*) → grupos requeridos bloquean", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const status = await getModuleStatuses(visita!.id!);
    expect(status["grupo-a"].status).toBe("sin_iniciar");

    const comp = await getVisitCompleteness(visita!.id!);
    // grupo-a/b/d/e son requeridos en MODULOS_CONVENCIONAL
    expect(comp.blocking).toEqual(
      expect.arrayContaining(["grupo-a", "grupo-b", "grupo-d", "grupo-e"])
    );
    expect(comp.percentage).toBeLessThan(100);
  });

  it("todas las secciones excluidas del informe → nada bloquea", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await excluirTodasLasSecciones(visita!.id!);

    const comp = await getVisitCompleteness(visita!.id!);
    expect(comp.blocking).toEqual([]);
    expect(comp.percentage).toBe(100);
  });

  it("visita inexistente → estructura vacía, sin bloqueos", async () => {
    expect(await getModuleStatuses("no-existe")).toEqual({});
    const comp = await getVisitCompleteness("no-existe");
    expect(comp).toMatchObject({ total: 0, completed: 0, blocking: [] });
  });
});

describe("module-completeness — hallazgo #7 (visita sin paquete)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("PIN: equipo de tipo sin paquete → módulos default nunca coinciden con getModuleStatuses → bloqueo permanente", async () => {
    // El guard de registry (Tier 3) impide crear estas visitas; si igual
    // existiera una, getVisitCompleteness la deja bloqueada para siempre.
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { tipo_equipo: "CT" });

    const comp = await getVisitCompleteness(visita!.id!);
    // getDefaultModules ids (condiciones/levantamiento/pruebas) no están en
    // progressMap → todos sin_iniciar → los requeridos bloquean.
    expect(comp.blocking).toEqual(
      expect.arrayContaining(["condiciones", "levantamiento", "pruebas"])
    );
  });
});

describe("module-completeness — #15 getVisitCompletenessBulk", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("PIN: es un loop secuencial de getVisitCompleteness (no una versión batch)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
      ids.push(visita!.id!);
    }

    const map = await getVisitCompletenessBulk(ids);
    expect(map.size).toBe(3);
    for (const id of ids) {
      expect(map.get(id)?.blocking.length).toBeGreaterThan(0);
    }
    // El costo es O(visitas × ~15 scans conv_*). Optimización → issue.
  });

  it("lista vacía → Map vacío", async () => {
    expect((await getVisitCompletenessBulk([])).size).toBe(0);
  });
});

describe("module-completeness — #65 getCamposFaltantesInfo", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("lista los campos de Info vacíos con su etiqueta y sección de origen", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const v = await db.visitas.get(visita!.id!);
    const faltantes = await getCamposFaltantesInfo(v!);
    const campos = faltantes.map((f) => f.campo);

    // el seed NO trae estos → deben aparecer
    expect(campos).toContain("ubicacion.licencia");
    expect(campos).toContain("equipo.sistema_adquisicion");
    // el seed SÍ trae estos → NO deben aparecer
    expect(campos).not.toContain("cliente.nombre_cliente");
    expect(campos).not.toContain("equipo.gen_marca");

    const lic = faltantes.find((f) => f.campo === "ubicacion.licencia")!;
    expect(lic.seccion).toBe("Datos de la Instalación");
    expect(lic.modulo).toBe("info");
    expect(lic.label.length).toBeGreaterThan(0);
  });

  it("con toda la Información General cargada → lista vacía", async () => {
    const { visita, cliente, ubicacion, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.clientes.update(cliente.id!, {
      telefono: "3001234567",
      naturaleza: "privado",
      nombre_representante_legal: "Rep Legal",
    });
    await db.ubicaciones_rx.update(ubicacion.id!, { licencia: "L-1", codigo_habilitacion: "H-1" });
    await db.equipos.update(equipo.id!, {
      gen_fase: "monofasico",
      sistema_adquisicion: "Digital",
      distancia_foco_paciente: 100,
      filtracion_inherente_mmal: 2,
      filtracion_anadida_mmal: 1,
      parametros_consola: ["kv", "mas"],
    });
    const tubo = await db.tubos.where("equipo_id").equals(equipo.id!).first();
    await db.tubos.update(tubo!.id!, { kv_max: 120, ma_max: 500 });
    await db.visitas.update(visita!.id!, { fecha_visita: "2026-01-15" });

    const v = await db.visitas.get(visita!.id!);
    expect(await getCamposFaltantesInfo(v!)).toEqual([]);
  });
});

describe("module-completeness — #188 ubicaciones del portátil", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  async function camposDe(
    tipoInstalacion: "fijo" | "portatil",
    visitaPatch: Record<string, unknown> = {}
  ): Promise<string[]> {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { tipo_instalacion: tipoInstalacion });
    await db.visitas.update(visita!.id!, visitaPatch);
    const v = await db.visitas.get(visita!.id!);
    return (await getCamposFaltantesInfo(v!)).map((f) => f.campo);
  }

  it("portátil sin categoría → falta la categoría de ubicación", async () => {
    const campos = await camposDe("portatil");
    expect(campos).toContain("visita.categoria_ubicacion");
    expect(campos).not.toContain("visita.ubicaciones_flotantes");
  });

  it("portátil flotante sin áreas → faltan las áreas flotantes", async () => {
    for (const ubicaciones_flotantes of [undefined, []]) {
      await resetTestDb();
      const campos = await camposDe("portatil", {
        categoria_ubicacion: "flotante",
        ubicaciones_flotantes,
      });
      expect(campos).toContain("visita.ubicaciones_flotantes");
      expect(campos).not.toContain("visita.categoria_ubicacion");
    }
  });

  it("portátil flotante con áreas sin descripción → falta la descripción (también datos viejos)", async () => {
    for (const ubicaciones_flotantes of [
      ["UCI adultos"],
      [
        { nombre: "UCI adultos", descripcion: "Cama 3" },
        { nombre: "Urgencias", descripcion: "   " },
      ],
    ]) {
      await resetTestDb();
      const campos = await camposDe("portatil", {
        categoria_ubicacion: "flotante",
        ubicaciones_flotantes,
      });
      expect(campos).toContain("visita.ubicaciones_flotantes.descripcion");
      expect(campos).not.toContain("visita.ubicaciones_flotantes");
    }
  });

  it("portátil flotante sin áreas → no pide descripción (solo las áreas)", async () => {
    const campos = await camposDe("portatil", { categoria_ubicacion: "flotante" });
    expect(campos).not.toContain("visita.ubicaciones_flotantes.descripcion");
  });

  it("portátil flotante con áreas descritas, o en sala fija → nada que reportar de ubicación", async () => {
    const flot = await camposDe("portatil", {
      categoria_ubicacion: "flotante",
      ubicaciones_flotantes: [{ nombre: "UCI adultos", descripcion: "Cama 3" }],
    });
    expect(flot.filter((c) => c.startsWith("visita.") && c !== "visita.fecha_visita")).toEqual([]);
    await resetTestDb();
    const fija = await camposDe("portatil", { categoria_ubicacion: "fija" });
    expect(fija).not.toContain("visita.categoria_ubicacion");
    expect(fija).not.toContain("visita.ubicaciones_flotantes");
  });

  it("equipo fijo: no se le pide categoría (sin cambios)", async () => {
    const campos = await camposDe("fijo");
    expect(campos).not.toContain("visita.categoria_ubicacion");
    expect(campos).not.toContain("visita.ubicaciones_flotantes");
  });

  it("la categoría faltante baja el % del módulo Info del portátil", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const antes = (await getModuleStatuses(visita!.id!)).info.percentage;
    await db.equipos.update(equipo.id!, { tipo_instalacion: "portatil" });
    const despues = (await getModuleStatuses(visita!.id!)).info.percentage;
    expect(despues).toBeLessThan(antes);
    await db.visitas.update(visita!.id!, { categoria_ubicacion: "fija" });
    expect((await getModuleStatuses(visita!.id!)).info.percentage).toBeGreaterThan(despues);
  });
});

describe("module-completeness — #189 parámetros nominales de la consola", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  const CAMPO = "equipo.parametros_consola";

  async function faltantesCon(
    tipoEquipo: "CONVENCIONAL" | "MAMOGRAFO",
    parametros_consola: unknown
  ) {
    const { visita, equipo } = await seedGraph({ tipoEquipo });
    await db.equipos.update(equipo.id!, {
      parametros_consola: parametros_consola as ("kv" | "ma")[] | null | undefined,
    });
    const v = await db.visitas.get(visita!.id!);
    return getCamposFaltantesInfo(v!);
  }

  it("CONVENCIONAL sin definir (null, undefined o []) → falta, en Colimador y Sistema de Adquisición", async () => {
    for (const valor of [null, undefined, []]) {
      await resetTestDb();
      const faltantes = await faltantesCon("CONVENCIONAL", valor);
      const f = faltantes.find((x) => x.campo === CAMPO);
      expect(f, `valor ${JSON.stringify(valor)}`).toBeDefined();
      expect(f!.label).toBe("Parámetros nominales que muestra la consola");
      expect(f!.seccion).toBe("Colimador y Sistema de Adquisición");
    }
  });

  it("CONVENCIONAL con al menos un parámetro → no falta", async () => {
    const faltantes = await faltantesCon("CONVENCIONAL", ["ma"]);
    expect(faltantes.map((f) => f.campo)).not.toContain(CAMPO);
  });

  it("también se exige al portátil (es un CONVENCIONAL)", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { tipo_instalacion: "portatil" });
    const v = await db.visitas.get(visita!.id!);
    expect((await getCamposFaltantesInfo(v!)).map((f) => f.campo)).toContain(CAMPO);
  });

  it("otros tipos de equipo no lo requieren", async () => {
    const faltantes = await faltantesCon("MAMOGRAFO", null);
    expect(faltantes.map((f) => f.campo)).not.toContain(CAMPO);
  });

  it("marcar un parámetro sube el % del módulo Info", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const antes = (await getModuleStatuses(visita!.id!)).info.percentage;
    await db.equipos.update(equipo.id!, { parametros_consola: ["kv"] });
    expect((await getModuleStatuses(visita!.id!)).info.percentage).toBeGreaterThan(antes);
  });
});
