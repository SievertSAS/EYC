import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useReseedOnOpen } from "./use-reseed-on-open";

afterEach(cleanup);

function Harness({ open, entity, seed }: { open: boolean; entity: unknown; seed: () => void }) {
  // `entity` está en las props para forzar re-render; el hook NO debe
  // re-sembrar por su cambio de identidad.
  useReseedOnOpen(open, seed);
  return <span data-testid="e">{JSON.stringify(entity)}</span>;
}

describe("useReseedOnOpen", () => {
  it("no siembra si arranca cerrado", () => {
    const seed = vi.fn();
    render(<Harness open={false} entity={{}} seed={seed} />);
    expect(seed).not.toHaveBeenCalled();
  });

  it("siembra una vez al abrir", () => {
    const seed = vi.fn();
    const { rerender } = render(<Harness open={false} entity={{}} seed={seed} />);
    rerender(<Harness open={true} entity={{}} seed={seed} />);
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("#11: NO re-siembra si el padre pasa un objeto nuevo mientras está abierto", () => {
    const seed = vi.fn();
    const { rerender } = render(<Harness open={true} entity={{ v: 1 }} seed={seed} />);
    expect(seed).toHaveBeenCalledTimes(1);

    // El padre spreadea un objeto nuevo en cada render — identidad distinta.
    rerender(<Harness open={true} entity={{ v: 1 }} seed={seed} />);
    rerender(<Harness open={true} entity={{ v: 2 }} seed={seed} />);
    expect(seed).toHaveBeenCalledTimes(1); // sigue en 1
  });

  it("re-siembra al cerrar y volver a abrir (con datos frescos)", () => {
    let count = 0;
    const seed = vi.fn(() => count++);
    const { rerender } = render(<Harness open={true} entity={{}} seed={seed} />);
    rerender(<Harness open={false} entity={{}} seed={seed} />);
    rerender(<Harness open={true} entity={{}} seed={seed} />);
    expect(seed).toHaveBeenCalledTimes(2);
  });

  it("usa el seed más reciente (no una versión vieja del closure)", () => {
    const seedA = vi.fn();
    const seedB = vi.fn();
    const { rerender } = render(<Harness open={false} entity={{}} seed={seedA} />);
    rerender(<Harness open={false} entity={{}} seed={seedB} />);
    rerender(<Harness open={true} entity={{}} seed={seedB} />);
    expect(seedA).not.toHaveBeenCalled();
    expect(seedB).toHaveBeenCalledTimes(1);
  });
});
