// Verifica que el andamiaje de test (src/test/setup.ts) esté bien enchufado.
// Si este archivo falla, TODOS los tests de componentes están en riesgo.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

describe("andamiaje de test", () => {
  it("los matchers de jest-dom están disponibles", () => {
    render(createElement("button", { disabled: true }, "Guardar"));
    const boton = screen.getByRole("button", { name: "Guardar" });

    // Estos matchers vienen de @testing-library/jest-dom; si no está
    // enchufado en setup.ts, esta línea lanza "toBeDisabled is not a function".
    expect(boton).toBeInTheDocument();
    expect(boton).toBeDisabled();
    expect(boton).toHaveTextContent("Guardar");
  });

  it("cleanup() desmonta el DOM entre tests", () => {
    // El test anterior renderizó un <button>. Si cleanup() del afterEach
    // no corriera, seguiría en el document acá.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
