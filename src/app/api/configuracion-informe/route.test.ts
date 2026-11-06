import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  crearSupabaseAdminMock,
  type ConsultaMock,
  type RespuestaMock,
} from "@/test/supabase-admin-mock";

// ============================================================
//  PATCH /api/configuracion-informe — datos del Director Técnico que firma
//  todos los informes (#194/#195). Configuración global (fila única), solo
//  editable por el coordinador.
//
//  Contrato:
//   - 429 rate limit · 401 sin sesión · 403 cargo ≠ coordinador (o deshabilitado)
//   - 400 body inválido sin filtrar el schema
//   - upsert de la fila 'global' con actualizado_por = usuario llamante
//   - firma (multipart): se sube al bucket evidencias y se guarda el path
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
  upload: { data: {}, error: null } as RespuestaMock,
};

function responder(c: ConsultaMock): RespuestaMock {
  if (c.tabla === "usuarios") return { data: state.caller, error: null };
  if (c.op === "upload") return state.upload;
  if (c.op === "upsert") return { data: { ...(c.payload as object) }, error: null };
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

import { PATCH } from "./route";

function reqJson(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => "application/json" },
  } as unknown as Parameters<typeof PATCH>[0];
}

function reqMultipart(campos: Record<string, string>, firma?: File) {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  if (firma) form.append("firma", firma);
  return {
    formData: async () => form,
    headers: { get: () => "multipart/form-data; boundary=x" },
  } as unknown as Parameters<typeof PATCH>[0];
}

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  state.ip = `10.4.0.${ipCounter}`;
  state.user = { id: "auth-coord" };
  state.caller = { id: "coord-1", cargo: "coordinador", activo: true };
  state.upload = { data: {}, error: null };
  mock = crearSupabaseAdminMock(responder);
});
afterEach(() => vi.clearAllMocks());

describe("PATCH /api/configuracion-informe", () => {
  it("401 sin sesión", async () => {
    state.user = null;
    expect((await PATCH(reqJson({ director_nombre: "X" }))).status).toBe(401);
  });

  it("403 para cualquier cargo distinto de coordinador", async () => {
    for (const cargo of ["programador", "tecnico", "comercial"]) {
      state.caller = { id: "x", cargo, activo: true };
      expect((await PATCH(reqJson({ director_nombre: "X" }))).status, cargo).toBe(403);
    }
    expect(mock.consultas.some((c) => c.op === "upsert")).toBe(false);
  });

  it("403 para un coordinador deshabilitado", async () => {
    state.caller = { id: "coord-1", cargo: "coordinador", activo: false };
    expect((await PATCH(reqJson({ director_nombre: "X" }))).status).toBe(403);
  });

  it("400 con body inválido, sin filtrar el detalle del schema", async () => {
    const res = await PATCH(reqJson({ director_nombre: "x".repeat(151), hack: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Datos inválidos");
  });

  it("guarda nombre y título en la fila única, registrando quién la actualizó", async () => {
    const res = await PATCH(
      reqJson({ director_nombre: "  Ana Pérez  ", director_titulo: "Física Médica" })
    );
    expect(res.status).toBe(200);
    const upsert = mock.consultas.find((c) => c.op === "upsert");
    expect(upsert?.tabla).toBe("configuracion_informe");
    expect(upsert?.payload).toMatchObject({
      id: "global",
      director_nombre: "Ana Pérez",
      director_titulo: "Física Médica",
      actualizado_por: "coord-1",
    });
    expect((await res.json()).configuracion.director_nombre).toBe("Ana Pérez");
  });

  it("título vacío → null (el PDF cae a 'Director Técnico')", async () => {
    await PATCH(reqJson({ director_titulo: "   " }));
    const upsert = mock.consultas.find((c) => c.op === "upsert");
    expect(upsert?.payload).toMatchObject({ director_titulo: null });
  });

  it("con firma (multipart) la sube al bucket evidencias y guarda el path", async () => {
    const firma = new File([new Uint8Array([1, 2, 3])], "firma.jpg", { type: "image/jpeg" });
    const res = await PATCH(reqMultipart({ director_nombre: "Ana" }, firma));
    expect(res.status).toBe(200);
    const upload = mock.consultas.find((c) => c.op === "upload");
    expect(upload?.tabla).toBe("evidencias");
    const path = upload?.filtros.path as string;
    expect(path).toMatch(/^configuracion\/director-firma-\d+\.jpg$/);
    const upsert = mock.consultas.find((c) => c.op === "upsert");
    expect(upsert?.payload).toMatchObject({ director_firma_url: path, director_nombre: "Ana" });
  });

  it("si falla la subida de la firma → 500 y no toca la fila", async () => {
    state.upload = { data: null, error: { message: "bucket" } };
    const firma = new File([new Uint8Array([1])], "firma.jpg", { type: "image/jpeg" });
    const res = await PATCH(reqMultipart({}, firma));
    expect(res.status).toBe(500);
    expect(mock.consultas.some((c) => c.op === "upsert")).toBe(false);
  });

  it("director_firma_url: null quita la firma", async () => {
    await PATCH(reqJson({ director_firma_url: null }));
    const upsert = mock.consultas.find((c) => c.op === "upsert");
    expect(upsert?.payload).toMatchObject({ director_firma_url: null });
  });

  it("nada que actualizar → 400", async () => {
    expect((await PATCH(reqJson({}))).status).toBe(400);
  });

  it("429 al superar el límite por IP", async () => {
    state.ip = "203.0.113.77";
    for (let i = 0; i < 10; i++)
      expect((await PATCH(reqJson({ director_nombre: "A" }))).status).toBe(200);
    expect((await PATCH(reqJson({ director_nombre: "A" }))).status).toBe(429);
  });
});
