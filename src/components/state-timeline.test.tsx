import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StateTimeline } from "./state-timeline";
import { ESTADO_ORDER, ESTADO_CONFIG } from "@/lib/workflow/visit-state-machine";

afterEach(cleanup);

describe("StateTimeline", () => {
  it("renderiza un paso por cada estado del ciclo de vida", () => {
    render(<StateTimeline currentState="asignada" />);
    for (const estado of ESTADO_ORDER) {
      // El label aparece dos veces (variante sm y variante mobile).
      expect(screen.getAllByText(ESTADO_CONFIG[estado].label).length).toBeGreaterThan(0);
    }
  });

  it("marca el estado actual con la clase del dot resaltado", () => {
    const { container } = render(<StateTimeline currentState="en_revision" />);
    const dots = container.querySelectorAll("div.rounded-full.border-2");
    // El índice de `en_revision` en ESTADO_ORDER es el dot con ring-primary.
    const idx = ESTADO_ORDER.indexOf("en_revision");
    expect(dots[idx].className).toContain("ring-primary/20");
  });

  it("no explota si el estado no está en el orden (índice -1)", () => {
    expect(() => render(<StateTimeline currentState={"desconocido" as never} />)).not.toThrow();
  });
});
