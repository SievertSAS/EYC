import { describe, expect, it } from "vitest";
import { detectarTipoImagen } from "./tipo-imagen";

// ============================================================
//  detectarTipoImagen — tipo real de una imagen por sus bytes
//  iniciales (#207). Las APIs de firma no pueden confiar en el
//  nombre ni en el `type` del File que manda el navegador.
// ============================================================

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("detectarTipoImagen", () => {
  it("JPEG (FF D8 FF) → image/jpeg", () => {
    expect(detectarTipoImagen(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe("image/jpeg");
  });

  it("PNG (89 50 4E 47 0D 0A 1A 0A) → image/png", () => {
    expect(detectarTipoImagen(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe(
      "image/png"
    );
  });

  it("WebP (RIFF....WEBP) → image/webp", () => {
    const webp = bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WEBPVP8 "));
    expect(detectarTipoImagen(webp)).toBe("image/webp");
  });

  it("RIFF que no es WEBP (p. ej. WAV) → null", () => {
    const wav = bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WAVEfmt "));
    expect(detectarTipoImagen(wav)).toBeNull();
  });

  it("PDF, texto, SVG o GIF → null", () => {
    expect(detectarTipoImagen(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(detectarTipoImagen(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(detectarTipoImagen(bytes(...ascii("GIF89a")))).toBeNull();
  });

  it("buffer vacío o más corto que la firma → null (sin lanzar)", () => {
    expect(detectarTipoImagen(bytes())).toBeNull();
    expect(detectarTipoImagen(bytes(0xff, 0xd8))).toBeNull();
    expect(detectarTipoImagen(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEB")))).toBeNull();
  });

  it("acepta un ArrayBuffer además de Uint8Array/Buffer", () => {
    expect(detectarTipoImagen(bytes(0xff, 0xd8, 0xff, 0xdb).buffer)).toBe("image/jpeg");
    expect(detectarTipoImagen(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
  });
});
