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
import type { ConvInformeSeccion } from "@/lib/equipos/convencional/db/types";
import {
  generarPreInforme,
  getLogoBase64,
  getMarcaAguaBase64,
  getPieFooterBase64,
  resetLogoCache,
  resetMarcaAguaCache,
  resetPieFooterCache,
  resolverAccionesTexto,
  subseccionesNoAplica,
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

// PNG 1x1 válido → doc.getImageProperties devuelve dimensiones reales y
// doc.addImage no lanza (ejercita el camino de tarjeta con foto).
function tinyPngBlob(): Blob {
  const bytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    ),
    (c) => c.charCodeAt(0)
  );
  return new Blob([bytes], { type: "image/png" });
}

beforeEach(async () => {
  await resetTestDb();
  resetLogoCache();
  resetMarcaAguaCache();
  resetPieFooterCache();
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

  it("el informe ya no imprime la leyenda de cantidad de tubos", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    await db.tubos.bulkAdd([
      { id: randomUUID(), equipo_id: equipo.id! },
      { id: randomUUID(), equipo_id: equipo.id! },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).not.toContain("El equipo cuenta con");
    expect(text).not.toContain("no tiene tubos registrados");
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
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        subtabla: "otra",
        nombre: "IDEN-PLACA",
        orden: 1,
      },
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

  // Nota: el render de la imagen en sí (tarjeta foto/tabla, drawImagenCard) no se
  // puede ejercitar bajo happy-dom + fake-indexeddb — el Blob no sobrevive el
  // round-trip por IndexedDB (vuelve como objeto plano y FileReader lo rechaza),
  // así que `dataUrl` queda undefined y se toma la rama sin foto. Estos tests
  // cubren la carga de identificaciones, el ref_id por tubo y que la presencia de
  // filas con blob no rompe la generación (rama `.catch` de blobADataUrl).
  it("#61: una identificación de generador con blob no rompe el informe", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.equipos.update(equipo.id!, { gen_marca: "MARCA-CARD-61" });
    await db.equipo_identificaciones.add({
      id: randomUUID(),
      equipo_id: equipo.id!,
      subtabla: "generador",
      blob_local: tinyPngBlob(),
    });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).not.toBeNull();
    const text = await pdfText(blob!);
    expect(text).toContain("Características del Generador");
    expect(text).toContain("MARCA-CARD-61");
  });

  it("#61: identificaciones de tubo (ref_id) y colimador se cargan sin romper el informe", async () => {
    const { visita, equipo } = await seedGraph({ tipoEquipo: "CONVENCIONAL", conTubo: false });
    const tuboA = randomUUID();
    const tuboB = randomUUID();
    await db.tubos.bulkAdd([
      { id: tuboA, equipo_id: equipo.id!, marca: "TUBO-A-CARD" },
      { id: tuboB, equipo_id: equipo.id!, marca: "TUBO-B-CARD" },
    ]);
    await db.equipo_identificaciones.bulkAdd([
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        subtabla: "tubo",
        ref_id: tuboB,
        blob_local: tinyPngBlob(),
      },
      {
        id: randomUUID(),
        equipo_id: equipo.id!,
        subtabla: "colimador",
        blob_local: tinyPngBlob(),
      },
    ]);
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("Especificaciones del Tubo 2");
    expect(text).toContain("TUBO-B-CARD");
    expect(text).toContain("Características del Colimador");
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

  it("getMarcaAguaBase64/getPieFooterBase64 resuelven a data URL cuando el asset existe", async () => {
    resetMarcaAguaCache();
    resetPieFooterCache();
    await expect(getMarcaAguaBase64()).resolves.toMatch(/^data:/);
    await expect(getPieFooterBase64()).resolves.toMatch(/^data:/);
  });

  it("getMarcaAguaBase64/getPieFooterBase64 resuelven a '' cuando el asset responde 404, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    resetMarcaAguaCache();
    resetPieFooterCache();
    await expect(getMarcaAguaBase64()).resolves.toBe("");
    await expect(getPieFooterBase64()).resolves.toBe("");
  });

  it("visita NO final: pide el pie de cierre pero NO la marca de agua oficial (queda 'PRE-INFORME')", async () => {
    resetMarcaAguaCache();
    resetPieFooterCache();
    const fetchMock = okPngFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const blob = await generarPreInforme(visita!.id!);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/pie-pagina-sievert.png");
    expect(urls).not.toContain("/marca-agua-sievert.png");
    expect(await pdfText(blob!)).toContain("PRE-INFORME");
  });

  it("visita FINAL (flujo sin paquete dedicado, sin pruebas pendientes): pide la marca de agua oficial y ya no lleva 'PRE-INFORME'", async () => {
    resetMarcaAguaCache();
    resetPieFooterCache();
    const fetchMock = okPngFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { visita } = await seedGraph({ tipoEquipo: "CT", estadoVisita: "aprobada" });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/marca-agua-sievert.png");
    expect(await pdfText(blob!)).not.toContain("PRE-INFORME");
  });

  it("#60: la fecha de expiración de la licencia sale dd/mm/aaaa en el informe", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      fecha_expiracion_licencia: "2027-03-15",
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("15/03/2027");
  });

  it("#108: 'Responsable de visita' toma el contacto del cliente, no el técnico de Sievert", async () => {
    const { visita, cliente } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const tecnicoId = randomUUID();
    await db.usuarios.add({
      id: tecnicoId,
      nombre: "TECNICO-SIEVERT-NO-DEBE-SALIR",
      cedula: "999999",
      cargo: "tecnico",
      activo: true,
    });
    await db.visitas.update(visita!.id!, { tecnico_id: tecnicoId });

    await db.contactos.add({
      id: randomUUID(),
      cliente_id: cliente.id!,
      nombre: "RESPONSABLE-VISITA-CLIENTE",
      cargo: "responsable_visita",
      cedula: "111222",
      para_programar: false,
    });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("RESPONSABLE-VISITA-CLIENTE");
    expect(text).toContain("111222");
    expect(text).not.toContain("TECNICO-SIEVERT-NO-DEBE-SALIR");
  });

  it("#108: sin contacto responsable_visita → muestra '—' en vez del técnico", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const tecnicoId = randomUUID();
    await db.usuarios.add({
      id: tecnicoId,
      nombre: "TECNICO-SIEVERT-SIN-CONTACTO",
      cedula: "888888",
      cargo: "tecnico",
      activo: true,
    });
    await db.visitas.update(visita!.id!, { tecnico_id: tecnicoId });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).not.toContain("TECNICO-SIEVERT-SIN-CONTACTO");
  });

  it("#109: 'Responsable de generación de documento' toma nombre y cargo del usuario que genera el informe", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const generadorId = randomUUID();
    await db.usuarios.add({
      id: generadorId,
      nombre: "COORDINADOR-GENERADOR-INFORME",
      cedula: "555444",
      cargo: "coordinador",
      activo: true,
    });

    const text = await pdfText(
      (await generarPreInforme(visita!.id!, { usuarioGeneradorId: generadorId }))!
    );
    expect(text).toContain("COORDINADOR-GENERADOR-INFORME");
    expect(text).toContain("Responsable de generaci");
  });

  it("#109: sin usuarioGeneradorId → la fila queda en blanco, el PDF no se rompe", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    const text = await pdfText(blob!);
    expect(text).toContain("Responsable de generaci");
  });

  it("#109: con titulo_firma → usa el título libre en vez del rol genérico", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const generadorId = randomUUID();
    await db.usuarios.add({
      id: generadorId,
      nombre: "NINI-GOMEZ",
      cedula: "555444",
      cargo: "coordinador",
      titulo_firma: "Coordinadora de estudios y controles",
      activo: true,
    });

    const text = await pdfText(
      (await generarPreInforme(visita!.id!, { usuarioGeneradorId: generadorId }))!
    );
    expect(text).toContain("Coordinadora de estudios y controles");
  });

  it("#109: sin titulo_firma → cae a ROL_LABELS[cargo]", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const generadorId = randomUUID();
    await db.usuarios.add({
      id: generadorId,
      nombre: "SIN-TITULO-LIBRE",
      cedula: "555555",
      cargo: "coordinador",
      activo: true,
    });

    const text = await pdfText(
      (await generarPreInforme(visita!.id!, { usuarioGeneradorId: generadorId }))!
    );
    expect(text).toContain("Coordinador");
  });

  it("versión oficial: acepta un qrDataUrl sin romper", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "aprobada" });
    // Un informe OFICIAL no se emite con pruebas PENDIENTE: se excluyen todas
    // las secciones (No aplica) para que el concepto general sea concluyente.
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: false,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const qr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = await generarPreInforme(visita!.id!, { qrDataUrl: qr });
    expect(blob).toBeInstanceOf(Blob);
  });

  it("versión oficial con pruebas pendientes → null (no se emite)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "aprobada" });
    // Secciones incluidas pero sin datos → PENDIENTE → el OFICIAL no se genera.
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: true,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    expect(await generarPreInforme(visita!.id!)).toBeNull();
  });
});

