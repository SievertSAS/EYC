import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
//  PATCH /api/usuarios/[id] — edición server-enforced (#58).
//
//  `usuarios` es MASTER_TABLE: el push del cliente no la toca, así que
//  editar un usuario TIENE que pasar por acá. Mismo gate que el POST.
//
//  Contrato verificado:
//   - 429 al superar el rate limit por IP
//   - 401 sin sesión
//   - 403 autenticado pero cargo != coordinador
//   - 400 body inválido (sin filtrar el detalle del schema) / patch vacío
//   - 404 si el id no existe
//   - 200 + fila actualizada para un coordinador con body válido
// ============================================================

vi.mock("@/lib/env", () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  },
  getServerEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "service-role" }),
}));

const state = {
  ip: "1.1.1.1",
  user: null as { id: string } | null,
  callerCargo: "coordinador" as string | null,
  updateResult: {
    data: { id: "u-1", nombre: "Editado", activo: true } as Record<string, unknown> | null,
    error: null as { message: string; code?: string } | null,
  },
};
const updateSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
  headers: async () => new Map([["x-forwarded-for", state.ip]]),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (_table: string) => ({
      // caller cargo lookup
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: state.callerCargo ? { cargo: state.callerCargo } : null,
          }),
        }),
      }),
      // update(...).eq(...).select().single()
      update: (cambios: Record<string, unknown>) => {
        updateSpy(cambios);
        return {
          eq: () => ({
            select: () => ({ single: async () => state.updateResult }),
          }),
        };
      },
    }),
  }),
}));

import { PATCH } from "./route";

function req(body: unknown, id = "u-1") {
  return [
    { json: async () => body } as Parameters<typeof PATCH>[0],
    { params: Promise.resolve({ id }) },
  ] as const;
}

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  state.ip = `10.1.0.${ipCounter}`;
  state.user = { id: "caller-auth-uid" };
  state.callerCargo = "coordinador";
  state.updateResult = {
    data: { id: "u-1", nombre: "Editado", activo: true },
    error: null,
  };
  updateSpy.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("PATCH /api/usuarios/[id]", () => {
  it("actualiza y responde 200 con la fila para un coordinador", async () => {
    const res = await PATCH(...req({ nombre: "Nombre Nuevo", activo: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.usuario).toEqual({ id: "u-1", nombre: "Editado", activo: true });
  });

  it("normaliza telefono '' → null y solo manda los campos presentes", async () => {
    await PATCH(...req({ cargo: "programador", telefono: "" }));
    expect(updateSpy).toHaveBeenCalledWith({ cargo: "programador", telefono: null });
  });

  it("acepta el toggle activo suelto", async () => {
    const res = await PATCH(...req({ activo: false }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ activo: false });
  });

  it("responde 401 sin sesión", async () => {
    state.user = null;
    const res = await PATCH(...req({ activo: false }));
    expect(res.status).toBe(401);
  });

  it("responde 403 si el llamante no es coordinador", async () => {
    state.callerCargo = "tecnico";
    const res = await PATCH(...req({ activo: false }));
    expect(res.status).toBe(403);
  });

  it("responde 400 con body inválido sin filtrar el schema", async () => {
    const res = await PATCH(...req({ cedula: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Datos inválidos");
    expect(JSON.stringify(json)).not.toMatch(/regex|schema|issues/i);
  });

  it("responde 400 con un patch vacío", async () => {
    const res = await PATCH(...req({}));
    expect(res.status).toBe(400);
  });

  it("rechaza un cargo fuera del enum", async () => {
    const res = await PATCH(...req({ cargo: "superadmin" }));
    expect(res.status).toBe(400);
  });

  it("responde 404 si el usuario no existe (PGRST116)", async () => {
    state.updateResult = { data: null, error: { message: "no rows", code: "PGRST116" } };
    const res = await PATCH(...req({ activo: false }));
    expect(res.status).toBe(404);
  });

  it("responde 429 al superar el límite por IP", async () => {
    state.ip = "203.0.113.55";
    for (let i = 0; i < 10; i++) {
      const ok = await PATCH(...req({ activo: false }));
      expect(ok.status).toBe(200);
    }
    const blocked = await PATCH(...req({ activo: false }));
    expect(blocked.status).toBe(429);
  });
});
