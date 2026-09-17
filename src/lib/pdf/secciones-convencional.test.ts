import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import {
  recopilarDatosConv,
  renderResultadosSeccion,
  renderTablaBaseRef216,
  type DatosConvencional,
  type InformeCtx,
} from "./secciones-convencional";
import { evaluarConceptoPrueba, type DatosEvalConv } from "@/lib/equipos/convencional/evaluacion";

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

  it("montaje_colimacion de 2.3 también aparece en fotos213, antes del patrón (igual que en fotos212)", async () => {
    await db.conv_evidencias.bulkAdd([
      row({
        id: "ev-montaje-213",
        visita_id: V,
        prueba_codigo: "2.3",
        slot: "montaje_colimacion",
        url_storage: "https://example.com/montaje.jpg",
        ...ok,
      }),
      row({
        id: "ev-patron-213",
        visita_id: V,
        prueba_codigo: "2.3",
        slot: "patron_colimacion",
        url_storage: "https://example.com/patron.jpg",
        ...ok,
      }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.fotos213?.map((f) => f.label)).toEqual([
      "Foto montaje experimental",
      "Patrón de bajo contraste",
    ]);
  });

  it("sin foto en 2.3 → fotos212/fotos213 quedan vacías (no hay fallback a slots viejos)", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.fotos212).toEqual([]);
    expect(d.fotos213).toEqual([]);
  });
});

