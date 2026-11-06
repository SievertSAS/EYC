import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const compressImage = vi.fn();
vi.mock("@/lib/supabase/storage", () => ({
  compressImage: (...args: unknown[]) => compressImage(...args),
}));

import { MAX_DIM_PDF, reducirParaPdf } from "./imagen-pdf";

function stubBitmap(width: number, height: number) {
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

const original = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
const reducida = new Blob([new Uint8Array([9])], { type: "image/jpeg" });

beforeEach(() => {
  compressImage.mockReset();
  compressImage.mockResolvedValue(reducida);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reducirParaPdf (#123)", () => {
  it("foto de cámara más grande que el máximo → se reduce a MAX_DIM_PDF", async () => {
    stubBitmap(4080, 3060);
    expect(await reducirParaPdf(original)).toBe(reducida);
    expect(compressImage).toHaveBeenCalledWith(original, MAX_DIM_PDF, expect.any(Number));
  });

  it("imagen dentro del máximo → se devuelve tal cual, sin recomprimir", async () => {
    stubBitmap(1600, 1200);
    expect(await reducirParaPdf(original)).toBe(original);
    expect(compressImage).not.toHaveBeenCalled();
  });

  it("PNG dentro del máximo → se pasa por compressImage (JPEG si pesa menos), igual que al subir al bucket", async () => {
    stubBitmap(475, 637);
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    expect(await reducirParaPdf(png)).toBe(reducida);
    expect(compressImage).toHaveBeenCalledWith(png, MAX_DIM_PDF, expect.any(Number));
  });

  it("también mira el lado mayor cuando la foto es vertical", async () => {
    stubBitmap(1200, 2400);
    expect(await reducirParaPdf(original)).toBe(reducida);
  });

  it("sin createImageBitmap (entorno sin canvas) → devuelve el original", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await reducirParaPdf(original)).toBe(original);
    expect(compressImage).not.toHaveBeenCalled();
  });

  it("si no se puede decodificar la imagen → devuelve el original, nunca lanza", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("corrupta")));
    expect(await reducirParaPdf(original)).toBe(original);
  });
});
