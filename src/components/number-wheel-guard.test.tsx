import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NumberWheelGuard } from "./number-wheel-guard";

afterEach(cleanup);

function renderConInputs() {
  render(
    <>
      <NumberWheelGuard />
      <input type="number" aria-label="numero" defaultValue="5" />
      <input type="text" aria-label="texto" />
    </>
  );
  return {
    numero: screen.getByLabelText("numero") as HTMLInputElement,
    texto: screen.getByLabelText("texto") as HTMLInputElement,
  };
}

describe("NumberWheelGuard", () => {
  it("blurs a focused number input on wheel so the value cannot change", () => {
    const { numero } = renderConInputs();
    numero.focus();
    fireEvent.wheel(numero);
    expect(document.activeElement).not.toBe(numero);
    expect(numero.value).toBe("5");
  });

  it("leaves other focused inputs alone", () => {
    const { texto } = renderConInputs();
    texto.focus();
    fireEvent.wheel(texto);
    expect(document.activeElement).toBe(texto);
  });

  it("ignores wheel over a number input that is not focused", () => {
    const { numero, texto } = renderConInputs();
    texto.focus();
    fireEvent.wheel(numero);
    expect(document.activeElement).toBe(texto);
  });
});
