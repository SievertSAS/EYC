import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  crearSupabaseAdminMock,
  type ConsultaMock,
  type RespuestaMock,
} from "@/test/supabase-admin-mock";

// ============================================================
//  POST /api/plantillas/publicar — publica el borrador como versión nueva
//  (#196). La numeración y la transición borrador → publicada ocurren en
//  la función SQL `publicar_plantilla_informe` (atómica, con lock).
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
  caller: { id: "coord-1", cargo: "coordinador", activo: true } as Record<string, unknown> | null,
  rpc: { data: null, error: null } as RespuestaMock,
};

function responder(c: ConsultaMock): RespuestaMock {
  if (c.tabla === "usuarios") return { data: state.caller, error: null };
  if (c.op === "rpc") return state.rpc;
  return { data: null, error: null };
}
let mock = crearSupabaseAdminMock(responder);

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
  headers: async () => new Map([["x-forwarded-for", state.ip]]),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mock.client }));

import { POST } from "./route";

function req(body: unknown) {
  return { json: async () => body } as Parameters<typeof POST>[0];
}

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  state.ip = `10.3.0.${ipCounter}`;
  state.user = { id: "auth-coord" };
  state.caller = { id: "coord-1", cargo: "coordinador", activo: true };
  state.rpc = {
    data: { id: "borr-1", tipo_equipo: "CONVENCIONAL", estado: "publicada", version: 2 },
    error: null,
  };
  mock = crearSupabaseAdminMock(responder);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/plantillas/publicar", () => {
  it("401 sin sesión", async () => {
    state.user = null;
    expect((await POST(req({ tipo_equipo: "CONVENCIONAL" }))).status).toBe(401);
  });

  it("403 para cualquier cargo distinto de coordinador", async () => {
    for (const cargo of ["programador", "tecnico", "comercial"]) {
      state.caller = { id: "x", cargo, activo: true };
      expect((await POST(req({ tipo_equipo: "CONVENCIONAL" }))).status, cargo).toBe(403);
    }
    expect(mock.consultas.some((c) => c.op === "rpc")).toBe(false);
  });

  it("400 con tipo de equipo inválido", async () => {
    expect((await POST(req({ tipo_equipo: "NAVE" }))).status).toBe(400);
  });

  it("publica vía RPC registrando quién publica y devuelve la versión nueva", async () => {
    const res = await POST(req({ tipo_equipo: "CONVENCIONAL" }));
    expect(res.status).toBe(200);
    const rpc = mock.consultas.find((c) => c.op === "rpc");
    expect(rpc?.tabla).toBe("publicar_plantilla_informe");
    expect(rpc?.payload).toEqual({ p_tipo_equipo: "CONVENCIONAL", p_publicada_por: "coord-1" });
    expect((await res.json()).plantilla).toMatchObject({ estado: "publicada", version: 2 });
  });

  it("409 si no hay borrador para publicar", async () => {
    state.rpc = { data: null, error: { message: "No hay borrador", code: "P0002" } };
    const res = await POST(req({ tipo_equipo: "CONVENCIONAL" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/borrador/i);
  });

  it("500 ante otro error de la base, sin filtrar el detalle", async () => {
    state.rpc = { data: null, error: { message: "relation secreta", code: "XX000" } };
    const res = await POST(req({ tipo_equipo: "CONVENCIONAL" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secreta");
  });
});
