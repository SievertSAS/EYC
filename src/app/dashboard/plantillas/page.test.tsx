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
});
