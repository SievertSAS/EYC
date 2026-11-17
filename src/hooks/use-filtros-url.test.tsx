import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fijarUrl } from "@/test/search-params";
import { parseFiltrosVisitas, serializarFiltrosVisitas } from "@/lib/listas/filtros-visitas";

vi.mock("next/navigation", async () => {
  const { useSearchParamsDeVentana } = await import("@/test/search-params");
  return { useSearchParams: useSearchParamsDeVentana };
});

import { useFiltrosUrl } from "./use-filtros-url";

describe("useFiltrosUrl", () => {
  it("lee los filtros desde la URL", () => {
    fijarUrl("/dashboard/visitas?vista=kanban&tipo=CT");
    const { result } = renderHook(() =>
      useFiltrosUrl(parseFiltrosVisitas, serializarFiltrosVisitas)
    );
    expect(result.current[0].vista).toBe("kanban");
    expect(result.current[0].tipos).toEqual(["CT"]);
  });

  it("actualiza la URL con replaceState (sin navegar) y conserva el resto", () => {
    fijarUrl("/dashboard/visitas?tipo=CT");
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useFiltrosUrl(parseFiltrosVisitas, serializarFiltrosVisitas)
    );
    act(() => result.current[1]({ vista: "kanban" }));
    // Dos cambios seguidos antes del re-render no se pisan
    act(() => {
      result.current[1]({ ciudades: ["Cali"] });
      result.current[1]({ desde: "2026-01-01" });
    });
    expect(window.location.pathname).toBe("/dashboard/visitas");
    expect(window.location.search).toBe("?vista=kanban&tipo=CT&ciudad=Cali&desde=2026-01-01");
    expect(result.current[0].ciudades).toEqual(["Cali"]);
    expect(push).not.toHaveBeenCalled();
  });

  it("volver a los valores por defecto limpia la query", () => {
    fijarUrl("/dashboard/visitas?vista=kanban");
    const { result } = renderHook(() =>
      useFiltrosUrl(parseFiltrosVisitas, serializarFiltrosVisitas)
    );
    act(() => result.current[1]({ vista: "tabla" }));
    expect(window.location.search).toBe("");
  });
});
