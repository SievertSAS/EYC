import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NumberInput } from "./number-input";

afterEach(cleanup);

describe("NumberInput (#68)", () => {
  it("muestra el número con coma decimal (es-CO)", () => {
    render(<NumberInput value={1.8} onValueChange={vi.fn()} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("1,8");
  });

  it("tipear con coma entrega un number normalizado", () => {
    const onValueChange = vi.fn();
    render(<NumberInput value={undefined} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2,5" } });
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
  });

  it("tipear con punto también entrega el mismo number", () => {
    const onValueChange = vi.fn();
    render(<NumberInput value={undefined} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2.5" } });
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
  });

  it("vacío entrega undefined", () => {
    const onValueChange = vi.fn();
    render(<NumberInput value={3} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith(undefined);
  });

  it("al perder foco re-formatea a coma", () => {
    render(<NumberInput value={undefined} onValueChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "10.25" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("10,25");
  });

  it("usa inputMode decimal (teclado numérico en tablet)", () => {
    render(<NumberInput value={0} onValueChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("inputmode", "decimal");
  });
});
