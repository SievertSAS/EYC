import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManualDrawer } from "./manual-drawer";
import { getManualGrupo } from "@/lib/equipos/convencional/manual";

const PRUEBAS = getManualGrupo("A");

afterEach(cleanup);

describe("ManualDrawer", () => {
  it("no monta nada si open=false", () => {
    const { container } = render(<ManualDrawer open={false} onClose={vi.fn()} pruebas={PRUEBAS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no monta nada si no hay pruebas, aunque open=true", () => {
    const { container } = render(<ManualDrawer open onClose={vi.fn()} pruebas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("monta el panel y muestra la primera prueba cuando open=true", async () => {
    render(<ManualDrawer open onClose={vi.fn()} pruebas={PRUEBAS} />);
    expect(await screen.findByText("Manual")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: PRUEBAS[0].nombre })).toBeInTheDocument();
  });

  it("abre en la prueba indicada por pruebaCodigo", async () => {
    const target = PRUEBAS[1] ?? PRUEBAS[0];
    render(<ManualDrawer open onClose={vi.fn()} pruebas={PRUEBAS} pruebaCodigo={target.codigo} />);
    expect(await screen.findByRole("heading", { name: target.nombre })).toBeInTheDocument();
  });

  it("cambia de prueba al clickear un tab", async () => {
    const otra = PRUEBAS[2] ?? PRUEBAS[PRUEBAS.length - 1];
    render(<ManualDrawer open onClose={vi.fn()} pruebas={PRUEBAS} />);
    await screen.findByText("Manual");
    const tabs = screen.getAllByRole("button", { name: otra.codigo });
    fireEvent.click(tabs[0]);
    expect(await screen.findByRole("heading", { name: otra.nombre })).toBeInTheDocument();
  });

  it("llama onClose al presionar Escape", async () => {
    const onClose = vi.fn();
    render(<ManualDrawer open onClose={onClose} pruebas={PRUEBAS} />);
    await screen.findByText("Manual");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("llama onClose al clickear el botón X", async () => {
    const onClose = vi.fn();
    render(<ManualDrawer open onClose={onClose} pruebas={PRUEBAS} />);
    await screen.findByText("Manual");
    // El botón X no tiene texto accesible; es el primer botón sin código de prueba.
    const closeBtn = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg") && !b.textContent?.trim());
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });
});
