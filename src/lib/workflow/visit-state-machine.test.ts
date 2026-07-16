import { describe, it, expect } from "vitest";
import { getAvailableActions, canTransition, ESTADO_ORDER } from "./visit-state-machine";

describe("getAvailableActions", () => {
  it("tecnico can start an assigned visit", () => {
    const actions = getAvailableActions("asignada", "tecnico");
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("iniciar_visita");
    expect(actions[0].target).toBe("en_progreso");
  });

  it("coordinador can start an assigned visit", () => {
    const actions = getAvailableActions("asignada", "coordinador");
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("iniciar_visita");
  });

  it("tecnico can send a visit in progress to review", () => {
    const actions = getAvailableActions("en_progreso", "tecnico");
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("enviar_revision");
    expect(actions[0].hasGate).toBe(true);
    expect(actions[0].target).toBe("en_revision");
  });

  it("coordinador can approve or return from en_revision", () => {
    const actions = getAvailableActions("en_revision", "coordinador");
    expect(actions).toHaveLength(2);
    const actionNames = actions.map((a) => a.action);
    expect(actionNames).toContain("aprobar");
    expect(actionNames).toContain("devolver");
  });

  it("devolver requires a reason", () => {
    const actions = getAvailableActions("en_revision", "coordinador");
    const devolver = actions.find((a) => a.action === "devolver");
    expect(devolver?.requiereRazon).toBe(true);
  });

  it("coordinador/programador can mark an approved visit as sent", () => {
    for (const role of ["coordinador", "programador"] as const) {
      const actions = getAvailableActions("aprobada", role);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe("marcar_enviado");
      expect(actions[0].target).toBe("enviada");
    }
  });

  it("tecnico has no actions on an approved visit", () => {
    expect(getAvailableActions("aprobada", "tecnico")).toHaveLength(0);
  });

  it("coordinador/programador can request client adjustments from enviada", () => {
    for (const role of ["coordinador", "programador"] as const) {
      const actions = getAvailableActions("enviada", role);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe("solicitar_ajustes_cliente");
      expect(actions[0].target).toBe("en_progreso");
      expect(actions[0].requiereRazon).toBe(true);
    }
  });

  it("comercial has no actions at any state", () => {
    for (const state of ESTADO_ORDER) {
      const actions = getAvailableActions(state, "comercial");
      expect(actions, `comercial should have no actions at ${state}`).toHaveLength(0);
    }
  });
});

describe("canTransition", () => {
  it("tecnico can transition asignada → en_progreso", () => {
    expect(canTransition("asignada", "iniciar_visita", "tecnico")).toBe(true);
  });

  it("tecnico cannot approve from en_revision (tecnico CAN in this app)", () => {
    expect(canTransition("en_revision", "aprobar", "tecnico")).toBe(true);
  });

  it("cannot skip states", () => {
    expect(canTransition("asignada", "enviar_revision", "tecnico")).toBe(false);
    expect(canTransition("asignada", "aprobar", "coordinador")).toBe(false);
  });

  it("devolver returns visit to en_progreso", () => {
    const actions = getAvailableActions("en_revision", "coordinador");
    const devolver = actions.find((a) => a.action === "devolver");
    expect(devolver?.target).toBe("en_progreso");
  });
});

describe("ESTADO_ORDER", () => {
  it("has 5 states in correct order", () => {
    expect(ESTADO_ORDER).toEqual(["asignada", "en_progreso", "en_revision", "aprobada", "enviada"]);
  });
});
