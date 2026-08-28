import { describe, it, expect, vi, beforeEach } from "vitest";

// getLogoBase64 hace fetch("/logo-informe.png") — se mockea con un PNG mínimo.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    blob: async () =>
      new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }),
  })
);

import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { generarPreInforme } from "./generar-pre-informe";

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
    await db.equipos.update(equipo.id!, { numero_serie: "SERIE-MARCADOR-999" });

    const text = await pdfText((await generarPreInforme(visita!.id!))!);
    expect(text).toContain("CLINICA-MARCADOR-CLI");
    expect(text).toContain("SERIE-MARCADOR-999");
  });

  it("equipo sin paquete (no-CONVENCIONAL) también genera el PDF (ruta legacy)", async () => {
    const { visita, equipo } = await seedGraph();
    await db.equipos.update(equipo.id!, { tipo_equipo: "CT" });
    const blob = await generarPreInforme(visita!.id!);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe("application/pdf");
  });

  it("versión oficial: acepta un qrDataUrl sin romper", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL", estadoVisita: "aprobada" });
    const qr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blob = await generarPreInforme(visita!.id!, { qrDataUrl: qr });
    expect(blob).toBeInstanceOf(Blob);
  });
});
