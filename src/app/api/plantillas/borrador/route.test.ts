import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  crearSupabaseAdminMock,
  type ConsultaMock,
  type RespuestaMock,
} from "@/test/supabase-admin-mock";

// ============================================================
//  PUT /api/plantillas/borrador — guardar el borrador de la plantilla
//  de informe de un tipo de equipo (#196). Solo el coordinador.
//
//  Contrato:
//   - 429 rate limit · 401 sin sesión · 403 cualquier cargo ≠ coordinador
//   - 400 body inválido sin filtrar el schema
//   - crea el borrador si no hay, o actualiza el existente (nunca una publicada)
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
  borradorExistente: null as { id: string } | null,
};

function responder(c: ConsultaMock): RespuestaMock {
  if (c.tabla === "usuarios") return { data: state.caller, error: null };
  if (c.op === "select") return { data: state.borradorExistente, error: null };
  if (c.op === "insert") return { data: { id: "nuevo", ...(c.payload as object) }, error: null };
  if (c.op === "update")
    return { data: { id: c.filtros.id, ...(c.payload as object) }, error: null };
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

import { PUT } from "./route";

function req(body: unknown) {
  return { json: async () => body } as Parameters<typeof PUT>[0];
}

const valido = {
  tipo_equipo: "CONVENCIONAL",
  codigo: "FT-LEC-6c",
  contenido: { introduccion: "Intro.", pruebas: { "2.1": { objetivo: "Objetivo nuevo" } } },
};

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  state.ip = `10.2.0.${ipCounter}`;
  state.user = { id: "auth-coord" };
  state.caller = { id: "coord-1", cargo: "coordinador", activo: true };
  state.borradorExistente = null;
  mock = crearSupabaseAdminMock(responder);
});
afterEach(() => vi.clearAllMocks());

describe("PUT /api/plantillas/borrador", () => {
  it("401 sin sesión", async () => {
    state.user = null;
    expect((await PUT(req(valido))).status).toBe(401);
  });

  it("403 para un programador (solo el coordinador edita plantillas)", async () => {
    state.caller = { id: "p-1", cargo: "programador", activo: true };
    expect((await PUT(req(valido))).status).toBe(403);
  });

  it("403 para un coordinador deshabilitado", async () => {
    state.caller = { id: "coord-1", cargo: "coordinador", activo: false };
    expect((await PUT(req(valido))).status).toBe(403);
  });

  it("400 con body inválido, sin filtrar el detalle del schema", async () => {
    const res = await PUT(req({ ...valido, contenido: { pruebas: { "2.1": { hack: 1 } } } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Datos inválidos");
  });

  it("sin borrador previo → inserta uno nuevo con creada_por del coordinador", async () => {
    const res = await PUT(req(valido));
    expect(res.status).toBe(200);
    const insert = mock.consultas.find((c) => c.op === "insert");
    expect(insert?.tabla).toBe("plantillas_informe");
    expect(insert?.payload).toMatchObject({
      tipo_equipo: "CONVENCIONAL",
      codigo: "FT-LEC-6c",
      estado: "borrador",
      creada_por: "coord-1",
    });
    expect((await res.json()).plantilla.id).toBe("nuevo");
  });

  it("con borrador previo → actualiza ESE borrador (filtrado por estado borrador)", async () => {
    state.borradorExistente = { id: "borr-1" };
    const res = await PUT(req(valido));
    expect(res.status).toBe(200);
    const buscar = mock.consultas.find(
      (c) => c.tabla === "plantillas_informe" && c.op === "select"
    );
    expect(buscar?.filtros).toMatchObject({ tipo_equipo: "CONVENCIONAL", estado: "borrador" });
    const update = mock.consultas.find((c) => c.op === "update");
    expect(update?.filtros).toMatchObject({ id: "borr-1", estado: "borrador" });
    expect(update?.payload).not.toHaveProperty("estado");
    expect(mock.consultas.some((c) => c.op === "insert")).toBe(false);
  });

  it("429 al superar el límite por IP", async () => {
    state.ip = "203.0.113.50";
    for (let i = 0; i < 20; i++) expect((await PUT(req(valido))).status).toBe(200);
    expect((await PUT(req(valido))).status).toBe(429);
  });
});
