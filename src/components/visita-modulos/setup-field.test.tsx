import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SetupField } from "./setup-field";

afterEach(cleanup);

describe("SetupField", () => {
  it("guarda el valor on-blur y muestra el check de confirmación", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(<SetupField label="Distancia" defaultValue={100} onSave={onSave} />);

    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledWith("120");
    // El check se limpia tras 1500ms.
    vi.advanceTimersByTime(1500);
    vi.useRealTimers();
  });

  it("no es controlado: editar no requiere re-render del padre", () => {
    const onSave = vi.fn();
    render(<SetupField label="Técnica" defaultValue="" type="text" onSave={onSave} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "abc" } });
    expect((input as HTMLInputElement).value).toBe("abc");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith("abc");
  });
});
