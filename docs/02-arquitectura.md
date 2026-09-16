# 2. Arquitectura

## 2.1 Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **Next.js 16** (App Router) | Usa `proxy.ts` en lugar de `middleware.ts` (cambio de convención de esta versión — ver [AGENTS.md](../AGENTS.md)) |
| UI | **React 19**, **Tailwind CSS 4**, **shadcn/ui**, **Base UI**, Lucide icons | Componentes base en `src/components/ui/` |
| Lenguaje | **TypeScript** (strict) | Alias `@/` → `src/` |
| Auth + Backend | **Supabase** (PostgreSQL + Auth + RLS) | Cliente browser y server (SSR) |
| Base de datos offline | **Dexie** (IndexedDB) | 40+ tablas, sync bidireccional |
| Validación | **Zod v4** (`zod/v4`) | Schemas de entrada y de variables de entorno |
| PDF | **jsPDF** + **jspdf-autotable** | Import dinámico (no entra en el bundle inicial) |
| Import de datos | **xlsx** | Parseo del archivo exportado del sensor RaySafe X2 (`convencional/raysafe-parser.ts`), usado en `conv/grupo-b` |
| Tests | **Vitest** + Testing Library + fake-indexeddb | |

## 2.2 Principio rector: *offline-first, local-first*

La app está diseñada para operar **sin conexión** durante toda una jornada de campo. La
consecuencia arquitectónica es que **IndexedDB (Dexie) es la fuente de verdad en tiempo de
ejecución**, no el servidor:

- Todas las lecturas y escrituras de la UI van contra Dexie (vía `dexie-react-hooks` /
  `useLiveQuery`), por lo que la interfaz es reactiva e instantánea.
- Supabase es un **backend de respaldo y consolidación**: recibe los cambios cuando hay red y
  distribuye datos maestros a otros dispositivos.
- Cada registro lleva un campo `sync_status` (`pending` | `synced` | `conflict` | `error`) y
  `last_modified`, que el motor de sync usa para reconciliar. Ver
  [Sincronización offline](06-sincronizacion-offline.md).

### Identidad por UUID generado en cliente

Decisión clave (migración Dexie v13): las claves primarias son **UUID string generados en el
cliente** (`crypto.randomUUID()` vía [`src/lib/uuid.ts`](../src/lib/uuid.ts)), no
auto-incrementales. Esto permite crear registros offline sin colisiones y hacer `upsert` por
`id` contra Supabase sin necesidad de mapear IDs locales↔remotos. Excepción: los catálogos
DIVIPOLA (`departamentos`, `municipios`) mantienen su **código DANE numérico**.

## 2.3 Capas y estructura de carpetas

```
src/
├── app/                      # Rutas (Next.js App Router)
│   ├── page.tsx              # Raíz → redirige a dashboard/login
│   ├── login/                # Autenticación (Supabase Auth)
│   ├── api/usuarios/         # ÚNICA API route: creación de usuarios (server-side)
│   └── dashboard/            # Área autenticada (protegida por proxy.ts)
│       ├── clientes/         # CRUD de clientes, sedes, ubicaciones, equipos
│       ├── solicitudes/      # Pipeline comercial/operativo
│       ├── visitas/          # Ejecución de visitas (núcleo)
│       │   └── [id]/
│       │       ├── info/     # Precarga de información general
│       │       ├── conv/grupo-{a..e}/   # Formularios de captura por grupo
│       │       └── pre-informe/          # Editor visual del pre-informe
│       ├── revision/         # Cola de revisión/aprobación (coordinador)
│       ├── informes/         # Informes emitidos
│       ├── equipos/          # Vista de equipos
│       ├── sync/             # Panel de sincronización y errores
│       └── configuracion/    # Usuarios y matriz de permisos
│
├── components/               # Componentes React reutilizables
│   ├── ui/                   # Primitivas shadcn/ui
│   ├── *-form-dialog.tsx     # Diálogos de creación/edición de entidades
│   ├── role-provider.tsx     # Contexto de rol/permisos activo
│   ├── db-provider.tsx       # Inicialización de Dexie + seeding
│   └── sw-register.tsx       # Registro del service worker (PWA)
│
├── hooks/                    # use-auto-sync, use-online-status, use-mobile
│
└── lib/                      # Lógica de dominio (sin JSX)
    ├── db/                   # Schema Dexie, tipos del dominio, seeders, reset
    ├── equipos/              # Paquetes por equipo, definiciones, evaluadores
    │   ├── registry.ts       # Registro central de paquetes por tipo de equipo
    │   └── convencional/     # Paquete CONVENCIONAL (módulos, grupos, tablas conv_*)
    │       ├── evaluacion.ts     # Evaluadores TypeScript del veredicto Conforme/No conforme
    │       └── estadistica.ts    # Fuente única de promedio/desviación/CV%
    ├── workflow/             # Máquina de estados, completitud, servicios de visita/informe
    ├── supabase/             # Clientes (browser/server), sync-engine, tipos generados
    ├── pdf/                  # Generación de pre-informes PDF
    ├── validation/           # Schemas Zod
    ├── env.ts                # Validación de variables de entorno
    ├── logger.ts             # Logger estructurado
    └── rate-limit.ts         # Rate limiting (API de usuarios)
```

