/**
 * Stub chainable de Supabase para tests de `sync-engine.ts`.
 *
 * Simula únicamente la porción de la API de `@supabase/supabase-js` que usa
 * el motor de sincronización: `from().select().order().gt().limit()` y
 * `from().upsert()`, además de `auth.getUser()`.
 *
 * Soporta:
 * - Truncamiento programable por tabla (`maxRows`), replicando el límite
 *   `max_rows` de PostgREST (`supabase/config.toml`) que trunca resultados
 *   silenciosamente sin devolver error.
 * - Fallos programables por llamada:
 *     · `failOnCall`  → la llamada DEVUELVE `{ data: null, error }` (5xx/429
 *                        y muchos códigos PG llegan así en supabase-js).
 *     · `throwOnCall` → la llamada LANZA (fetch caído / Supabase inalcanzable).
 *   La distinción importa: `proxy.ts` se ramifica por throw-vs-`{error}`.
 * - Timestamps de servidor opcionales (`stampServerTimestamps`): al upsert,
 *   pisa `last_modified` con la hora "del servidor". Sirve para probar que
 *   una vez que el watermark se calcule server-side, el reloj desfasado del
 *   dispositivo deja de romper el pull (hallazgo #5).
 * - Versión por fila (`_version`): se incrementa en cada upsert. Permite
 *   detectar updates perdidos (hallazgo #4).
 * - Mutación puntual de una fila "del servidor" (`patchServerRow`) para
 *   simular que otro dispositivo la dejó más nueva (hallazgo #3).
 */

export type FakeRow = Record<string, unknown>;

export interface FakeSupabaseClientOptions {
  /** Al upsert, pisa `last_modified` con la hora del servidor (Date.now). */
  stampServerTimestamps?: boolean;
}

export interface FakeSupabaseError {
  message: string;
  code?: string;
}

type FakeMethod = "select" | "upsert";

interface FakeTableConfig {
  rows: FakeRow[];
  maxRows?: number;
}

interface FailureSpec {
  table: string;
  method: FakeMethod;
  callIndex: number;
  error: FakeSupabaseError;
  /** true => la llamada lanza; false/undefined => devuelve { error }. */
  throws?: boolean;
}

interface FakeFilter {
  column: string;
  op: "gt";
  value: unknown;
}

interface FakeQueryResult {
  data: FakeRow[] | null;
  error: FakeSupabaseError | null;
}

/**
 * Query builder chainable, thenable (awaitable) — imita el builder real de
 * supabase-js lo suficiente para que el código de producción funcione sin
 * cambios.
 */
class FakeQueryBuilder implements PromiseLike<FakeQueryResult> {
  private filters: FakeFilter[] = [];
  private orderColumn?: string;
  private orderAscending = true;
  private limitCount?: number;
  private upsertRows?: FakeRow[];

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly table: string
  ) {}

  select(_columns = "*"): this {
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, op: "gt", value });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  upsert(data: FakeRow | FakeRow[], _opts?: { onConflict?: string }): this {
    this.upsertRows = Array.isArray(data) ? data : [data];
    return this;
  }

  then<TResult1 = FakeQueryResult, TResult2 = never>(
    onfulfilled?: ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<FakeQueryResult> {
    if (this.upsertRows) return this.executeUpsert();
    return this.executeSelect();
  }

  private async executeUpsert(): Promise<FakeQueryResult> {
    const callIndex = this.client._nextCallIndex(this.table, "upsert");
    const failure = this.client._takeFailure(this.table, "upsert", callIndex);
    if (failure?.throws) throw Object.assign(new Error(failure.error.message), failure.error);
    if (failure) return { data: null, error: failure.error };

    const cfg = this.client._tableConfig(this.table);
    const written: FakeRow[] = [];
    for (const row of this.upsertRows ?? []) {
      const idx = cfg.rows.findIndex((r) => r.id === row.id);
      const prevVersion = idx >= 0 ? ((cfg.rows[idx]._version as number) ?? 0) : 0;
      const merged: FakeRow = {
        ...(idx >= 0 ? cfg.rows[idx] : {}),
        ...row,
        _version: prevVersion + 1,
      };
      if (this.client._stampServerTimestamps) {
        merged.last_modified = new Date().toISOString();
      }
      if (idx >= 0) cfg.rows[idx] = merged;
      else cfg.rows.push(merged);
      written.push(merged);
    }
    return { data: written, error: null };
  }

  private async executeSelect(): Promise<FakeQueryResult> {
    const callIndex = this.client._nextCallIndex(this.table, "select");
    const failure = this.client._takeFailure(this.table, "select", callIndex);
    if (failure?.throws) throw Object.assign(new Error(failure.error.message), failure.error);
    if (failure) return { data: null, error: failure.error };

    const cfg = this.client._tableConfig(this.table);
    let rows = cfg.rows.filter((row) =>
      this.filters.every((f) => {
        const rv = row[f.column];
        if (rv === undefined || rv === null) return false;
        return rv > (f.value as string | number);
      })
    );

    if (this.orderColumn) {
      const col = this.orderColumn;
      const ascending = this.orderAscending;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av < bv) return ascending ? -1 : 1;
        if (av > bv) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Simula el truncamiento silencioso de PostgREST por `max_rows`.
    let effectiveLimit = this.limitCount;
    if (cfg.maxRows !== undefined) {
      effectiveLimit =
        effectiveLimit === undefined ? cfg.maxRows : Math.min(effectiveLimit, cfg.maxRows);
    }
    if (effectiveLimit !== undefined) {
      rows = rows.slice(0, effectiveLimit);
    }

    return { data: rows, error: null };
  }
}