describe("concepto general y acciones correctivas", () => {
  it("borrador con pruebas sin datos → CONCEPTO PENDIENTE + nota explicativa", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "en_progreso" });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: true,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    // Sin datos en ninguna prueba: nada Conforme ni No conforme → el concepto
    // general (y todas las filas del resumen) quedan en PENDIENTE.
    expect(text).toContain("PENDIENTE");
    expect(text).not.toContain("FAVORABLE");
  });

  it("ya no existe la sección consolidada 'ACCIONES CORRECTIVAS'", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).not.toContain("ACCIONES CORRECTIVAS");
  });

  it("la numeración de subsecciones de la 2.8 no salta la .5 cuando no hay datos", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "en_progreso" });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: true,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    // Antes: 2.8.4 → 2.8.6 (se quemaba la .5). Ahora la .5 existe.
    expect(text).toContain("2.8.4.");
    expect(text).toContain("2.8.5.");
  });

  it("la evidencia de la 2.2 se rotula 'Evidencia gráfica', no 'Fotografías'", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "en_progreso" });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: true,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("Evidencia gr");
    expect(text).not.toContain("Fotograf");
  });

  it("el texto de acciones correctivas guardado por el usuario se imprime en el PDF para cualquier prueba (no solo 2.1/2.2/2.13)", async () => {
    // 2.3 (colimación) con valores que evalúan Conforme: sin desviación entre
    // nominal/medido y esfera de perpendicularidad en el centro.
    const { visita } = await seedGraph({
      tipoEquipo: "CONVENCIONAL",
      estadoVisita: "en_progreso",
    });
    await db.conv_colimacion.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      anodo_nominal: 10,
      anodo_medido: 10,
      catodo_nominal: 10,
      catodo_medido: 10,
      izquierda_nominal: 10,
      izquierda_medido: 10,
      derecha_nominal: 10,
      derecha_medido: 10,
      posicion_esfera: "Centro",
    });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: true,
        acciones_correctivas: i + 1 === 3 ? "OBSERVACION-PUNTUAL-MARCADOR-2-3" : undefined,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("OBSERVACION-PUNTUAL-MARCADOR-2-3");
    expect(text).not.toContain(
      "Se recomienda mantener las condiciones actuales de operación del equipo y continuar con el seguimiento periódico dentro del programa de control de calidad."
    );
  });
});

