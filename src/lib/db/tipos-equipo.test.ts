import { describe, it, expect } from "vitest";
import { TIPOS_EQUIPO, tiposEquipoSeleccionables } from "./types";

describe("tiposEquipoSeleccionables (#187)", () => {
  it("no ofrece RX_PORTATIL: el portátil es un CONVENCIONAL marcado como portátil", () => {
    const tipos = tiposEquipoSeleccionables();
    expect(tipos).not.toContain("RX_PORTATIL");
    expect(tipos).toContain("CONVENCIONAL");
  });

  it("conserva el resto de tipos en el mismo orden", () => {
    expect(tiposEquipoSeleccionables()).toEqual(TIPOS_EQUIPO.filter((t) => t !== "RX_PORTATIL"));
  });

  it("un equipo existente de tipo RX_PORTATIL sigue mostrando su tipo al editarlo", () => {
    expect(tiposEquipoSeleccionables("RX_PORTATIL")).toContain("RX_PORTATIL");
  });

  it("editar un equipo de otro tipo no vuelve a ofrecer RX_PORTATIL", () => {
    expect(tiposEquipoSeleccionables("CONVENCIONAL")).not.toContain("RX_PORTATIL");
  });
});