export class FakeSupabaseClient {
  private tables = new Map<string, FakeTableConfig>();
  private failures: FailureSpec[] = [];
  private callCounts = new Map<string, number>();
  private currentUser: { id: string } | null = { id: "fake-user-id" };

  /** @internal usado por FakeQueryBuilder */
  readonly _stampServerTimestamps: boolean;

  constructor(opts: FakeSupabaseClientOptions = {}) {
    this._stampServerTimestamps = opts.stampServerTimestamps ?? false;
  }

  auth = {
    getUser: async () => ({ data: { user: this.currentUser } }),
  };

  /** Archivos "subidos" a Storage: bucket → path → { size, contentType }. */
  readonly _storage = new Map<string, Map<string, { size: number; contentType?: string }>>();
  private storageFailPaths = new Set<string>();

  /** Hace que el próximo `upload()` a `path` lance (simula red caída). */
  failStorageUpload(path: string): void {
    this.storageFailPaths.add(path);
  }

  storage = {
    from: (bucket: string) => {
      const bucketMap = () => {
        if (!this._storage.has(bucket)) this._storage.set(bucket, new Map());
        return this._storage.get(bucket)!;
      };
      return {
        upload: async (
          path: string,
          body: Blob | ArrayBuffer,
          opts?: { upsert?: boolean; contentType?: string }
        ) => {
          if (this.storageFailPaths.has(path)) {
            this.storageFailPaths.delete(path);
            throw new Error(`storage upload failed: ${path}`);
          }
          const size = body instanceof Blob ? body.size : body.byteLength;
          bucketMap().set(path, { size, contentType: opts?.contentType });
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string, _expiresIn: number) => {
          if (!bucketMap().has(path)) {
            return { data: null, error: { message: "Object not found" } };
          }
          return {
            data: { signedUrl: `https://fake.storage/${bucket}/${path}?token=signed` },
            error: null,
          };
        },
      };
    },
  };

  /** ¿Existe el archivo en Storage? (para asserts) */
  storageHas(bucket: string, path: string): boolean {
    return this._storage.get(bucket)?.has(path) ?? false;
  }

  /** Carga filas simuladas para una tabla remota, con truncamiento opcional. */
  seedTable(table: string, rows: FakeRow[], opts?: { maxRows?: number }): void {
    this.tables.set(table, { rows: rows.map((r) => ({ ...r })), maxRows: opts?.maxRows });
  }

  /** Controla si `auth.getUser()` devuelve un usuario autenticado. */
  setUser(user: { id: string } | null): void {
    this.currentUser = user;
  }

  /**
   * Programa un fallo DEVUELTO (`{ data: null, error }`) para la N-ésima
   * llamada (`callIndex`, 1-based) a `method` sobre `table`. Así llegan en
   * supabase-js los 5xx/429 y muchos códigos PG (PGRST204, 23505, ...).
   */
  failOnCall(table: string, method: FakeMethod, callIndex: number, error: FakeSupabaseError): void {
    this.failures.push({ table, method, callIndex, error });
  }

  /**
   * Como `failOnCall` pero la llamada LANZA en vez de devolver `{ error }`
   * — simula fetch caído / Supabase inalcanzable (red total).
   */
  throwOnCall(
    table: string,
    method: FakeMethod,
    callIndex: number,
    error: FakeSupabaseError
  ): void {
    this.failures.push({ table, method, callIndex, error, throws: true });
  }

  /**
   * Muta en el lugar una fila "del servidor" ya sembrada (por id). Simula
   * que otro dispositivo la actualizó — típicamente para dejar su
   * `last_modified` por delante de la copia local (hallazgo #3).
   */
  patchServerRow(table: string, id: string, patch: FakeRow): void {
    const cfg = this._tableConfig(table);
    const idx = cfg.rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`patchServerRow: no existe ${table}#${id}`);
    cfg.rows[idx] = { ...cfg.rows[idx], ...patch };
  }

  /** Lee una fila "del servidor" para asserts. */
  getServerRow(table: string, id: string): FakeRow | undefined {
    return this._tableConfig(table).rows.find((r) => r.id === id);
  }

  /** Todas las filas "del servidor" de una tabla (copia). */
  getServerRows(table: string): FakeRow[] {
    return this._tableConfig(table).rows.map((r) => ({ ...r }));
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }

  /** Cantidad de llamadas realizadas a `method` sobre `table` (para asserts). */
  callCount(table: string, method: FakeMethod): number {
    return this.callCounts.get(`${table}:${method}`) ?? 0;
  }

  // ─── Internos usados por FakeQueryBuilder ───

  _tableConfig(table: string): FakeTableConfig {
    if (!this.tables.has(table)) this.tables.set(table, { rows: [] });
    return this.tables.get(table) as FakeTableConfig;
  }

  _nextCallIndex(table: string, method: FakeMethod): number {
    const key = `${table}:${method}`;
    const next = (this.callCounts.get(key) ?? 0) + 1;
    this.callCounts.set(key, next);
    return next;
  }

  _takeFailure(
    table: string,
    method: FakeMethod,
    callIndex: number
  ): { error: FakeSupabaseError; throws?: boolean } | null {
    const idx = this.failures.findIndex(
      (f) => f.table === table && f.method === method && f.callIndex === callIndex
    );
    if (idx === -1) return null;
    const spec = this.failures[idx];
    return { error: spec.error, throws: spec.throws };
  }
}

export function createFakeSupabaseClient(opts?: FakeSupabaseClientOptions): FakeSupabaseClient {
  return new FakeSupabaseClient(opts);
}