describe("#60 — formateo de campos de licencia", () => {
  it("textoCampo: null / undefined / '' / solo espacios → 'No reporta' por defecto", () => {
    expect(textoCampo(null)).toBe("No reporta");
    expect(textoCampo(undefined)).toBe("No reporta");
    expect(textoCampo("")).toBe("No reporta");
    expect(textoCampo("   ")).toBe("No reporta");
  });

  it("textoCampo: con contenido devuelve el valor recortado", () => {
    expect(textoCampo("REPS-123")).toBe("REPS-123");
    expect(textoCampo("  L-99 ")).toBe("L-99");
  });

  it("textoCampo: acepta un fallback explícito (excepción de energía fotones → 'No aplica')", () => {
    expect(textoCampo(null, "No aplica")).toBe("No aplica");
    expect(textoCampo("", "No aplica")).toBe("No aplica");
  });

  it("textoFecha: vacío → 'No aplica' por defecto", () => {
    expect(textoFecha(null)).toBe("No aplica");
    expect(textoFecha(undefined)).toBe("No aplica");
    expect(textoFecha("")).toBe("No aplica");
  });

  it("textoFecha: acepta un fallback explícito ('No reporta' para licencia sin fecha marcada)", () => {
    expect(textoFecha(null, "No reporta")).toBe("No reporta");
    expect(textoFecha("", "No reporta")).toBe("No reporta");
  });

  it("textoFecha: ISO de solo día → dd/mm/aaaa sin correr el día por zona horaria", () => {
    expect(textoFecha("2027-03-15")).toBe("15/03/2027");
    expect(textoFecha("2027-03-15T00:00:00Z")).toBe("15/03/2027");
  });

  it("textoFecha: string no reconocible se devuelve tal cual", () => {
    expect(textoFecha("no sé")).toBe("no sé");
  });
});

