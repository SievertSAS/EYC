import { describe, it, expect, vi, beforeEach } from "vitest";

// getLogoBase64 hace fetch("/logo-informe.png") — se mockea con un PNG mínimo.
function okPngFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    blob: async () =>
      new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }),
  });
}
vi.stubGlobal("fetch", okPngFetch());

import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import {
  generarPreInforme,
  getLogoBase64,
  resetLogoCache,
  textoCampo,
  textoFecha,
} from "./generar-pre-informe";

// jsPDF no comprime por defecto → el texto dibujado queda legible en el
// buffer crudo del PDF (operadores `(str) Tj`). Alcanza para tests de
// contrato: "¿el dato X llegó al documento?", sin snapshots de píxeles.
async function pdfText(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return s;
}

beforeEach(async () => {
  await resetTestDb();
  resetLogoCache();
  vi.stubGlobal("fetch", okPngFetch());
});

describe("generarPreInforme — contrato de datos", () => {
  it("visita inexistente → null", async () => {
    expect(await generarPreInforme("no-existe")).toBeNull();
  });

  it("genera un Blob application/pdf para una visita CONVENCIONAL", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe("application/pdf");
    expect(blob!.size).toBeGreaterThan(1000);
  });

  it("el nombre del cliente, la sede y la serie del equipo llegan al PDF", async () => {
    const { visita, cliente, sede, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.clientes.update(cliente.id!, { nombre_cliente: "CLINICA-MARCADOR-CLI" });
    await db.sedes.update(sede.id!, { nombre_sede: "SEDE-MARCADOR" });
    await db.equipos.update(equipo.id!, { gen_numero_serie: "SERIE-MARCADOR-999" });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("CLINICA-MARCADOR-CLI");
    expect(text).toContain("SERIE-MARCADOR-999");
  });

  it("#68: los decimales del informe usan coma (es-CO), no punto", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      ancho_m: 2.5,
      largo_m: 3.2,
      alto_m: 2.8,
      area_m2: 8,
    });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    // La tabla "Dimensiones de la sala" imprime 2,5 m / 3,2 m / 2,8 m con
    // coma decimal. (No se afirma la ausencia de "2.5" porque el PDF crudo
    // lleva números con punto en sus estructuras internas.)
    expect(text).toContain("2,5");
    expect(text).toContain("3,2");
    expect(text).toContain("2,8");
  });

  it("equipo sin paquete (no-CONVENCIONAL) también genera el PDF (ruta legacy)", async () => {
    const { visita, equipo } = await seedGraph();
    await db.equipos.update(equipo.id!, { tipo_equipo: "CT" });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe("application/pdf");
  });

  it("#61: características del equipo y energía de fotones/electrones llegan al informe", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, {
      gen_marca: "EQ-MARCA-61",
      gen_numero_serie: "EQ-SERIE-61",
      gen_energia_fotones_mev: "ENERGIA-MARCADOR-61",
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("EQ-MARCA-61");
    expect(text).toContain("EQ-SERIE-61");
    expect(text).toContain("ENERGIA-MARCADOR-61");
  });

  it("#61 (D2b): el informe renderiza todos los tubos del equipo, numerados si hay más de uno", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    await db.tubos.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id!, marca: "TUBO-UNO-MARCA" },
      { id: randomUUID(), equipo_id: equipo.id!, marca: "TUBO-DOS-MARCA" },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("Especificaciones del Tubo 1");
    expect(text).toContain("Especificaciones del Tubo 2");
    expect(text).toContain("TUBO-UNO-MARCA");
    expect(text).toContain("TUBO-DOS-MARCA");
  });

  it("#61: el informe indica la cantidad de tubos del equipo en texto", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    await db.tubos.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id! },
      { id: randomUUID(), equipo_id: equipo.id! },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("El equipo cuenta con 2 tubos.");
  });

  it("#61: un solo tubo → singular; sin tubos → 'no tiene tubos registrados'", async () => {
    const g1 = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: true });
    expect(await pdfText((await generarPreInforme(g1.visita!.id!))!)).toContain(
      "El equipo cuenta con 1 tubo."
    );

    const g0 = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    expect(await pdfText((await generarPreInforme(g0.visita!.id!))!)).toContain(
      "El equipo no tiene tubos registrados."
    );
  });

  it("#61 (D2b): un tubo soft-borrado no sale en el informe", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    await db.tubos.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id!, marca: "TUBO-VIVO" },
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        marca: "TUBO-BORRADO",
        deleted_at: new Date().toISOString(),
      },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("TUBO-VIVO");
    expect(text).not.toContain("TUBO-BORRADO");
  });

  it("#61: 'Otras identificaciones' salen en el informe; una borrada no", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipo_identificaciones.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id!, subtabla: "otra", nombre: "IDEN-PLACA", orden: 1 },
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        subtabla: "otra",
        nombre: "IDEN-INVENTARIO",
        orden: 2,
      },
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        subtabla: "otra",
        nombre: "IDEN-BORRADA",
        orden: 3,
        deleted_at: new Date().toISOString(),
      },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("Otras identificaciones del equipo de rayos X");
    expect(text).toContain("IDEN-PLACA");
    expect(text).toContain("IDEN-INVENTARIO");
    expect(text).not.toContain("IDEN-BORRADA");
  });

  it("#61: las identificaciones de subtabla generador/tubo/colimador NO van a la lista 'Otras'", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipo_identificaciones.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id!, subtabla: "generador", nombre: "REF-GENERADOR" },
      { id: randomUUID(), equipo_id: equipo.id!, subtabla: "otra", nombre: "IDEN-SUELTA" },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("IDEN-SUELTA");
    expect(text).not.toContain("REF-GENERADOR");
  });

  it("#63: piso y techo del blindaje salen en la tabla de áreas colindantes", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      piso_desc: "PISO-MARCADOR-63",
      techo_desc: "TECHO-MARCADOR-63",
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("PISO-MARCADOR-63");
    expect(text).toContain("TECHO-MARCADOR-63");
  });

  it("#52: si falla la carga del logo, el PDF se genera igual (fallback de texto)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    resetLogoCache();
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe("application/pdf");
  });

  it("#52: getLogoBase64 resuelve a '' cuando el asset responde 404, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    resetLogoCache();
    await expect(getLogoBase64()).resolves.toBe("");
  });

  it("#60: la fecha de expiración de la licencia sale dd/mm/aaaa en el informe", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      fecha_expiracion_licencia: "2027-03-15",
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("15/03/2027");
  });

  it("versión oficial: acepta un qrDataUrl sin romper", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "aprobada" });
    const qr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = await generarPreInforme(visita!.id!, { qrDataUrl: qr });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe("#60 — formateo de campos de licencia", () => {
  it("textoCampo: null / undefined / '' / solo espacios → 'No aplica'", () => {
    expect(textoCampo(null)).toBe("No aplica");
    expect(textoCampo(undefined)).toBe("No aplica");
    expect(textoCampo("")).toBe("No aplica");
    expect(textoCampo("   ")).toBe("No aplica");
  });

  it("textoCampo: con contenido devuelve el valor recortado", () => {
    expect(textoCampo("REPS-123")).toBe("REPS-123");
    expect(textoCampo("  L-99 ")).toBe("L-99");
  });

  it("textoFecha: vacío → 'No aplica'", () => {
    expect(textoFecha(null)).toBe("No aplica");
    expect(textoFecha(undefined)).toBe("No aplica");
    expect(textoFecha("")).toBe("No aplica");
  });

  it("textoFecha: ISO de solo día → dd/mm/aaaa sin correr el día por zona horaria", () => {
    expect(textoFecha("2027-03-15")).toBe("15/03/2027");
    expect(textoFecha("2027-03-15T00:00:00Z")).toBe("15/03/2027");
  });

  it("textoFecha: string no reconocible se devuelve tal cual", () => {
    expect(textoFecha("no sé")).toBe("no sé");
  });
});
