/**
 * Frecuencia de Nyquist del detector (2.16): f_N = 1 / (2 · tamaño de píxel).
 * Con el píxel en mm resulta en lp/mm. Se redondea a 2 decimales, igual que
 * se reporta en el informe. undefined si no hay un píxel positivo.
 */
export function nyquistDesdePixel(pixelMm: number | null | undefined): number | undefined {
  if (pixelMm == null || !Number.isFinite(pixelMm) || pixelMm <= 0) return undefined;
  return Number((1 / (2 * pixelMm)).toFixed(2));
}