### Regla de dependencias

- `app/` (UI) → depende de `components/`, `hooks/`, `lib/`.
- `lib/workflow/` y `lib/equipos/` → dependen de `lib/db/` (tipos y acceso Dexie).
- `lib/equipos/convencional/evaluacion.ts` concentra los evaluadores del veredicto
  Conforme/No conforme; son funciones TypeScript escritas a mano (una por prueba), no un motor
  de fórmulas genérico. Existió un `engine.ts` que evaluaba fórmulas-string con `new Function()`
  detrás de un denylist de patrones, pero nunca se usó en producción (las 21 pruebas siempre
  tuvieron `formulas: []`) y se eliminó en septiembre de 2026 (issue #45) — ver
  [Motor de pruebas §5.3](05-motor-de-pruebas.md) y [Seguridad §7.4](07-seguridad.md).
- `lib/db/types.ts` es el vocabulario compartido: define todas las entidades y enums del dominio.

## 2.4 Patrón "Equipment Package"

El diseño más importante para la extensibilidad. Cada tipo de equipo se modela como un
`EquipmentPackage` ([`src/lib/equipos/types.ts`](../src/lib/equipos/types.ts)) que agrupa:

- `modulos`: los pasos/pantallas de la visita y su orden.
- `grupos`: los grupos de pruebas con sus fórmulas y criterios de aceptación.
- `generarInforme`: la función que produce el PDF específico del equipo.

El **registro** ([`src/lib/equipos/registry.ts`](../src/lib/equipos/registry.ts)) mapea
`TipoEquipo → EquipmentPackage`. La UI y el workflow consultan el registro (`getPackage`,
`getModules`, `getRequiredModules`) en lugar de conocer los detalles de cada equipo. Añadir un
equipo nuevo = crear un paquete y registrarlo, sin tocar el resto de la app. Detalle en
[Motor de pruebas](05-motor-de-pruebas.md).

## 2.5 Rendimiento y bundle

- **jsPDF se carga con `import()` dinámico** solo al generar el PDF, para no penalizar la carga
  inicial (ver `lib/pdf/generar-pre-informe.ts`).
- El cliente de Supabase se importa dinámicamente en el workflow para no arrastrarlo en los
  tests (`visit-state-machine.ts` → `pushSingle`).
- El cliente admin de Supabase en la API de usuarios usa **lazy init** (se crea por request, no
  al cargar el módulo).

## 2.6 PWA

La app es una Progressive Web App: `sw-register.tsx` registra un service worker, hay `manifest.json`
e íconos, y `proxy.ts` excluye del matcher los assets estáticos (`sw.js`, `manifest.json`,
íconos, imágenes). Esto permite instalarla y usarla como app nativa en tablets de campo.
