import { describe, it, expect } from "vitest";
import {
  getAvailableActions,
  canTransition,
  esTecnicoAsignado,
  ESTADO_ORDER,
} from "./visit-state-machine";

const ASIGNADO = { esAsignado: true } as const;

describe("getAvailableActions", () => {
  it("assigned tecnico can start an assigned visit", () => {
    const actions = getAvailableActions("asignada", "tecnico", ASIGNADO);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("iniciar_visita");
    expect(actions[0].target).toBe("en_progreso");
  });

  it("coordinador can start an assigned visit", () => {
    const actions = getAvailableActions("asignada", "coordinador");
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("iniciar_visita");
  });

  it("assigned tecnico can send a visit in progress to review", () => {
    const actions = getAvailableActions("en_progreso", "tecnico", ASIGNADO);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("enviar_revision");
    expect(actions[0].hasGate).toBe(true);
    expect(actions[0].target).toBe("en_revision");
  });

  it("coordinador can also send a visit in progress to review, with the same gate", () => {
    const actions = getAvailableActions("en_progreso", "coordinador");
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("enviar_revision");
    expect(actions[0].hasGate).toBe(true);
    expect(actions[0].target).toBe("en_revision");
  });

  it("programador cannot send a visit in progress to review", () => {
    expect(getAvailableActions("en_progreso", "programador")).toHaveLength(0);
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

  it("assigned tecnico can approve or return their own visit from en_revision", () => {
    const actionNames = getAvailableActions("en_revision", "tecnico", ASIGNADO).map(
      (a) => a.action
    );
    expect(actionNames).toEqual(["aprobar", "devolver"]);
  });

  it("tecnico has no actions on an approved visit", () => {
    expect(getAvailableActions("aprobada", "tecnico", ASIGNADO)).toHaveLength(0);
  });

  it("tecnico NOT assigned to the visit has no actions at any state", () => {
    for (const state of ESTADO_ORDER) {
      expect(getAvailableActions(state, "tecnico", { esAsignado: false })).toHaveLength(0);
    }
  });

  it("tecnico without proven assignment (no ctx) has no actions — secure default", () => {
    for (const state of ESTADO_ORDER) {
      expect(getAvailableActions(state, "tecnico")).toHaveLength(0);
    }
  });

  it("coordinador/programador actions do not depend on assignment", () => {
    for (const role of ["coordinador", "programador"] as const) {
      for (const state of ESTADO_ORDER) {
        const sinCtx = getAvailableActions(state, role).map((a) => a.action);
        const noAsignado = getAvailableActions(state, role, { esAsignado: false }).map(
          (a) => a.action
        );
        expect(noAsignado).toEqual(sinCtx);
      }
    }
    expect(getAvailableActions("en_revision", "programador", { esAsignado: false })).toHaveLength(
      2
    );
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
  it("assigned tecnico can transition asignada → en_progreso", () => {
    expect(canTransition("asignada", "iniciar_visita", "tecnico", ASIGNADO)).toBe(true);
  });

  it("assigned tecnico can approve from en_revision", () => {
    expect(canTransition("en_revision", "aprobar", "tecnico", ASIGNADO)).toBe(true);
  });

  it("tecnico not assigned cannot approve nor start the visit", () => {
    expect(canTransition("en_revision", "aprobar", "tecnico", { esAsignado: false })).toBe(false);
    expect(canTransition("en_revision", "devolver", "tecnico")).toBe(false);
    expect(canTransition("asignada", "iniciar_visita", "tecnico")).toBe(false);
  });

  it("coordinador can approve regardless of assignment", () => {
    expect(canTransition("en_revision", "aprobar", "coordinador")).toBe(true);
  });

  it("cannot skip states", () => {
    expect(canTransition("asignada", "enviar_revision", "tecnico", ASIGNADO)).toBe(false);
    expect(canTransition("asignada", "aprobar", "coordinador")).toBe(false);
  });

  it("devolver returns visit to en_progreso", () => {
    const actions = getAvailableActions("en_revision", "coordinador");
    const devolver = actions.find((a) => a.action === "devolver");
    expect(devolver?.target).toBe("en_progreso");
  });
});

describe("esTecnicoAsignado", () => {
  it("true only when the visit's tecnico is the current user", () => {
    expect(esTecnicoAsignado("u1", "u1")).toBe(true);
    expect(esTecnicoAsignado("u1", "u2")).toBe(false);
  });

  it("missing tecnico or user never counts as assigned", () => {
    expect(esTecnicoAsignado(undefined, "u1")).toBe(false);
    expect(esTecnicoAsignado(null, "u1")).toBe(false);
    expect(esTecnicoAsignado("u1", undefined)).toBe(false);
    expect(esTecnicoAsignado(undefined, undefined)).toBe(false);
    expect(esTecnicoAsignado("", "")).toBe(false);
  });
});

describe("ESTADO_ORDER", () => {
  it("has 5 states in correct order", () => {
    expect(ESTADO_ORDER).toEqual(["asignada", "en_progreso", "en_revision", "aprobada", "enviada"]);
  });
});
