# 8. Guía de desarrollo

## 8.1 Requisitos previos

- **Node.js 20+** (ver `@types/node` ^20).
- Un proyecto **Supabase** (URL, anon key, service role key).
- Recomendado: la Supabase CLI para aplicar migraciones (`supabase/`).

## 8.2 Setup

```bash
npm install
cp .env.example .env.local     # completar variables de Supabase
npm run dev                    # http://localhost:3000
```

Variables en `.env.local` (validadas por [`src/lib/env.ts`](../src/lib/env.ts)):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo server-side
```

Si faltan, la app lanza un error explícito de `[env]` indicando qué variable falta.

## 8.3 Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build y arranque de producción |
| `npm run lint` | ESLint |
| `npm run test` | Vitest en watch |
| `npm run test:run` | Vitest, corrida única (CI) |
| `npm run test:coverage` | Cobertura |
| `npm run format` / `format:check` | Prettier (write / check) |
| `npx tsc --noEmit` | Chequeo de tipos |

## 8.4 Convenciones de código

Fuente: [CLAUDE.md](../CLAUDE.md). Resumen:

- **Prettier**: comillas dobles, punto y coma, 2 espacios, 100 columnas.
- **Imports** con alias `@/` desde `src/`.
- Componentes UI de shadcn/ui en `src/components/ui/`.
- **Variables de entorno**: importar de `@/lib/env`, nunca `process.env` directo.
- **Fórmulas de pruebas**: usar `helpers.*` en vez de IIFEs dentro de strings evaluados.
- **Sync engine**: loguear errores con `@/lib/logger`; nunca `catch` vacíos.
- ⚠️ **Next.js 16 tiene breaking changes** respecto a versiones anteriores. Antes de escribir
  código de framework, consultar las guías en `node_modules/next/dist/docs/` y respetar los avisos
  de deprecación (ver [AGENTS.md](../AGENTS.md)). Ejemplo concreto: se usa **`proxy.ts`**, no
  `middleware.ts`.

## 8.5 Testing

Vitest + Testing Library + `fake-indexeddb` + `happy-dom`. Áreas con cobertura crítica:

- [`lib/equipos/engine.test.ts`](../src/lib/equipos/engine.test.ts) — motor de fórmulas, criterios
  y **sandbox de seguridad** (correr siempre tras tocar la blocklist).
- [`lib/workflow/visit-state-machine.test.ts`](../src/lib/workflow/visit-state-machine.test.ts) —
  transiciones de estado y roles.
- [`lib/validation/schemas.test.ts`](../src/lib/validation/schemas.test.ts) — validación Zod.
- [`lib/db/permisos.test.ts`](../src/lib/db/permisos.test.ts) — resolución de permisos.

Diseño testeable: `engine.ts` y las funciones de permisos/estado son **puras** (sin Dexie/React),
por eso se prueban directo. El código que toca Supabase se importa dinámicamente para no
arrastrarlo en tests.

## 8.6 Migraciones

### Dexie (IndexedDB, cliente)

- Se declaran en [`src/lib/db/index.ts`](../src/lib/db/index.ts) como `this.version(n).stores({...})`.
- **Nunca modificar una versión ya publicada.** Para cambiar el esquema, **añadir una versión
  nueva**; Dexie exige que todas las anteriores sigan declaradas.
- Migraciones de datos con `.upgrade(async (tx) => {...})` (ejemplo real: v4, `tecnicos`→`usuarios`).
- Índices útiles: indexar `sync_status` en tablas sincronizables (lo consulta el sync engine) y
  los FKs por los que se filtra (`visita_id`, `equipo_id`, etc.).
- La migración a UUID (v13) requiere DB vacía → usar `src/lib/db/reset.ts`.

### Supabase (PostgreSQL, servidor)

- Archivos numerados en [`supabase/migrations/`](../supabase/migrations/) (001 → 009).
- Mantener el **espejo** entre Dexie y PostgreSQL (nombres de tabla/columna, tipos, UUID).
- Al crear tablas nuevas: añadir **RLS**, regenerar `src/lib/supabase/types.ts`, e incluir la
  tabla en `SYNC_TABLES`/`MASTER_TABLES` del sync engine si debe sincronizarse.
- Reset de datos: `supabase/scripts/reset_all_data.sql`.

## 8.7 Cómo añadir un tipo de equipo nuevo

1. Crear `src/lib/equipos/<tipo>/` con:
   - `modulos.ts` — pasos de la visita (`ModuloVisita[]`).
   - `grupos.ts` — grupos y pruebas (`GrupoPruebaDefinition[]`) con `formulas`, `criterios_aceptacion`, `textos_informe`.
   - `db/types.ts` — tablas dedicadas (`<tipo>_*`) y su registro en el esquema Dexie (versión nueva).
   - `informe.ts` — `generarInforme(visitaId)`.
   - `index.ts` — exporta el `EquipmentPackage`.
2. Registrarlo en `PACKAGES` de [`registry.ts`](../src/lib/equipos/registry.ts).
3. Crear las páginas de captura en `app/dashboard/visitas/[id]/<tipo>/...`.
4. Implementar la completitud de sus módulos en [`module-completeness.ts`](../src/lib/workflow/module-completeness.ts).
5. Añadir las tablas al sync y a Supabase (con RLS).

El resto de la app (workflow, registro, gate, navegación) funciona sin cambios porque consulta el
paquete a través del registro.

## 8.8 Flujo de trabajo Git

- Se trabaja y se pushea en la rama **`dev`**; a `main` se llega vía **Pull Request**.
- El repositorio **no usa `gh` CLI** para operaciones de GitHub.
- Rama actual por defecto para PRs: `main`.

## 8.9 Estructura de una visita (mapa de pantallas)

```
/dashboard/visitas                       Listado con % de completitud
/dashboard/visitas/[id]                  Workspace: módulos, progreso, barra de acciones
/dashboard/visitas/[id]/info             Precarga de información general (7 secciones)
/dashboard/visitas/[id]/conv/grupo-a     Grupo A — levantamiento + inspección
/dashboard/visitas/[id]/conv/grupo-b     Grupo B — RaySafe
/dashboard/visitas/[id]/conv/grupo-c     Grupo C — CAE
/dashboard/visitas/[id]/conv/grupo-d     Grupo D — DDI/EI, cassettes, uniformidad CR
/dashboard/visitas/[id]/conv/grupo-e     Grupo E — colimación, resolución, contraste, MTF
/dashboard/visitas/[id]/pre-informe      Editor visual del pre-informe (drag & drop)
```

## 8.10 Roadmap

Ver [`../TODO.md`](../TODO.md). Prioridades abiertas: conectar el **generador PDF** con las tablas
`conv_*`, **importación RaySafe**, incluir `conv_*` en el **sync** (+ tablas Supabase), activar
**`trackChange`** para auditoría, y completar la **completitud** de los grupos B–E.
