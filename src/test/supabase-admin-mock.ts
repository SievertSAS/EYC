// Mock mínimo del cliente service-role de Supabase para tests de API routes.
//
// Cada consulta se registra (tabla, operación, filtros, payload) y se
// resuelve con `responder(consulta)`, que el test configura. Soporta las
// formas que usan las rutas: select/insert/update encadenados con
// eq/is + single/maybeSingle, o `await` directo; `rpc` y `storage.upload`.

export interface ConsultaMock {
  tabla: string;
  op: "select" | "insert" | "update" | "upsert" | "rpc" | "upload";
  filtros: Record<string, unknown>;
  payload?: unknown;
  cols?: string;
}

export type RespuestaMock = { data: unknown; error: { message: string; code?: string } | null };

export function crearSupabaseAdminMock(responder: (c: ConsultaMock) => RespuestaMock) {
  const consultas: ConsultaMock[] = [];

  function builder(c: ConsultaMock) {
    const resolver = async () => {
      consultas.push(c);
      return responder(c);
    };
    const b = {
      eq: (k: string, v: unknown) => {
        c.filtros[k] = v;
        return b;
      },
      is: (k: string, v: unknown) => {
        c.filtros[k] = v;
        return b;
      },
      select: (cols?: string) => {
        c.cols = cols;
        return b;
      },
      single: resolver,
      maybeSingle: resolver,
      then: (ok: (r: RespuestaMock) => unknown, ko?: (e: unknown) => unknown) =>
        resolver().then(ok, ko),
    };
    return b;
  }

  const client = {
    from: (tabla: string) => ({
      select: (cols?: string) => builder({ tabla, op: "select", filtros: {}, cols }),
      insert: (payload: unknown) => builder({ tabla, op: "insert", filtros: {}, payload }),
      update: (payload: unknown) => builder({ tabla, op: "update", filtros: {}, payload }),
      upsert: (payload: unknown) => builder({ tabla, op: "upsert", filtros: {}, payload }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _bytes: unknown, opts: unknown) => {
          const c: ConsultaMock = { tabla: bucket, op: "upload", filtros: { path }, payload: opts };
          consultas.push(c);
          return responder(c);
        },
      }),
    },
    rpc: async (fn: string, args: unknown) => {
      const c: ConsultaMock = { tabla: fn, op: "rpc", filtros: {}, payload: args };
      consultas.push(c);
      return responder(c);
    },
  };

  return { client, consultas };
}