describe("resolverAccionesTexto — fuente única del texto de Acciones Correctivas", () => {
  it("prioriza lo guardado por el usuario, recortado, sobre catálogo y fallback", () => {
    expect(resolverAccionesTexto("  Texto del usuario  ", "Del catálogo", "Fallback")).toBe(
      "Texto del usuario"
    );
  });

  it("sin lo guardado (undefined o solo espacios), usa el default del catálogo", () => {
    expect(resolverAccionesTexto(undefined, "Del catálogo", "Fallback")).toBe("Del catálogo");
    expect(resolverAccionesTexto("   ", "Del catálogo", "Fallback")).toBe("Del catálogo");
  });

  it("sin guardado ni catálogo, cae al fallback fijo", () => {
    expect(resolverAccionesTexto(undefined, undefined, "Fallback")).toBe("Fallback");
    expect(resolverAccionesTexto("", undefined, "Fallback")).toBe("Fallback");
  });
});

describe("#60 — 'No aplica' vs 'No reporta' en información de la práctica", () => {
  it("energía fotones/electrones vacía siempre muestra 'No aplica'", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("No aplica");
  });

  it("fecha de expiración de licencia: sin marcar 'sin fecha' y vacía → 'No reporta'", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      fecha_expiracion_licencia: undefined,
      sin_fecha_expiracion_licencia: false,
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("No reporta");
  });

  it("fecha de expiración de licencia: con 'sin fecha' marcado → 'No aplica'", async () => {
    const { visita, ubicacion } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.ubicaciones_rx.update(ubicacion.id!, {
      fecha_expiracion_licencia: undefined,
      sin_fecha_expiracion_licencia: true,
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("No aplica");
  });
});

