import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FechaParcialInput } from "./fecha-parcial-input";

afterEach(cleanup);

const anio = () => screen.getByLabelText("Año") as HTMLInputElement;
const mes = () => screen.getByLabelText("Mes") as HTMLSelectElement;
const dia = () => screen.getByLabelText("Día") as HTMLSelectElement;

describe("FechaParcialInput", () => {
  it("shows the parts of a stored value", () => {
    render(<FechaParcialInput value="2019-03-15" onChange={vi.fn()} />);
    expect(anio().value).toBe("2019");
    expect(mes().value).toBe("03");
    expect(dia().value).toBe("15");
  });

  it("emits year only once four digits are typed", () => {
    const onChange = vi.fn();
    render(<FechaParcialInput value="" onChange={onChange} />);
    fireEvent.change(anio(), { target: { value: "201" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(anio(), { target: { value: "2019" } });
    expect(onChange).toHaveBeenLastCalledWith("2019");
  });

  it("emits year and month", () => {
    const onChange = vi.fn();
    render(<FechaParcialInput value="2019" onChange={onChange} />);
    fireEvent.change(mes(), { target: { value: "03" } });
    expect(onChange).toHaveBeenLastCalledWith("2019-03");
  });

  it("disables the day until a month is chosen", () => {
    render(<FechaParcialInput value="2019" onChange={vi.fn()} />);
    expect(dia().disabled).toBe(true);
  });

  it("clearing the month also clears the day", () => {
    const onChange = vi.fn();
    render(<FechaParcialInput value="2019-03-15" onChange={onChange} />);
    fireEvent.change(mes(), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("2019");
    expect(dia().value).toBe("");
  });

  it("emits empty when the year is cleared", () => {
    const onChange = vi.fn();
    render(<FechaParcialInput value="2019-03" onChange={onChange} />);
    fireEvent.change(anio(), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("ignores non-digit characters in the year", () => {
    render(<FechaParcialInput value="" onChange={vi.fn()} />);
    fireEvent.change(anio(), { target: { value: "20a1" } });
    expect(anio().value).toBe("201");
  });
});
