@AGENTS.md

# Sievert EyC — Convenciones

## Stack

- Next.js 16 (usa `proxy.ts` en vez de `middleware.ts`)
- React 19, TypeScript strict, Tailwind CSS 4
- Supabase (auth + PostgreSQL), Dexie (IndexedDB offline)
- Zod v4 para validacion (`zod/v4`)

## Comandos

- `npm run dev` — dev server
- `npm run test:run` — tests (Vitest)
- `npx tsc --noEmit` — type check
- `npm run format:check` — Prettier check
- `npm run lint` — ESLint

## Convenciones de codigo

- Prettier: double quotes, semicolons, 2 spaces, 100 cols
- Imports con alias `@/` desde `src/`
- Componentes UI de shadcn/ui en `src/components/ui/`
- Variables de entorno: importar desde `@/lib/env` (nunca `process.env` directo)
- Formulas de pruebas: usar `helpers.*` en vez de IIFEs en strings evaluados
- Sync engine: loguear errores con `@/lib/logger`, nunca catch vacios

## Estructura clave

- `src/lib/equipos/` — paquetes de equipo, engine de formulas, definiciones de pruebas por tipo
- `src/lib/workflow/` — state machine de visitas, completitud de modulos
- `src/lib/supabase/sync-engine.ts` — sync bidireccional offline/online
- `src/lib/pdf/generar-pre-informe.ts` — generacion PDF (dynamic import de jsPDF)
- `src/app/api/usuarios/route.ts` — unica API route (creacion de usuarios, requiere coordinador)

## Seguridad

- `src/lib/equipos/engine.ts` valida expresiones con BLOCKED_PATTERNS antes de `new Function()`
- API de usuarios tiene rate limiting (`@/lib/rate-limit`)
- `proxy.ts` protege rutas `/dashboard/*` server-side
- Paginas con restriccion de rol usan `hasPermission()` de `useRole()`
