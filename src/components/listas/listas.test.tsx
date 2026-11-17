import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { VistaToggle } from "./vista-toggle";
import { KanbanBoard } from "./kanban-board";
import { FiltrosBar, type CampoFiltro } from "./filtros-bar";

describe("VistaToggle", () => {
  it("es un radiogroup accesible y emite la vista elegida", () => {
    const onChange = vi.fn();
    render(<VistaToggle value="tabla" onChange={onChange} />);
    const grupo = screen.getByRole("radiogroup", { name: /vista/i });
    expect(within(grupo).getByRole("radio", { name: "Tabla" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(within(grupo).getByRole("radio", { name: "Kanban" }));
    expect(onChange).toHaveBeenCalledWith("kanban");
  });
});

describe("KanbanBoard", () => {
  it("una columna por estado con su conteo y estado vacío", () => {
    render(
      <KanbanBoard
        ariaLabel="Tablero de prueba"
        columnas={[
          { id: "a", titulo: "Abierta", badgeClassName: "", items: ["x", "y"] },
          { id: "b", titulo: "Cerrada", badgeClassName: "", items: [] },
        ]}
        getKey={(i) => i}
        renderItem={(i) => <span>item {i}</span>}
      />
    );
    const abierta = screen.getByRole("region", { name: "Abierta (2)" });
    expect(within(abierta).getByText("item x")).toBeInTheDocument();
    expect(within(abierta).getAllByRole("listitem")).toHaveLength(2);
    const cerrada = screen.getByRole("region", { name: "Cerrada (0)" });
    expect(within(cerrada).getByText(/Sin elementos/i)).toBeInTheDocument();
  });
});

describe("FiltrosBar", () => {
  function campos(over: { onClientes?: (v: string[]) => void; onFechas?: () => void } = {}) {
    const c: CampoFiltro[] = [
      {
        tipo: "multiple",
        id: "cliente",
        label: "Cliente",
        opciones: [
          { value: "c1", label: "Clínica Norte" },
          { value: "c2", label: "Hospital Sur" },
        ],
        valores: ["c1", "c2"],
        onChange: over.onClientes ?? vi.fn(),
      },
      {
        tipo: "fechas",
        id: "fecha",
        label: "Fecha",
        desde: "2026-01-01",
        hasta: null,
        onChange: over.onFechas ?? vi.fn(),
      },
      {
        tipo: "opcion",
        id: "pago",
        label: "Pago",
        opciones: [
          { value: "todos", label: "Todos" },
          { value: "si", label: "Sí" },
        ],
        valor: "todos",
        valorPorDefecto: "todos",
        onChange: vi.fn(),
      },
    ];
    return c;
  }

  it("muestra el conteo, un chip por valor activo y quita solo ese valor", () => {
    const onClientes = vi.fn();
    render(<FiltrosBar campos={campos({ onClientes })} activos={2} onLimpiar={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Filtros.*2/ })).toBeInTheDocument();
    expect(screen.getByText("Cliente: Clínica Norte")).toBeInTheDocument();
    expect(screen.getByText("Fecha: desde 2026-01-01")).toBeInTheDocument();
    // "Todos" es el valor por defecto: sin chip
    expect(screen.queryByText(/Pago:/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Cliente: Clínica Norte" }));
    expect(onClientes).toHaveBeenCalledWith(["c2"]);
  });

  it("'Limpiar filtros' solo aparece con filtros activos", () => {
    const onLimpiar = vi.fn();
    const { rerender } = render(<FiltrosBar campos={[]} activos={0} onLimpiar={onLimpiar} />);
    expect(screen.queryByRole("button", { name: /Limpiar filtros/ })).toBeNull();
    rerender(<FiltrosBar campos={campos()} activos={2} onLimpiar={onLimpiar} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Limpiar filtros/ })[0]);
    expect(onLimpiar).toHaveBeenCalled();
  });

  it("los inputs de fecha emiten el rango", () => {
    const onFechas = vi.fn();
    render(<FiltrosBar campos={campos({ onFechas })} activos={1} onLimpiar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Fecha desde"), { target: { value: "2026-02-01" } });
    expect(onFechas).toHaveBeenCalledWith("2026-02-01", null);
  });
});
