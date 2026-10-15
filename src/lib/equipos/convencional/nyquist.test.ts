import { describe, expect, it } from "vitest";
import { nyquistDesdePixel } from "./nyquist";

describe("nyquistDesdePixel — f_N = 1 / (2 · pixel)", () => {
  it("computes the Nyquist frequency in lp/mm, rounded to 2 decimals", () => {
    expect(nyquistDesdePixel(0.139)).toBe(3.6);
    expect(nyquistDesdePixel(0.15)).toBe(3.33);
    expect(nyquistDesdePixel(0.1)).toBe(5);
  });

  it("returns undefined without a usable pixel size", () => {
    expect(nyquistDesdePixel(undefined)).toBeUndefined();
    expect(nyquistDesdePixel(0)).toBeUndefined();
    expect(nyquistDesdePixel(-0.1)).toBeUndefined();
  });
});
