import { describe, it, expect, vi } from "vitest";
import { evidenciaPath, compressImage, resolverImagenSrc, subirEvidencia } from "./storage";

describe("storage — evidenciaPath", () => {
  it("conv_evidencias → {visita}/{prueba}/{slot}.jpg", () => {
    expect(
      evidenciaPath("conv_evidencias", {
        id: "x",
        visita_id: "vis-1",
        prueba_codigo: "2.2",
        slot: "consola",
      })
    ).toBe("vis-1/2.2/consola.jpg");
  });

  it("sanea caracteres raros en prueba/slot", () => {
    expect(
      evidenciaPath("conv_evidencias", {
        id: "x",
        visita_id: "vis-1",
        prueba_codigo: "2.2",
        slot: "aviso proteccion/1",
      })
    ).toBe("vis-1/2.2/aviso_proteccion_1.jpg");
  });

  it("otra tabla → {visita}/{tipo|slot|id}.jpg", () => {
    expect(evidenciaPath("evidencias", { id: "e1", visita_id: "vis-1", tipo: "montaje" })).toBe(
      "vis-1/montaje.jpg"
    );
    expect(evidenciaPath("evidencias", { id: "e2", visita_id: "vis-1" })).toBe("vis-1/e2.jpg");
  });

  it("sin visita_id usa 'sin-visita'", () => {
    expect(evidenciaPath("conv_evidencias", { id: "x", slot: "s" })).toBe("sin-visita/gen/s.jpg");
  });
});

describe("storage — compressImage", () => {
  it("sin canvas (entorno de test) devuelve el blob original", async () => {
    const b = new Blob([new Uint8Array(10)], { type: "image/jpeg" });
    expect(await compressImage(b)).toBe(b);
  });

  it("un valor que no es Blob se devuelve tal cual (tolerante)", async () => {
    const fake = { type: "image/jpeg" } as unknown as Blob;
    expect(await compressImage(fake)).toBe(fake);
  });
});

describe("storage — subirEvidencia", () => {
  it("sube al bucket y devuelve el path", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const supabase = { storage: { from: () => ({ upload }) } };
    const b = new Blob([new Uint8Array(10)], { type: "image/jpeg" });
    const path = await subirEvidencia(supabase, "vis-1/2.1/plano.jpg", b);
    expect(path).toBe("vis-1/2.1/plano.jpg");
    expect(upload).toHaveBeenCalledWith(
      "vis-1/2.1/plano.jpg",
      expect.anything(),
      expect.objectContaining({ upsert: true, contentType: "image/jpeg" })
    );
  });

  it("lanza si Supabase devuelve error", async () => {
    const supabase = {
      storage: {
        from: () => ({ upload: vi.fn().mockResolvedValue({ error: { message: "boom" } }) }),
      },
    };
    await expect(
      subirEvidencia(supabase, "p.jpg", new Blob([new Uint8Array(1)]))
    ).rejects.toBeTruthy();
  });
});

describe("storage — resolverImagenSrc", () => {
  it("con blob_local devuelve un object-URL", async () => {
    const b = new Blob([new Uint8Array(4)], { type: "image/jpeg" });
    const src = await resolverImagenSrc({ blob_local: b });
    expect(src).toMatch(/^blob:/);
  });

  it("sin blob ni path → null", async () => {
    expect(await resolverImagenSrc({})).toBeNull();
  });

  it("si url_storage ya es una URL completa, la devuelve tal cual", async () => {
    expect(await resolverImagenSrc({ url_storage: "https://cdn/x.jpg" })).toBe("https://cdn/x.jpg");
  });
});
