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
 * - Fallos programables por llamada (`failOnCall`), para simular una página
 *   intermedia que falla durante la paginación.
 */

export type FakeRow = Record<string, unknown>;

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
    if (failure) return { data: null, error: failure };

    const cfg = this.client._tableConfig(this.table);
    for (const row of this.upsertRows ?? []) {
      const idx = cfg.rows.findIndex((r) => r.id === row.id);
      if (idx >= 0) cfg.rows[idx] = { ...cfg.rows[idx], ...row };
      else cfg.rows.push({ ...row });
    }
    return { data: this.upsertRows ?? [], error: null };
  }

  private async executeSelect(): Promise<FakeQueryResult> {
    const callIndex = this.client._nextCallIndex(this.table, "select");
    const failure = this.client._takeFailure(this.table, "select", callIndex);
    if (failure) return { data: null, error: failure };

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

  auth = {
    getUser: async () => ({ data: { user: this.currentUser } }),
  };

  /** Carga filas simuladas para una tabla remota, con truncamiento opcional. */
  seedTable(table: string, rows: FakeRow[], opts?: { maxRows?: number }): void {
    this.tables.set(table, { rows: [...rows], maxRows: opts?.maxRows });
  }

  /** Controla si `auth.getUser()` devuelve un usuario autenticado. */
  setUser(user: { id: string } | null): void {
    this.currentUser = user;
  }

  /**
   * Programa un fallo para la N-ésima llamada (`callIndex`, 1-based) a
   * `method` sobre `table`. Útil para simular que una página intermedia de
   * paginación falla.
   */
  failOnCall(table: string, method: FakeMethod, callIndex: number, error: FakeSupabaseError): void {
    this.failures.push({ table, method, callIndex, error });
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

  _takeFailure(table: string, method: FakeMethod, callIndex: number): FakeSupabaseError | null {
    const idx = this.failures.findIndex(
      (f) => f.table === table && f.method === method && f.callIndex === callIndex
    );
    if (idx === -1) return null;
    return this.failures[idx].error;
  }
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}
