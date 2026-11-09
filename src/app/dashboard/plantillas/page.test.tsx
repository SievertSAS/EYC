import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeRole, type RoleContextValue } from "@/test/roles";

// ============================================================
//  /dashboard/plantillas — editor de plantillas de informe (#196)
//  Solo el coordinador ve y edita; guarda borrador y publica vía API.
// ============================================================

let role: RoleContextValue = makeRole("coordinador", { usuarioId: "coord-1" });
vi.mock("@/components/db-provider", () => ({ useDb: () => ({ isReady: true }) }));
vi.mock("@/components/role-provider", () => ({ useRole: () => role }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PlantillasPage from "./page";

const fetchMock = vi.fn();

beforeEach(async () => {
  await resetTestDb();
  role = makeRole("coordinador", { usuarioId: "coord-1" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

describe("PlantillasPage", () => {
  it("un rol distinto de coordinador no ve el editor", async () => {
    role = makeRole("programador");
    render(<PlantillasPage />);
    expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar borrador/i })).toBeNull();
  });

  it("sin versiones publicadas, precarga los textos del sistema y lo indica", async () => {
    render(<PlantillasPage />);
    expect(await screen.findByText(/textos del sistema/i)).toBeInTheDocument();
    const codigo = (await screen.findByLabelText(/Código del informe/i)) as HTMLInputElement;
    expect(codigo.value).toBe("FT-LEC-6c");
  });

  it("guardar borrador envía el contenido a la API y guarda la fila devuelta en Dexie", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        plantilla: {
          id: "borr-1",
          tipo_equipo: "CONVENCIONAL",
          codigo: "FT-NUEVO",
          version: null,
          estado: "borrador",
          contenido: { pruebas: {} },
        },
      }),
    });
    render(<PlantillasPage />);
    const codigo = await screen.findByLabelText(/Código del informe/i);
    fireEvent.change(codigo, { target: { value: "FT-NUEVO" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar borrador/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/plantillas/borrador");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ tipo_equipo: "CONVENCIONAL", codigo: "FT-NUEVO" });
    expect(body.contenido.pruebas["2.1"].objetivo).toMatch(/levantamiento radiométrico/);
    await waitFor(async () => expect(await db.plantillas_informe.get("borr-1")).toBeTruthy());
  });

  it("muestra el historial de versiones publicadas con quién y cuándo", async () => {
    await db.usuarios.add({
      id: "coord-1",
      nombre: "Coordinadora Historial",
      cedula: "1",
      cargo: "coordinador",
      activo: true,
    });
    await db.plantillas_informe.add({
      id: "v1",
      tipo_equipo: "CONVENCIONAL",
      codigo: "FT-LEC-6c",
      version: 1,
      estado: "publicada",
      contenido: { pruebas: {} },
      publicada_por: "coord-1",
      publicada_en: "2026-10-01T15:00:00Z",
    });
    render(<PlantillasPage />);
    expect(await screen.findByText("Coordinadora Historial")).toBeInTheDocument();
    expect(screen.getAllByText(/v1/).length).toBeGreaterThan(0);
  });

  describe("#187 — variante portátil del convencional", () => {
    function respuestaOk() {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          plantilla: {
            id: "borr-2",
            tipo_equipo: "CONVENCIONAL",
            codigo: "FT-LEC-6c",
            version: null,
            estado: "borrador",
            contenido: { pruebas: {} },
          },
        }),
      });
    }

    it("el toggle Portátil muestra y edita los textos de la variante; se guardan aparte", async () => {
      respuestaOk();
      render(<PlantillasPage />);
      const intro = (await screen.findByLabelText(/^Introducción/i)) as HTMLTextAreaElement;
      expect(intro.value).not.toContain("equipo portátil");

      fireEvent.click(screen.getByRole("radio", { name: "Portátil" }));
      const introPortatil = (await screen.findByLabelText(/^Introducción/i)) as HTMLTextAreaElement;
      expect(introPortatil.value).toContain("equipo portátil de rayos X");
      fireEvent.change(introPortatil, { target: { value: "INTRO-PORTATIL-EDITADA" } });

      // La metodología de la 2.5 del portátil viene sin "sobre la mesa".
      const met25 = screen.getByLabelText("Metodología", {
        selector: "#plantilla-portatil-2\\.5-metodologia",
      }) as HTMLTextAreaElement;
      expect(met25.value).not.toContain("sobre la mesa");

      fireEvent.click(screen.getByRole("button", { name: /Guardar borrador/i }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.contenido.variantes.portatil.introduccion).toBe("INTRO-PORTATIL-EDITADA");
      // El texto del fijo no cambia.
      expect(body.contenido.introduccion).toMatch(/^El presente informe técnico documenta/);
      expect(body.contenido.introduccion).not.toContain("INTRO-PORTATIL-EDITADA");
    });

    it("el convencional abre en Fijo; un campo vacío del portátil muestra el texto del fijo", async () => {
      render(<PlantillasPage />);
      const fijo = await screen.findByRole("radio", { name: "Fijo" });
      expect(fijo.getAttribute("aria-checked")).toBe("true");
      fireEvent.click(screen.getByRole("radio", { name: "Portátil" }));
      // La 2.3 no cambia en el portátil: vacío, con el texto del fijo de placeholder.
      const obj23 = screen.getByLabelText("Objetivo", {
        selector: "#plantilla-portatil-2\\.3-objetivo",
      }) as HTMLTextAreaElement;
      expect(obj23.value).toBe("");
      expect(obj23.placeholder).toMatch(/campo luminoso/);
    });
  });
});
