# Sievert EyC

Aplicacion web PWA para inspecciones de equipos de radiacion ionizante. Permite a tecnicos de campo realizar evaluaciones de cumplimiento normativo (Resolucion 1811, TECDOC 1958) con soporte offline completo.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS 4
- **Auth + Backend:** Supabase (PostgreSQL + Auth)
- **Offline DB:** Dexie (IndexedDB) con 22 tablas y sync bidireccional
- **PDF:** jsPDF + jspdf-autotable para pre-informes
- **UI:** shadcn/ui, Lucide icons

## Arquitectura

```
app/src/
  app/           # Rutas Next.js (App Router)
    dashboard/   # Area autenticada (visitas, informes, config...)
    login/       # Autenticacion con Supabase Auth
    api/         # API routes (usuarios)
  lib/
    db/          # Schema Dexie, tipos, seeders
    equipos/     # Paquetes de equipo, engine de formulas, definiciones de pruebas
    supabase/    # Cliente, server, sync engine
    workflow/    # State machine de visitas, completitud, validacion
    pdf/         # Generacion de pre-informes PDF
    validation/  # Schemas Zod
    env.ts       # Validacion de variables de entorno
    logger.ts    # Logger estructurado
    rate-limit.ts
  components/    # Componentes React reutilizables
  hooks/         # Custom hooks
```

### Flujo de visita

```
asignada -> en_progreso -> completada -> pre_informe -> en_revision -> aprobada
```

### Roles

- **tecnico:** Ejecuta visitas, captura datos en campo
- **coordinador:** Revisa y aprueba informes, administra permisos
- **programador:** Gestiona solicitudes y programacion
- **comercial:** Vista de pipeline comercial

## Setup

```bash
cd app
npm install
cp .env.example .env.local  # Configurar variables de Supabase
npm run dev
```

### Variables de entorno

| Variable | Descripcion |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anonima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side) |

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de produccion
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run test:coverage # Vitest con coverage
npm run format       # Prettier (write)
npm run format:check # Prettier (check)
```

## Testing

Tests con Vitest + Testing Library. Cobertura en modulos criticos:

- `lib/equipos/engine.ts` — Motor de formulas y criterios
- `lib/workflow/visit-state-machine.ts` — Transiciones de estado
- `lib/validation/schemas.ts` — Validacion de entrada

```bash
npm run test:run
```