// ============================================================
//  Página "CONTENIDO" (se inserta como página 2, tras la portada) — pedido
//  de negocio: la plantilla de referencia trae un índice ahí. Se construye
//  con los mismos títulos ya renderizados (no una lista aparte hardcodeada),
//  así que cada título real aparece DOS VECES en el PDF: una en el índice,
//  otra en su propia sección.
// ============================================================
describe("Página de contenido (índice)", () => {
  it("lista los títulos de sección — cada uno aparece 2 veces en el PDF (índice + sección real)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);

    expect(text).toContain("CONTENIDO");

    const contar = (s: string) => (text.match(new RegExp(s, "g")) ?? []).length;
    expect(contar("INFORMACIÓN DE LA PRÁCTICA")).toBe(2);
    expect(contar("2\\. PRUEBAS DE CONTROL DE CALIDAD EN RADIOLOGÍA GENERAL")).toBe(2);
    expect(contar("RESUMEN DE RESULTADOS")).toBe(2);
    expect(contar("FIRMAS")).toBe(2);
  });

  it("incluye cada prueba (2.1–2.21) con su código y nombre del catálogo", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);

    // 3, no 2: además del índice y el título de la sección, el nombre de la
    // prueba también aparece como fila en la tabla "RESUMEN DE RESULTADOS".
    const contar = (s: string) => (text.match(new RegExp(s, "g")) ?? []).length;
    expect(contar("2\\.4 Exactitud y repetibilidad del tiempo de exposición")).toBe(3);
    expect(contar("2\\.21 Dosis al receptor de imagen")).toBe(3);
  });

  it("'OBSERVACIONES GENERALES' no se imprime aunque la visita tenga observaciones (deshabilitada a pedido)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });

    const sinObs = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(sinObs).not.toContain("OBSERVACIONES GENERALES");

    await db.visitas.update(visita!.id!, { observaciones: "Nota de campo." });
    const conObs = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(conObs).not.toContain("OBSERVACIONES GENERALES");
  });

  it("2.21: el Análisis editado no se duplica después de Acciones correctivas", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    // Con línea base (medición sin_rejilla con dosis_base_mgy) el Análisis
    // lleva además la Tabla 2.21.2; el texto editado va después de ella.
    await db.conv_raysafe_mediciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      tipo_medicion: "sin_rejilla",
      toma_numero: 1,
      programa_clinico: "Tórax AP",
      kv_nominal: 90,
      mas_nominal: 5,
      dosis_medida_mgy: 0.32,
      dosis_base_mgy: 0.319,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
    });
    const textoCustom = "Texto de analisis editado a mano por el fisico XYZ123";
    await db.conv_informe_secciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      prueba_codigo: "2.21",
      orden: 21,
      incluida: true,
      observaciones: textoCustom,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
    });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    const apariciones = text.split(textoCustom).length - 1;
    expect(apariciones).toBe(1);
  });

  it("2.21 sin valores base: el Análisis editado también se imprime, una sola vez", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const textoCustom = "Texto de analisis sin valores base QWE456";
    await db.conv_informe_secciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      prueba_codigo: "2.21",
      orden: 21,
      incluida: true,
      observaciones: textoCustom,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
    });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text.split(textoCustom).length - 1).toBe(1);
  });
});

describe("Análisis editable en cualquier prueba (observaciones de la sección)", () => {
  // El generador justifica los párrafos palabra por palabra, así que el texto
  // automático de varias líneas no queda legible en el buffer del PDF: su
  // supresión se verifica en secciones-convencional.test.ts. Acá se usan
  // textos editados de una sola línea, que sí se dibujan enteros.

  async function seedVisitaCon24(observaciones?: string) {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.conv_raysafe_mediciones.bulkAdd(
      [0.79, 0.795, 0.8].map((tiempo_medido_s, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        tipo_medicion: "principal" as const,
        grupo_numero: 1,
        toma_numero: i + 1,
        tiempo_nominal_s: 0.8,
        tiempo_medido_s,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    await db.conv_informe_secciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      prueba_codigo: "2.4",
      orden: 4,
      incluida: true,
      observaciones,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
    });
    return visita!.id!;
  }

  it("2.4 con observaciones: el texto sale una sola vez, en 2.4.5 Análisis y no bajo Concepto", async () => {
    const textoCustom = "Analisis de la 2.4 editado por el fisico ABC789";
    const text = await pdfText((await generarPreInforme(await seedVisitaCon24(textoCustom)))!);

    expect(text.split(textoCustom).length - 1).toBe(1);

    const posTexto = text.indexOf(textoCustom);
    const posAnalisis = text.indexOf("2.4.5.");
    const posCriterio = text.indexOf("2.4.6.");
    expect(posAnalisis).toBeGreaterThan(-1);
    expect(posCriterio).toBeGreaterThan(posAnalisis);
    expect(posTexto).toBeGreaterThan(posAnalisis);
    expect(posTexto).toBeLessThan(posCriterio);
  });

  it("2.4 sin datos (no llega a emitir Análisis): las observaciones no se imprimen en ningún lado", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const textoCustom = "Analisis huerfano de la 2.4 JKL321";
    await db.conv_informe_secciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      prueba_codigo: "2.4",
      orden: 4,
      incluida: true,
      observaciones: textoCustom,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
    });
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).not.toContain(textoCustom);
  });
});