describe("#121 — contrato cruzado: el % de CV del texto de 2.15 coincide con el concepto de evaluacion.ts", () => {
  async function ctxConTextoCapturado(): Promise<{ ctx: InformeCtx; parrafos: string[] }> {
    const [{ jsPDF }, { default: autoTableReal }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const parrafos: string[] = [];
    let y = 20;
    const ctx: InformeCtx = {
      doc,
      autoTable: autoTableReal,
      get y() {
        return y;
      },
      set y(v: number) {
        y = v;
      },
      checkPage: () => {},
      addParagraph: (texto: string) => {
        parrafos.push(texto);
      },
      addSubsectionTitle: () => {},
    };
    return { ctx, parrafos };
  }

  it("CV<=10% → concepto 'Conforme' y el texto muestra el mismo % (dentro del criterio)", async () => {
    const eiValues = [98, 99, 100, 101, 102]; // CV ≈ 1.58 %, dentro de tolerancia
    const filas = eiValues.map((ei, i) => row({ id: `u${i}`, visita_id: V, ei }));

    const { ctx, parrafos } = await ctxConTextoCapturado();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.uniformidadCr = filas;
    renderResultadosSeccion(ctx, "2.15", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    const match = texto.match(/coeficiente de variación de ([\d,.]+) %/);
    expect(match).not.toBeNull();
    const cvTexto = parseFloat(match![1].replace(",", "."));

    const datosEval: DatosEvalConv = {
      mediciones: [],
      inspeccion: [],
      elementos: [],
      raysafeMediciones: [],
      ddiMediciones: [],
      uniformidadDetector: [],
      cassettes: [],
      uniformidadCr: filas,
      caeMediciones: [],
    };
    const concepto = evaluarConceptoPrueba("2.15", datosEval);

    expect(concepto).toBe("Conforme");
    expect(cvTexto).toBeLessThanOrEqual(10);
    expect(texto).toContain("dentro del criterio de aceptación");
  });

  it("CV>10% → concepto 'No_conforme' y el texto muestra el mismo % (supera el criterio)", async () => {
    const eiValues = [80, 100, 120, 90, 110]; // CV bien por encima de 10%
    const filas = eiValues.map((ei, i) => row({ id: `u${i}`, visita_id: V, ei }));

    const { ctx, parrafos } = await ctxConTextoCapturado();
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.uniformidadCr = filas;
    renderResultadosSeccion(ctx, "2.15", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    const match = texto.match(/coeficiente de variación de ([\d,.]+) %/);
    expect(match).not.toBeNull();
    const cvTexto = parseFloat(match![1].replace(",", "."));

    const datosEval: DatosEvalConv = {
      mediciones: [],
      inspeccion: [],
      elementos: [],
      raysafeMediciones: [],
      ddiMediciones: [],
      uniformidadDetector: [],
      cassettes: [],
      uniformidadCr: filas,
      caeMediciones: [],
    };
    const concepto = evaluarConceptoPrueba("2.15", datosEval);

    expect(concepto).toBe("No_conforme");
    expect(cvTexto).toBeGreaterThan(10);
    expect(texto).toContain("supera el criterio de aceptación");
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

describe("recopilarDatosConv — fotos221 (montaje RaySafe, no el montaje CAE de 2.17)", () => {
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

  it("2.21.7 usa la foto de montaje_raysafe de 2.4, no la de montaje_cae de 2.17", async () => {
    await db.conv_evidencias.bulkAdd([
      row({
        id: "ev-raysafe",
        visita_id: V,
        prueba_codigo: "2.4",
        slot: "montaje_raysafe",
        url_storage: "https://example.com/raysafe.jpg",
        ...ok,
      }),
      row({
        id: "ev-cae",
        visita_id: V,
        prueba_codigo: "2.17",
        slot: "montaje_cae",
        url_storage: "https://example.com/cae.jpg",
        ...ok,
      }),
    ]);
    const d = await recopilarDatosConv(V);
    expect(d.fotos221).toHaveLength(1);
    expect(d.fotos221?.[0].label).toBe("Implementación de instrumentación en la prueba");
    expect(d.fotos221?.[0].label).not.toContain("CAE");
  });

  it("sin evidencia de montaje_raysafe → fotos221 queda vacío", async () => {
    const d = await recopilarDatosConv(V);
    expect(d.fotos221).toEqual([]);
  });
});

describe("2.16 — Análisis (texto fijo) y tabla de valores base de referencia MTF", () => {
  const mtfBase = {
    sid_cm: 100,
    kv_referencia: 70,
    pixel_size_mm: 0.14,
    nyquist_lpmm: 3.57,
    mtf50_horizontal: 1.2,
    mtf20_horizontal: 2.1,
    mtf50_vertical: 1.15,
    mtf20_vertical: 2.05,
  };

  it("el 'Análisis' es texto fijo, igual con o sin valores base de referencia", async () => {
    const [{ jsPDF }, { default: autoTableReal }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const parrafos: string[] = [];
    let y = 20;
    const ctx: InformeCtx = {
      doc,
      autoTable: autoTableReal,
      get y() {
        return y;
      },
      set y(v: number) {
        y = v;
      },
      checkPage: () => {},
      addParagraph: (texto: string) => {
        parrafos.push(texto);
      },
      addSubsectionTitle: () => {},
    };

    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.mtf = row({ ...mtfBase });
    renderResultadosSeccion(ctx, "2.16", visitaFixture, conv, undefined);
    const textoSinBase = parrafos.join(" ");

    parrafos.length = 0;
    conv.mtf = row({
      ...mtfBase,
      mtf50_base_horizontal: 1.3,
      mtf20_base_horizontal: 2.2,
      mtf50_base_vertical: 1.25,
      mtf20_base_vertical: 2.15,
    });
    renderResultadosSeccion(ctx, "2.16", visitaFixture, conv, undefined);
    const textoConBase = parrafos.join(" ");

    const textoEsperado =
      "Las curvas de MTF obtenidas presentan un comportamiento decreciente con el aumento de la frecuencia espacial, lo cual es característico de los sistemas de radiografía digital. " +
      "Las frecuencias espaciales correspondientes a MTF50 y MTF20 permiten caracterizar la capacidad del detector para reproducir detalles espaciales en las direcciones horizontal y vertical. " +
      "Los valores obtenidos son consistentes con el desempeño esperado para detectores digitales de radiografía general.";

    expect(textoSinBase).toContain(textoEsperado);
    expect(textoConBase).toContain(textoEsperado);
    expect(textoConBase).not.toMatch(/variación máxima/);
  });

  it("renderTablaBaseRef216 muestra los valores base reales cuando existen", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();

    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.mtf = row({
      ...mtfBase,
      mtf50_base_horizontal: 1.3,
      mtf20_base_horizontal: 2.2,
      mtf50_base_vertical: 1.25,
      mtf20_base_vertical: 2.15,
    });
    renderTablaBaseRef216(ctx, conv);

    const tablaBase = tablas.find((t) => t.head.includes("MTF50 (lp/mm)"));
    expect(tablaBase).toBeDefined();
    expect(tablaBase!.body).toEqual([
      ["Horizontal", "1,30", "2,20"],
      ["Vertical", "1,25", "2,15"],
    ]);
  });

  it("renderTablaBaseRef216 muestra '—' cuando no hay valores base", async () => {
    const { ctx, tablas } = await ctxConTablasCapturadas();

    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.mtf = row({ ...mtfBase });
    renderTablaBaseRef216(ctx, conv);

    const tablaBase = tablas.find((t) => t.head.includes("MTF50 (lp/mm)"));
    expect(tablaBase!.body).toEqual([
      ["Horizontal", "—", "—"],
      ["Vertical", "—", "—"],
    ]);
  });
});

describe("2.17-2.21 — 'Análisis' del CAE cita el veredicto real, no un texto fijo de 'conforme'", () => {
  async function ctxConTextoCapturado(): Promise<{ ctx: InformeCtx; parrafos: string[] }> {
    const [{ jsPDF }, { default: autoTableReal }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const parrafos: string[] = [];
    let y = 20;
    const ctx: InformeCtx = {
      doc,
      autoTable: autoTableReal,
      get y() {
        return y;
      },
      set y(v: number) {
        y = v;
      },
      checkPage: () => {},
      addParagraph: (texto: string) => {
        parrafos.push(texto);
      },
      addSubsectionTitle: () => {},
    };
    return { ctx, parrafos };
  }

  it("2.17: variación > 50 % vs base → el párrafo dice 'No conforme', no 'respuesta estable'", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.caeSetup = row({ id: "s1", visita_id: V, mas_base_217: 4, ei_base_217: 100 });
    conv.caeMediciones = [row({ id: "m9", visita_id: V, toma_numero: 9, carga_mas: 10, ei: 100 })];

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.17", visitaFixture, conv, undefined);
    const texto = parrafos.join(" ");

    expect(texto).toContain("superan la tolerancia del 50 %");
    expect(texto).not.toContain("respuesta estable");
  });

  it("2.18: rango > 30 % entre sensores → el párrafo dice inconsistencia, no 'consistencia'", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.caeMediciones = [2, 3, 4, 5, 6, 7, 8].map((toma_numero, i) =>
      row({
        id: `m${i}`,
        visita_id: V,
        toma_numero,
        carga_mas: toma_numero === 8 ? 20 : 4,
      })
    );

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.18", visitaFixture, conv, undefined);
    const texto = parrafos.join(" ");

    expect(texto).toContain("evidencia inconsistencia");
    expect(texto).not.toContain("Lo anterior evidencia consistencia");
  });

  it("2.19: CV > 10 % entre repeticiones → el párrafo dice 'poco repetible', no 'repetible'", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.caeMediciones = [3, 9, 10, 11, 12].map((toma_numero, i) =>
      row({
        id: `m${i}`,
        visita_id: V,
        toma_numero,
        carga_mas: toma_numero === 12 ? 20 : 4,
      })
    );

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.19", visitaFixture, conv, undefined);
    const texto = parrafos.join(" ");

    expect(texto).toContain("una respuesta poco repetible");
    expect(texto).not.toContain("una respuesta repetible del sistema");
  });

  it("2.20: variación > 30 % vs base (kVp/espesor) → el párrafo dice compensación inadecuada", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.caeSetup = row({ id: "s1", visita_id: V, mas_base_60kv: 4 });
    conv.caeMediciones = [row({ id: "m1", visita_id: V, toma_numero: 1, carga_mas: 10 })];

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.20", visitaFixture, conv, undefined);
    const texto = parrafos.join(" ");

    expect(texto).toContain("compensación inadecuada");
    expect(texto).not.toContain("adecuada compensación");
  });

  it("2.21: diferencia ≥ 0,01 mGy vs base → el párrafo dice variación significativa, no estabilidad", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeMediciones = [
      row({
        id: "m1",
        visita_id: V,
        tipo_medicion: "sin_rejilla",
        programa_clinico: "Tórax",
        kv_nominal: 70,
        mas_nominal: 4,
        dosis_medida_mgy: 0.5,
        dosis_base_mgy: 0.1,
      }),
    ];

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.21", visitaFixture, conv, undefined);
    const texto = parrafos.join(" ");

    expect(texto).toContain("variación significativa");
    expect(texto).not.toContain("evidenciando estabilidad");
  });
});

describe("#122 — 'Análisis' de 2.3/2.4/2.5 cita la desviación/CV real, no re-parsea texto formateado", () => {
  async function ctxConTextoCapturado(): Promise<{ ctx: InformeCtx; parrafos: string[] }> {
    const [{ jsPDF }, { default: autoTableReal }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const parrafos: string[] = [];
    let y = 20;
    const ctx: InformeCtx = {
      doc,
      autoTable: autoTableReal,
      get y() {
        return y;
      },
      set y(v: number) {
        y = v;
      },
      checkPage: () => {},
      addParagraph: (texto: string) => {
        parrafos.push(texto);
      },
      addSubsectionTitle: () => {},
    };
    return { ctx, parrafos };
  }

  // `formatDecimal` usa coma decimal ("0,67 %"); `parseFloat` corta ahí y
  // siempre devuelve 0 — por eso el informe mostraba "0,00 %" sin importar
  // los datos reales. Este test reproduce exactamente ese escenario.
  it("2.4: cita la desviación y CV reales (no 0,00 %) cuando es Conforme", async () => {
    const medidos = [0.79, 0.795, 0.8]; // nominal 0,8 s, promedio 0,795 -> desviación y CV > 0
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeMediciones = medidos.map((tiempo_medido_s, i) =>
      row({
        id: `m${i}`,
        visita_id: V,
        tipo_medicion: "principal",
        grupo_numero: 1,
        toma_numero: i + 1,
        tiempo_nominal_s: 0.8,
        tiempo_medido_s,
      })
    );

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.4", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    expect(texto).not.toContain("0,00 %");

    const prom = medidos.reduce((s, v) => s + v, 0) / medidos.length;
    const desvEsperada = (Math.abs(prom - 0.8) / 0.8) * 100;
    const std = Math.sqrt(medidos.reduce((s, v) => s + (v - prom) ** 2, 0) / (medidos.length - 1));
    const cvEsperado = (std / prom) * 100;

    const matchDv = texto.match(/desviaciones máximas de hasta ([\d,.]+) %/);
    const matchCv = texto.match(/coeficientes de variación máximos de ([\d,.]+) %/);
    expect(matchDv).not.toBeNull();
    expect(matchCv).not.toBeNull();
    expect(parseFloat(matchDv![1].replace(",", "."))).toBeCloseTo(desvEsperada, 1);
    expect(parseFloat(matchCv![1].replace(",", "."))).toBeCloseTo(cvEsperado, 1);
  });

  it("2.4: cuando es No conforme, el párrafo también cita la desviación/CV real que hizo fallar la prueba", async () => {
    const medidos = [0.4, 0.42, 0.44]; // nominal 0,8 s — desviación ~47 %, muy por encima del 10 %
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeMediciones = medidos.map((tiempo_medido_s, i) =>
      row({
        id: `m${i}`,
        visita_id: V,
        tipo_medicion: "principal",
        grupo_numero: 1,
        toma_numero: i + 1,
        tiempo_nominal_s: 0.8,
        tiempo_medido_s,
      })
    );

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.4", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    expect(texto).not.toContain("0,00 %");
    expect(texto).toMatch(/desviaciones de hasta \d+,\d+ %/);
    expect(texto).toMatch(/coeficientes de variación de hasta \d+,\d+ %/);
  });

  it("2.5: cita la desviación y CV reales (no 0,00 %) cuando es Conforme", async () => {
    const medidos = [79, 79.5, 80]; // nominal 80 kV, promedio 79,5 -> desviación y CV > 0
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    conv.raysafeMediciones = medidos.map((kv_medido, i) =>
      row({
        id: `m${i}`,
        visita_id: V,
        tipo_medicion: "principal",
        grupo_numero: 1,
        toma_numero: i + 1,
        kv_nominal: 80,
        kv_medido,
      })
    );

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.5", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    expect(texto).not.toContain("0,00 %");
    expect(texto).toMatch(/desviaciones máximas de hasta \d+,\d+ %/);
  });

  it("2.3: la desviación total citada en el análisis es la suma real, no la truncada por parseFloat", async () => {
    const conv: DatosConvencional = (await recopilarDatosConv(V)) as DatosConvencional;
    // 4 bordes con 0,5 % de desviación cada uno: individualmente Conforme
    // (< 2 %) y la suma real (2,0 %) también es Conforme (< 4 %). Con el
    // bug, cada "0,5 %" se truncaba a 0 en `parseFloat` y la suma total
    // citada en el texto daba 0 en vez de 2.
    conv.colimacion = row({
      id: "c1",
      visita_id: V,
      sid_cm: 100,
      anodo_nominal: 10,
      anodo_medido: 10.5,
      catodo_nominal: 10,
      catodo_medido: 10.5,
      izquierda_nominal: 10,
      izquierda_medido: 10.5,
      derecha_nominal: 10,
      derecha_medido: 10.5,
      posicion_esfera: "Centro",
    });

    const { ctx, parrafos } = await ctxConTextoCapturado();
    renderResultadosSeccion(ctx, "2.3", visitaFixture, conv, undefined);

    const texto = parrafos.join(" ");
    expect(texto).toContain("cumple con los criterios de aceptación establecidos");
    const match = texto.match(/desviación total fue de ([\d,.]+) %/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1].replace(",", "."))).toBeCloseTo(2, 0);
  });
});
