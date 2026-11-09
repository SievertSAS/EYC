import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeRole, type RoleContextValue } from "@/test/roles";

// ============================================================
//  Ajustes → Director Técnico (#194): nombre, título y firma que salen en
//  el bloque "Responsable Sievert S.A.S." de todos los informes.
//  Solo el coordinador lo ve y lo edita.
// ============================================================

let role: RoleContextValue = makeRole("coordinador");
vi.mock("@/components/role-provider", () => ({ useRole: () => role }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/storage", () => ({
  compressImage: async (b: Blob) => b,
  resolverImagenSrc: async () => null,
}));

import { DirectorTecnicoForm } from "./director-tecnico-form";

const fetchMock = vi.fn();

beforeEach(async () => {
  await resetTestDb();
  role = makeRole("coordinador");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

describe("DirectorTecnicoForm", () => {
  it("no se muestra a un rol distinto de coordinador", () => {
    role = makeRole("programador");
    const { container } = render(<DirectorTecnicoForm />);
    expect(container).toBeEmptyDOMElement();
  });

  it("precarga los datos configurados", async () => {
    await db.configuracion_informe.put({
      id: "global",
      director_nombre: "Directora Configurada",
      director_titulo: "Física Médica",
    });
    render(<DirectorTecnicoForm />);
    await waitFor(() =>
      expect((screen.getByLabelText(/Nombre del Director/i) as HTMLInputElement).value).toBe(
        "Directora Configurada"
      )
    );
    expect((screen.getByLabelText(/Título bajo la firma/i) as HTMLInputElement).value).toBe(
      "Física Médica"
    );
  });

  it("guardar envía PATCH a la API y deja la fila devuelta en Dexie", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        configuracion: { id: "global", director_nombre: "Nuevo Director", director_titulo: null },
      }),
    });
    render(<DirectorTecnicoForm />);
    fireEvent.change(await screen.findByLabelText(/Nombre del Director/i), {
      target: { value: "Nuevo Director" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/configuracion-informe");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toMatchObject({ director_nombre: "Nuevo Director" });
    await waitFor(async () =>
      expect((await db.configuracion_informe.get("global"))?.director_nombre).toBe("Nuevo Director")
    );
  });

  it("precarga la licencia y la envía al guardar", async () => {
    await db.configuracion_informe.put({
      id: "global",
      director_nombre: "Directora",
      director_licencia: "Licencia N.º 0001",
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        configuracion: { id: "global", director_licencia: "Licencia N.º 0002" },
      }),
    });
    render(<DirectorTecnicoForm />);
    const licencia = (await screen.findByLabelText(/Licencia/i)) as HTMLInputElement;
    await waitFor(() => expect(licencia.value).toBe("Licencia N.º 0001"));
    fireEvent.change(licencia, { target: { value: "Licencia N.º 0002" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ director_licencia: "Licencia N.º 0002" });
  });
});