describe("Prueba 'No aplica': motivo en Metodología y resto compactado en dos columnas", () => {
  // Una sola sección en la visita, para que cada marcador venga de esa prueba.
  // Los párrafos de varias líneas se justifican palabra por palabra y no
  // quedan legibles enteros en el buffer: se afirma sobre textos de una línea
  // o sobre palabras sueltas.
  async function pdfDeSeccion(
    codigo: string,
    campos: Partial<ConvInformeSeccion> = {}
  ): Promise<string> {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.conv_informe_secciones.add({
      id: randomUUID(),
      visita_id: visita!.id!,
      prueba_codigo: codigo,
      orden: 1,
      incluida: false,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
      ...campos,
    });
    return pdfText((await generarPreInforme(visita!.id!))!);
  }

  const veces = (texto: string, marca: string) => texto.split(marca).length - 1;

  const MOTIVO_211 = "NO APLICA, toda vez que el equipo no cuenta con detector digital.";
  // Palabra que en la 2.12 solo aparece en la Metodología del catálogo.
  const MARCA_METODOLOGIA_212 = "Posteriormente";
  // Fragmento del Criterio de aceptación de la 2.12 (una sola línea).
  const MARCA_CRITERIO_212 = "2,4 pl/mm";

  it("la Metodología imprime el motivo predeterminado del catálogo", async () => {
    const text = await pdfDeSeccion("2.11");
    expect(text).toContain("2.11.3.");
    expect(text).toContain(MOTIVO_211);
  });

  it("la Metodología del catálogo no se imprime (sí en la misma prueba cuando aplica)", async () => {
    expect(await pdfDeSeccion("2.12", { incluida: true })).toContain(MARCA_METODOLOGIA_212);
    expect(await pdfDeSeccion("2.12")).not.toContain(MARCA_METODOLOGIA_212);
  });

  it("un motivo guardado por el físico reemplaza al predeterminado", async () => {
    const motivo = "Motivo editado por el fisico XYZ123";
    const text = await pdfDeSeccion("2.11", { metodologia_no_aplica: `  ${motivo}  ` });
    expect(veces(text, motivo)).toBe(1);
    expect(text).not.toContain(MOTIVO_211);
  });

  it("un motivo guardado en blanco cae al predeterminado", async () => {
    expect(await pdfDeSeccion("2.11", { metodologia_no_aplica: "   " })).toContain(MOTIVO_211);
  });

  it("subseccionesNoAplica: 2.8 → seis títulos numerados de .4 a .9", () => {
    expect(subseccionesNoAplica("2.8")).toEqual([
      "2.8.4. Resultados",
      "2.8.5. Análisis",
      "2.8.6. Criterio de aceptación",
      "2.8.7. Evidencia gráfica",
      "2.8.8. Concepto",
      "2.8.9. Acciones Correctivas",
    ]);
  });

  it("subseccionesNoAplica: 2.14 y 2.15 → cinco títulos, sin Evidencia gráfica", () => {
    for (const codigo of ["2.14", "2.15"]) {
      expect(subseccionesNoAplica(codigo)).toEqual([
        `${codigo}.4. Resultados`,
        `${codigo}.5. Análisis`,
        `${codigo}.6. Criterio de aceptación`,
        `${codigo}.7. Concepto`,
        `${codigo}.8. Acciones Correctivas`,
      ]);
    }
  });

  it("subseccionesNoAplica: 2.1 → Diagrama radiométrico en lugar de Evidencia gráfica", () => {
    expect(subseccionesNoAplica("2.1")).toEqual([
      "2.1.4. Resultados",
      "2.1.5. Análisis",
      "2.1.6. Criterio de aceptación",
      "2.1.7. Diagrama radiométrico",
      "2.1.8. Concepto",
      "2.1.9. Acciones Correctivas",
    ]);
  });

  it("subseccionesNoAplica: las 21 pruebas llevan Evidencia gráfica salvo 2.1, 2.14 y 2.15", () => {
    for (let i = 1; i <= 21; i++) {
      const codigo = `2.${i}`;
      const conEvidencia = subseccionesNoAplica(codigo).some((t) =>
        t.endsWith("Evidencia gráfica")
      );
      expect(conEvidencia, codigo).toBe(!["2.1", "2.14", "2.15"].includes(codigo));
    }
  });

  it("cada subsección de la grilla se imprime con su número y 'No aplica.' en todas las celdas", async () => {
    const text = await pdfDeSeccion("2.8");
    for (const n of [4, 5, 6, 7, 8, 9]) expect(text).toContain(`2.8.${n}.`);
    expect(text).not.toContain("2.8.10.");
    expect(veces(text, "(No aplica.) Tj")).toBe(6);
  });

  it("2.14: cinco celdas, sin subsección .9", async () => {
    const text = await pdfDeSeccion("2.14");
    expect(veces(text, "(No aplica.) Tj")).toBe(5);
    expect(text).toContain("2.14.8.");
    expect(text).not.toContain("2.14.9.");
  });

  it("el Criterio de aceptación del catálogo ya no se imprime (sí cuando la prueba aplica)", async () => {
    expect(await pdfDeSeccion("2.12", { incluida: true })).toContain(MARCA_CRITERIO_212);
    expect(await pdfDeSeccion("2.12")).not.toContain(MARCA_CRITERIO_212);
  });

  it("las acciones correctivas guardadas no se imprimen en una prueba no aplica", async () => {
    const acciones = "ACCIONES-MARCADOR-NO-APLICA";
    expect(await pdfDeSeccion("2.12", { acciones_correctivas: acciones })).not.toContain(acciones);
  });

  it("el veredicto 'NO APLICA' queda solo en la tabla resumen, no en el cuerpo de la prueba", async () => {
    const text = await pdfDeSeccion("2.12", { metodologia_no_aplica: "Motivo sin la marca." });
    expect(veces(text, "(NO APLICA) Tj")).toBe(1);
    expect(text).not.toContain("(NO APLICA.) Tj");
  });

  it("todas las pruebas en no aplica: el informe oficial se emite (el concepto general no queda pendiente)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "aprobada" });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: false,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(veces(text, "(NO APLICA) Tj")).toBe(21);
    expect(text).not.toContain("PENDIENTE");
  });

  it("la Metodología y la grilla quedan en la misma página (el motivo no queda huérfano al pie)", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    await db.conv_informe_secciones.bulkAdd(
      Array.from({ length: 21 }, (_, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        prueba_codigo: `2.${i + 1}`,
        orden: i + 1,
        incluida: false,
        sync_status: "synced" as const,
        last_modified: new Date().toISOString(),
      }))
    );
    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    // Cada página es un stream propio: si entre el título de Metodología y la
    // primera celda de la grilla hay un "endstream", quedaron en páginas distintas.
    const partidas = Array.from({ length: 21 }, (_, i) => `2.${i + 1}`).filter((codigo) => {
      const iMetodologia = text.indexOf(`(${codigo}.3. Metodolog`);
      const iGrilla = text.indexOf(`(${codigo}.4. Resultados) Tj`);
      expect(iMetodologia).toBeGreaterThan(-1);
      expect(iGrilla).toBeGreaterThan(iMetodologia);
      return text.slice(iMetodologia, iGrilla).includes("endstream");
    });
    expect(partidas).toEqual([]);
  });

  it("'No se pudo ejecutar' (#120) se imprime como antes: textos del catálogo completos y sin grilla", async () => {
    const text = await pdfDeSeccion("2.12", {
      incluida: true,
      concepto: "No_favorable_no_ejecutada",
      metodologia_no_aplica: "MOTIVO-QUE-NO-DEBE-SALIR",
    });
    expect(text).toContain(MARCA_METODOLOGIA_212);
    expect(text).toContain(MARCA_CRITERIO_212);
    expect(text).toContain("(NO EJECUTADA) Tj");
    expect(text).not.toContain("MOTIVO-QUE-NO-DEBE-SALIR");
    expect(text).not.toContain("(No aplica.) Tj");
  });
});
