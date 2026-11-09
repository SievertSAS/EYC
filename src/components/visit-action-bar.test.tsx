import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ============================================================
//  VisitActionBar — gating del ciclo de vida de la visita.
//
//  Se mockean SOLO los efectos de la state-machine (checkGate,
//  executeTransition); getAvailableActions y el mapa de transiciones son
//  reales, así se verifica que la barra ofrece exactamente las acciones que
//  el (estado, rol) permite.
// ============================================================

const useRole = vi.fn();
vi.mock("@/components/role-provider", () => ({ useRole: () => useRole() }));

const checkGate = vi.fn();
const executeTransition = vi.fn();
vi.mock("@/lib/workflow/visit-state-machine", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/workflow/visit-state-machine")>();
  return {
    ...actual,
    checkGate: (...args: unknown[]) => checkGate(...args),
    executeTransition: (...args: unknown[]) => executeTransition(...args),
  };
});

import { VisitActionBar } from "./visit-action-bar";

const asRole = (cargo: string) => useRole.mockReturnValue({ role: { cargo, usuarioId: "u1" } });

describe("VisitActionBar", () => {
  beforeEach(() => {
    checkGate.mockResolvedValue({ canProceed: true, errors: [] });
    executeTransition.mockResolvedValue({ success: true, newState: "en_revision" });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("no renderiza nada si no hay rol resuelto", () => {
    useRole.mockReturnValue({ role: null });
    const { container } = render(<VisitActionBar visitaId="v1" estadoVisita="asignada" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ofrece 'Iniciar Visita' al técnico asignado en estado asignada", () => {
    asRole("tecnico");
    render(<VisitActionBar visitaId="v1" estadoVisita="asignada" tecnicoId="u1" />);
    expect(screen.getByRole("button", { name: /Iniciar Visita/i })).toBeInTheDocument();
  });

  it("no ofrece acciones a un comercial (rol sin transiciones)", () => {
    asRole("comercial");
    const { container } = render(<VisitActionBar visitaId="v1" estadoVisita="asignada" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("bloquea 'Enviar a Revisión' si el gate de completitud falla", async () => {
    asRole("tecnico");
    checkGate.mockResolvedValue({
      canProceed: false,
      errors: [{ moduleId: "grupo-a", message: "Grupo A incompleto" }],
    });
    render(<VisitActionBar visitaId="v1" estadoVisita="en_progreso" tecnicoId="u1" />);

    fireEvent.click(screen.getByRole("button", { name: /Enviar a Revisión/i }));

    expect(await screen.findByText("Módulos incompletos")).toBeInTheDocument();
    expect(screen.getByText("Grupo A incompleto")).toBeInTheDocument();
    expect(executeTransition).not.toHaveBeenCalled();
  });

  it("ejecuta la transición y notifica onTransition cuando el gate pasa", async () => {
    asRole("tecnico");
    const onTransition = vi.fn();
    render(
      <VisitActionBar
        visitaId="v1"
        estadoVisita="en_progreso"
        tecnicoId="u1"
        onTransition={onTransition}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Enviar a Revisión/i }));

    await waitFor(() => expect(onTransition).toHaveBeenCalledWith("en_revision"));
    expect(executeTransition).toHaveBeenCalledWith(
      "v1",
      "enviar_revision",
      "tecnico",
      expect.objectContaining({ usuarioId: "u1" })
    );
  });

  it("una acción con requiereRazon pide el motivo antes de ejecutar", async () => {
    asRole("coordinador");
    render(<VisitActionBar visitaId="v1" estadoVisita="en_revision" />);

    fireEvent.click(screen.getByRole("button", { name: /Devolver con Observaciones/i }));

    const textarea = await screen.findByPlaceholderText(/Describe el motivo/i);
    const confirmar = screen.getByRole("button", { name: /Confirmar/i });
    expect(confirmar).toBeDisabled();
    expect(executeTransition).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "Falta calibrar el tubo" } });
    expect(confirmar).toBeEnabled();

    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(executeTransition).toHaveBeenCalledWith(
        "v1",
        "devolver",
        "coordinador",
        expect.objectContaining({ observaciones_revision: "Falta calibrar el tubo" })
      )
    );
  });

  it("muestra el estado terminal cuando no hay acciones (aprobada)", () => {
    asRole("tecnico");
    render(<VisitActionBar visitaId="v1" estadoVisita="aprobada" tecnicoId="u1" />);
    expect(screen.getByText(/Visita aprobada/i)).toBeInTheDocument();
  });

  it("muestra el estado terminal 'enviada' sin acciones para un técnico", () => {
    asRole("tecnico");
    render(<VisitActionBar visitaId="v1" estadoVisita="enviada" tecnicoId="u1" />);
    expect(screen.getByText(/Informe enviado al cliente/i)).toBeInTheDocument();
  });

  // ─── #211: solo el técnico asignado (o un admin) actúa sobre la visita ───

  it("el técnico asignado ve Aprobar / Devolver en revisión", () => {
    asRole("tecnico");
    render(<VisitActionBar visitaId="v1" estadoVisita="en_revision" tecnicoId="u1" />);
    expect(screen.getByRole("button", { name: /Aprobar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Devolver con Observaciones/i })).toBeInTheDocument();
  });

  it("un técnico NO asignado no ve acciones en asignada ni en progreso", () => {
    asRole("tecnico");
    for (const estado of ["asignada", "en_progreso"] as const) {
      const { container } = render(
        <VisitActionBar visitaId="v1" estadoVisita={estado} tecnicoId="otro" />
      );
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("un técnico NO asignado en revisión solo ve el aviso de espera, sin Aprobar/Devolver", () => {
    asRole("tecnico");
    render(<VisitActionBar visitaId="v1" estadoVisita="en_revision" tecnicoId="otro" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/En espera de revisión del ingeniero/i)).toBeInTheDocument();
  });

  it("sin técnico conocido en la visita, un técnico no recibe acciones (default seguro)", () => {
    asRole("tecnico");
    const { container } = render(<VisitActionBar visitaId="v1" estadoVisita="asignada" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("coordinador y programador actúan aunque no sean el técnico asignado", () => {
    asRole("coordinador");
    render(<VisitActionBar visitaId="v1" estadoVisita="asignada" tecnicoId="otro" />);
    expect(screen.getByRole("button", { name: /Iniciar Visita/i })).toBeInTheDocument();
    cleanup();

    asRole("programador");
    render(<VisitActionBar visitaId="v1" estadoVisita="en_revision" tecnicoId="otro" />);
    expect(screen.getByRole("button", { name: /Aprobar/i })).toBeInTheDocument();
  });
});
