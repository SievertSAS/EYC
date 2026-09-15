import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import {
  recopilarDatosConv,
  renderResultadosSeccion,
  type DatosConvencional,
  type InformeCtx,
} from "./secciones-convencional";

// Las filas conv_* tienen muchos campos obligatorios que no importan acá;
// `row()` afloja el tipado para armar fixtures mínimos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const row = <T>(o: Partial<T> & Record<string, unknown>) => o as any;

// recopilarDatosConv es el CONTRATO DE DATOS del PDF convencional: qué
// tablas conv_* lee y cómo. Los render*() dibujan sobre eso.

beforeEach(async () => {
  await resetTestDb();
});

const V = "visita-test";
const del = { deleted_at: "2026-01-01T00:00:00Z", sync_status: "synced", last_modified: "x" };
const ok = { sync_status: "synced", last_modified: "x" };

describe("recopilarDatosConv — carga de tablas", () => {
  it("visita vacía → estructura con arrays vacíos y catálogo de secciones por defecto", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.mediciones).toEqual([]);
    expect(d.raysafeMediciones).toEqual([]);
    expect(d.caeMediciones).toEqual([]);
    expect(d.secciones).toHaveLength(21);
    expect(d.secciones.every((s) => s.incluida)).toBe(true);
  });

  it("usa conv_informe_secciones cuando existen (respeta el toggle 'incluida')", async () => {
    await db.conv_informe_secciones.bulkAdd([
      row({ id: "s1", visita_id: V, prueba_codigo: "2.1", orden: 1, incluida: true }),
      row({ id: "s2", visita_id: V, prueba_codigo: "2.2", orden: 2, incluida: false }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.secciones).toHaveLength(2);
    expect(d.secciones.find((s) => s.prueba_codigo === "2.2")?.incluida).toBe(false);
  });

  it("dedupe de conv_inspeccion_items por (seccion, item_numero) — gana la que tiene concepto", async () => {
    await db.conv_inspeccion_items.bulkAdd([
      row({ id: "i1", visita_id: V, seccion: "equipo", item_numero: 1 }),
      row({ id: "i2", visita_id: V, seccion: "equipo", item_numero: 1, concepto: "Conforme" }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.inspeccion).toHaveLength(1);
    expect(d.inspeccion[0].concepto).toBe("Conforme");
  });
});

describe("recopilarDatosConv — filtra deleted_at en TODAS las lecturas conv_* (#51)", () => {
  it("conv_mediciones filtra deleted_at", async () => {
    await db.conv_mediciones.bulkAdd([
      row({ id: "m1", visita_id: V, punto_numero: 1, ...ok }),
      row({ id: "m2", visita_id: V, punto_numero: 2, ...del }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.mediciones.map((m) => m.id)).toEqual(["m1"]);
  });

  it("conv_raysafe_mediciones filtra deleted_at (la fila borrada NO llega al PDF)", async () => {
    await db.conv_raysafe_mediciones.bulkAdd([
      row({ id: "r1", visita_id: V, toma_numero: 1, ...ok }),
      row({ id: "r2", visita_id: V, toma_numero: 2, ...del }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.raysafeMediciones.map((r) => r.id)).toEqual(["r1"]);
  });

  it("conv_cae_mediciones y conv_ddi_mediciones filtran deleted_at", async () => {
    await db.conv_cae_mediciones.bulkAdd([
      row({ id: "c0", visita_id: V, toma_numero: 0, ...ok }),
      row({ id: "c1", visita_id: V, toma_numero: 1, ...del }),
    ]);
    await db.conv_ddi_mediciones.bulkAdd([
      row({ id: "dd0", visita_id: V, grupo: 1, toma_numero: 0, ...ok }),
      row({ id: "dd1", visita_id: V, grupo: 1, toma_numero: 1, ...del }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.caeMediciones.map((m) => m.id)).toEqual(["c0"]);
    expect(d.ddiMediciones.map((m) => m.id)).toEqual(["dd0"]);
  });

  it("conv_inspeccion_items filtra deleted_at", async () => {
    await db.conv_inspeccion_items.bulkAdd([
      row({
        id: "i1",
        visita_id: V,
        seccion: "equipo",
        item_numero: 1,
        concepto: "Conforme",
        ...ok,
      }),
      row({
        id: "i2",
        visita_id: V,
        seccion: "equipo",
        item_numero: 2,
        concepto: "Conforme",
        ...del,
      }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.inspeccion.map((i) => i.id)).toEqual(["i1"]);
  });
});

// ─── #111: reporta_di/reporta_tei ocultan columnas en 2.9/2.10/2.15 ───

const visitaFixture = row({ id: V, estado_visita: "asignada" });

interface TablaCapturada {
  head: unknown[];
  body: unknown[][];
}

/** Ctx real (jsPDF + autoTable) que además captura head/body de cada tabla dibujada. */
async function ctxConTablasCapturadas(): Promise<{ ctx: InformeCtx; tablas: TablaCapturada[] }> {
  const [{ jsPDF }, { default: autoTableReal }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const tablas: TablaCapturada[] = [];
  const autoTable: typeof autoTableReal = (d, opts) => {
    tablas.push({
      head: (opts.head?.[0] as unknown[]) ?? [],
      body: (opts.body as unknown[][]) ?? [],
    });
    return autoTableReal(d, opts);
  };
  let y = 20;
  const ctx: InformeCtx = {
    doc,
    autoTable,
    get y() {
      return y;
    },
    set y(v: number) {
      y = v;
    },
    checkPage: () => {},
    addParagraph: () => {},
    addSubsectionTitle: () => {},
  };
  return { ctx, tablas };
}

describe("2.9/2.10/2.15 — columnas D.I./TEI ocultas según reporta_di/reporta_tei del equipo (#111)", () => {
  it("2.9: reporta_di=false → la tabla de análisis (Tabla 2.9.2) no incluye la fila D.I.", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.reporta_di = false;
    conv.ddiMediciones = [
      row({ id: "dd0", visita_id: V, grupo: 1, toma_numero: 1, ei: 100, ei_base: 100 }),
    ];
    renderResultadosSeccion(ctx, "2.9", visitaFixture, conv, undefined);
    const tabla292 = tablas.find((t) => t.head.includes("Parámetro"));
    expect(tabla292).toBeDefined();
    expect(tabla292!.body.map((f) => f[0])).toEqual(["EI"]);
  });

  it("2.9: sin flag (default true) → la tabla de análisis incluye EI y D.I.", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.ddiMediciones = [
      row({ id: "dd0", visita_id: V, grupo: 1, toma_numero: 1, ei: 100, ei_base: 100 }),
    ];
    renderResultadosSeccion(ctx, "2.9", visitaFixture, conv, undefined);
    const tabla292 = tablas.find((t) => t.head.includes("Parámetro"));
    expect(tabla292!.body.map((f) => f[0])).toEqual(["EI", "D.I."]);
  });

  it("2.15: reporta_di=false y reporta_tei=false → el header de la tabla no incluye esas columnas", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.reporta_di = false;
    conv.reporta_tei = false;
    conv.uniformidadCr = [row({ id: "u1", visita_id: V, ei: 100, serie_cassette: "S1" })];
    renderResultadosSeccion(ctx, "2.15", visitaFixture, conv, undefined);
    const tablaUniformidad = tablas.find((t) => t.head.includes("Serie cassette"));
    expect(tablaUniformidad).toBeDefined();
    expect(tablaUniformidad!.head).not.toContain("D.I.");
    expect(tablaUniformidad!.head).not.toContain("TEI");
  });

  it("2.15: sin flags (default true) → el header incluye D.I. y TEI", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.uniformidadCr = [row({ id: "u1", visita_id: V, ei: 100, serie_cassette: "S1" })];
    renderResultadosSeccion(ctx, "2.15", visitaFixture, conv, undefined);
    const tablaUniformidad = tablas.find((t) => t.head.includes("Serie cassette"));
    expect(tablaUniformidad!.head).toContain("D.I.");
    expect(tablaUniformidad!.head).toContain("TEI");
  });

  it("2.9: reporta_di=false → la Tabla 2.9.1 (medición) no incluye la columna D.I. (#112)", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.reporta_di = false;
    conv.ddiMediciones = [
      row({ id: "dd0", visita_id: V, grupo: 1, toma_numero: 1, kv_nominal: 70, ei: 100, di: 4.5 }),
    ];
    renderResultadosSeccion(ctx, "2.9", visitaFixture, conv, undefined);
    const tabla291 = tablas.find((t) => t.head.includes("Tensión (kVp)"));
    expect(tabla291).toBeDefined();
    expect(tabla291!.head).toEqual(["Tensión (kVp)", "Carga (mAs)", "EI"]);
  });

  it("2.9: sin flag (default true) → la Tabla 2.9.1 incluye D.I. (#112)", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.ddiMediciones = [
      row({ id: "dd0", visita_id: V, grupo: 1, toma_numero: 1, kv_nominal: 70, ei: 100, di: 4.5 }),
    ];
    renderResultadosSeccion(ctx, "2.9", visitaFixture, conv, undefined);
    const tabla291 = tablas.find((t) => t.head.includes("Tensión (kVp)"));
    expect(tabla291!.head).toEqual(["Tensión (kVp)", "Carga (mAs)", "EI", "D.I."]);
    expect(tabla291!.body[0]).toEqual(["70", "—", "100", "4,50"]);
  });
});

// ─── #113: conversión de unidad DAP/Kerma en 2.7/2.8/2.21 ───

describe("2.7/2.8/2.21 — conversión de unidad según unidad_dap/unidad_kerma del setup (#113)", () => {
  it("2.7: unidad_kerma=ugy → el kerma promedio y el rendimiento se normalizan a mGy", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeSetup = row({ id: "s1", visita_id: V, unidad_kerma: "ugy" });
    // 5000 µGy == 5 mGy — equivalente a haber ingresado "5" directo en mGy.
    conv.raysafeMediciones = [
      row({
        id: "m1",
        visita_id: V,
        tipo_medicion: "principal",
        kv_nominal: 80,
        grupo_numero: 2,
        mas_nominal: 10,
        toma_numero: 1,
        dosis_medida_mgy: 5000,
      }),
    ];
    renderResultadosSeccion(ctx, "2.7", visitaFixture, conv, undefined);
    const tabla271 = tablas.find((t) => t.head.includes("Kerma en aire promedio (mGy)"));
    expect(tabla271).toBeDefined();
    // kermaProm = 5 mGy; rendimiento = (5/10)*1000 = 500 µGy/mAs
    expect(tabla271!.body[0][1]).toBe("5,000");
    expect(tabla271!.body[0][2]).toBe("500,0");
  });

  it("2.8: unidad_dap=ugy_cm2 y unidad_kerma=ugy → factor de corrección correcto tras normalizar ambos", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeSetup = row({
      id: "s1",
      visita_id: V,
      unidad_dap: "ugy_cm2",
      unidad_kerma: "ugy",
    });
    conv.raysafeMediciones = [
      row({
        id: "m1",
        visita_id: V,
        tipo_medicion: "kerma",
        toma_numero: 1,
        kv_nominal: 70,
        mas_nominal: 10,
        // 500 µGy == 0,5 mGy; distancias por defecto (d1=d2=100) → factorDist=1
        dosis_medida_mgy: 500,
        ancho_irradiacion_cm: 10,
        largo_irradiacion_cm: 10,
        // dapEst = 0,5 mGy * 100 cm² = 50 mGy·cm²; 50 000 µGy·cm² == 50 mGy·cm²
        dap_nominal: 50000,
      }),
    ];
    renderResultadosSeccion(ctx, "2.8", visitaFixture, conv, undefined);
    const tabla281 = tablas.find((t) => t.head.includes("Factor de corrección"));
    expect(tabla281).toBeDefined();
    const [, , dapNom, dapEst, fc] = tabla281!.body[0];
    expect(dapNom).toBe("50,00");
    expect(dapEst).toBe("50,00");
    expect(fc).toBe("1,0");
  });

  it("2.8: sin unidad configurada → mismo resultado que antes (comportamiento actual)", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeMediciones = [
      row({
        id: "m1",
        visita_id: V,
        tipo_medicion: "kerma",
        toma_numero: 1,
        kv_nominal: 70,
        mas_nominal: 10,
        dosis_medida_mgy: 0.5,
        ancho_irradiacion_cm: 10,
        largo_irradiacion_cm: 10,
        dap_nominal: 50,
      }),
    ];
    renderResultadosSeccion(ctx, "2.8", visitaFixture, conv, undefined);
    const tabla281 = tablas.find((t) => t.head.includes("Factor de corrección"));
    const [, , dapNom, dapEst, fc] = tabla281!.body[0];
    expect(dapNom).toBe("50,00");
    expect(dapEst).toBe("50,00");
    expect(fc).toBe("1,0");
  });
});

// ─── #117: montaje/patrón de 2.3 reutilizados en 2.12/2.13 ───

describe("recopilarDatosConv — fotos212/fotos213 reutilizan evidencias de 2.3 (#117)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 10, height: 10, close: () => {} })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["x"], { type: "image/jpeg" }),
      })
    );
  });

  it("montaje_colimacion de 2.3 aparece también en fotos212", async () => {
    await db.conv_evidencias.add(
      row({
        id: "ev-montaje",
        visita_id: V,
        prueba_codigo: "2.3",
        slot: "montaje_colimacion",
        url_storage: "https://example.com/montaje.jpg",
        ...ok,
      })
    );
    const d = await recopilarDatosConv(V);
    expect(d.fotos212?.some((f) => f.label === "Foto montaje experimental")).toBe(true);
  });

  it("patron_colimacion de 2.3 aparece también en fotos213", async () => {
    await db.conv_evidencias.add(
      row({
        id: "ev-patron",
        visita_id: V,
        prueba_codigo: "2.3",
        slot: "patron_colimacion",
        url_storage: "https://example.com/patron.jpg",
        ...ok,
      })
    );
    const d = await recopilarDatosConv(V);
    expect(d.fotos213?.some((f) => f.label === "Patrón de bajo contraste")).toBe(true);
  });

  it("sin foto en 2.3 → fotos212/fotos213 quedan vacías (no hay fallback a slots viejos)", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.fotos212).toEqual([]);
    expect(d.fotos213).toEqual([]);
  });
});

