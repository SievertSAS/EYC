import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
//  POST /api/usuarios — el ÚNICO chequeo de rol server-enforced.
//
//  Contrato de seguridad verificado acá:
//   - 429 cuando se supera el rate limit por IP
//   - 401 sin sesión
//   - 403 autenticado pero cargo != coordinador
//   - 400 body inválido, SIN filtrar detalles del schema
//   - 201 + rollback del usuario auth si falla el insert en `usuarios`
// ============================================================

vi.mock("@/lib/env", () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  },
  getServerEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "service-role" }),
}));

// Estado configurable por test
const state = {
  ip: "1.1.1.1",
  user: null as { id: string } | null,
  callerCargo: "coordinador" as string | null,
  createUserResult: {
    data: { user: { id: "new-auth-uid" } },
    error: null as { message: string } | null,
  },
  insertResult: {
    data: { id: "u-new" } as { id: string } | null,
    error: null as { message: string } | null,
  },
};
const deleteUser = vi.fn().mockResolvedValue({ error: null });

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
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: state.callerCargo ? { cargo: state.callerCargo } : null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({ single: async () => state.insertResult }),
      }),
    }),
    auth: {
      admin: {
        createUser: async () => state.createUserResult,
        deleteUser: deleteUser,
      },
    },
  }),
}));

import { POST } from "./route";

function req(body: unknown) {
  return { json: async () => body } as Parameters<typeof POST>[0];
}

const validBody = {
  email: "nuevo@sievert.com",
  password: "clave1234",
  nombre: "Persona Nueva",
  cedula: "1234567",
  cargo: "tecnico",
};

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  state.ip = `10.0.0.${ipCounter}`; // IP única por test → rate limit aislado
  state.user = { id: "caller-auth-uid" };
  state.callerCargo = "coordinador";
  state.createUserResult = { data: { user: { id: "new-auth-uid" } }, error: null };
  state.insertResult = { data: { id: "u-new" }, error: null };
  deleteUser.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/usuarios", () => {
  it("crea el usuario y responde 201 para un coordinador con body válido", async () => {
    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.usuario).toEqual({ id: "u-new" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("responde 401 si no hay sesión", async () => {
    state.user = null;
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("responde 403 si el llamante no es coordinador", async () => {
    state.callerCargo = "tecnico";
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("responde 403 si el llamante no existe en la tabla usuarios", async () => {
    state.callerCargo = null;
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("responde 400 con body inválido y NO filtra el detalle del schema", async () => {
    const res = await POST(req({ email: "no-es-email", password: "x" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Datos inválidos");
    expect(JSON.stringify(json)).not.toMatch(/password|regex|schema|issues/i);
  });

  it("rechaza un cargo fuera del enum permitido", async () => {
    const res = await POST(req({ ...validBody, cargo: "superadmin" }));
    expect(res.status).toBe(400);
  });

  it("hace rollback del usuario auth si falla el insert en usuarios", async () => {
    state.insertResult = { data: null, error: { message: "duplicate key" } };
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith("new-auth-uid");
  });

  it("responde 429 al superar el límite de 5 solicitudes por minuto y misma IP", async () => {
    state.ip = "203.0.113.9";
    for (let i = 0; i < 5; i++) {
      const ok = await POST(req(validBody));
      expect(ok.status).toBe(201);
    }
    const blocked = await POST(req(validBody));
    expect(blocked.status).toBe(429);
  });
});