describe("recopilarDatosConv — fotos216 (curvas MTF + objeto borde) (#118)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 10, height: 10, close: () => {} })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["x"], { type: "image/jpeg" }),
      })
    );
  });

  it("arma fotos216 en orden: MTF Horizontal, Objeto borde, MTF vertical", async () => {
    await db.conv_evidencias.bulkAdd([
      row({
        id: "ev-curva-v",
        visita_id: V,
        prueba_codigo: "2.16",
        slot: "curva_mtf_vertical",
        url_storage: "https://example.com/curva-v.jpg",
        ...ok,
      }),
      row({
        id: "ev-dicom",
        visita_id: V,
        prueba_codigo: "2.16",
        slot: "dicom_mtf",
        url_storage: "https://example.com/dicom.jpg",
        ...ok,
      }),
      row({
        id: "ev-curva-h",
        visita_id: V,
        prueba_codigo: "2.16",
        slot: "curva_mtf_horizontal",
        url_storage: "https://example.com/curva-h.jpg",
        ...ok,
      }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.fotos216?.map((f) => f.label)).toEqual([
      "MTF Horizontal",
      "Objeto borde",
      "MTF vertical",
    ]);
  });

  it("sin ninguna evidencia → fotos216 queda vacío", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.fotos216).toEqual([]);
  });
});
