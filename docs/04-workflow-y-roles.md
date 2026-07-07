# 4. Flujo de trabajo y roles

## 4.1 Máquina de estados de la visita

El ciclo de vida de una visita es una **máquina de estados con funciones puras y *gates* de
validación**, definida en
[`src/lib/workflow/visit-state-machine.ts`](../src/lib/workflow/visit-state-machine.ts).

```
              iniciar_visita        completar_visita [GATE]      generar_pre_informe
   asignada ───────────────► en_progreso ───────────────► completada ──────────────► pre_informe
                                  ▲                                                        │
                                  │ devolver                                enviar_revision │
                                  │ (observaciones)                                         ▼
                              aprobada ◄──────────────── en_revision ◄────────────────────┘
                                            aprobar
```

Cada arista es una `VisitAction` con esta forma (`ActionDefinition`):

| Acción | Desde → Hacia | Roles permitidos | Gate | Variante |
|--------|---------------|------------------|------|----------|
| `iniciar_visita` | asignada → en_progreso | técnico, coordinador | No | primary |
| `completar_visita` | en_progreso → completada | técnico | **Sí** | success |
| `generar_pre_informe` | completada → pre_informe | técnico | No | primary |
| `enviar_revision` | pre_informe → en_revision | técnico | No | primary |
| `aprobar` | en_revision → aprobada | técnico, coordinador, programador | No | success |
| `devolver` | en_revision → en_progreso | técnico, coordinador, programador | No | warning |

`aprobada` es un estado terminal (sin transiciones salientes).

### API pública de la máquina de estados

- `getAvailableActions(estado, cargo)` — acciones que el rol actual puede ejecutar desde el
  estado actual (filtra por `roles`). La UI (`visit-action-bar.tsx`) la usa para renderizar botones.
- `canTransition(estado, action, cargo)` — chequeo booleano sin ejecutar gates.
- `checkGate(visitaId, action)` — corre la validación de completitud (solo `completar_visita`).
- `executeTransition(visitaId, action, cargo, extra?)` — ejecuta la transición: valida rol y
  estado, corre el gate si aplica, actualiza la visita en Dexie, **sincroniza el pipeline de la
  solicitud** y hace un **push inmediato** a Supabase.

### El *gate* de "completar visita"

Es el único punto de validación bloqueante. Antes de pasar a `completada`, `checkGate` llama a
`getVisitCompleteness(visitaId)`
([`module-completeness.ts`](../src/lib/workflow/module-completeness.ts)) y bloquea si hay módulos
**requeridos** incompletos, devolviendo mensajes legibles por módulo (`condiciones`,
`levantamiento`, `pruebas`…). Qué módulos son requeridos lo dicta el `EquipmentPackage` del
equipo (`getRequiredModules`).

## 4.2 Completitud de módulos

`module-completeness.ts` calcula el progreso de cada módulo consultando las **tablas dedicadas**
del equipo (`conv_*`). Conceptos:

- `ModuloStatus`: `sin_iniciar` (0%) | `en_progreso` (1–99%) | `completado` (100%).
- El porcentaje se calcula por proporción de campos no vacíos (`pct()`), con **pesos** por
  submódulo. Ejemplo real del Grupo A: `setup 20% + mediciones 30% + inspección 40% + elementos 10%`.
- `getVisitCompleteness` agrega todos los módulos → `{ total, completed, percentage, blocking[], modules[] }`.
- `blocking` = módulos requeridos que no están al 100% (lo que consume el gate).

> Estado actual: `getConvGrupoAPercentage` está implementado; el cálculo fino de los grupos B–E
> está pendiente (ver [`../TODO.md`](../TODO.md)). Mientras tanto devuelven 0%.

## 4.3 Permisos

El modelo de permisos es **granular por rol × módulo × acción** y vive como **funciones puras**
en [`src/lib/db/types.ts`](../src/lib/db/types.ts).

### Acciones

`ver`, `crear`, `editar`, `eliminar`. Regla transversal: **sin permiso de `ver`, ninguna otra
acción se concede** (lo impone `resolverPermiso`).

### Matriz por defecto (`PERMISOS_DEFAULT_MATRIZ`)

Combinaciones nombradas: `ACCESO_TOTAL`, `SOLO_VER`, `GESTIONAR` (ver+crear+editar),
`EJECUTAR` (ver+editar), `SIN_ACCESO`. Resumen:

| Módulo | Coordinador | Programador | Técnico | Comercial |
|--------|:-----------:|:-----------:|:-------:|:---------:|
| dashboard | Total | Ver | Ver | Ver |
| clientes | Total | Ver | — | Gestionar |
| solicitudes | Total | Gestionar | — | Gestionar |
| visitas | Total | Gestionar | Ejecutar | — |
| revisión | Total | Ver | Ver | — |
| equipos | Total | Ver | Ejecutar | — |
| informes | Total | Ver | Ver | — |
| sync | Total | Ver | Ver | — |
| configuración | Total | — | — | — |

> El **coordinador es el administrador** (`isAdmin === cargo === "coordinador"`). Es el único
> con acceso a `configuracion` (gestión de usuarios y edición de la matriz de permisos).

### Resolución en runtime

- La tabla `rol_permisos` puede **sobrescribir** el default (columnas `crear/editar/eliminar`
  con `null` = "usar default del rol").
- `accionesEfectivas(permiso, rol, modulo)` expone los valores crudos (para la UI de edición en
  Configuración).
- `resolverPermiso(permiso, rol, modulo, accion)` da la respuesta final aplicando la regla de "ver".
- En React, el **`RoleProvider`** ([`src/components/role-provider.tsx`](../src/components/role-provider.tsx))
  expone `hasPermission(modulo, accion?)` a toda la app. Las páginas con restricción usan
  `useRole()` + `hasPermission()`.

### Verificación del rol (defensa en profundidad)

El `cargo` del usuario **no se confía solo desde IndexedDB local**: el `RoleProvider` también lo
**verifica contra Supabase** (`serverCargo`) y prefiere ese valor. El vínculo entre la sesión de
Supabase Auth y el `Usuario` de la app se hace por `auth_uid` (con fallback por email). Ver
[Seguridad](07-seguridad.md).

## 4.4 Pipeline de la solicitud

Paralelo al estado de la visita, la **solicitud** avanza por un pipeline comercial/operativo
(`pipeline_estado`): `solicitudes → programacion → ejecucion → notificado → enviado`.

La máquina de estados **sincroniza automáticamente** el pipeline según el estado de la visita
(mapa `SOLICITUD_SYNC`): al entrar en ejecución (`en_progreso`…`en_revision`) la solicitud pasa a
`ejecucion`; al aprobar, pasa a `notificado`. Ambos cambios se empujan a Supabase.

## 4.5 De visita aprobada a informe

Al aprobar, [`informe-service.ts`](../src/lib/workflow/informe-service.ts) crea el `Informe` y su
primera `InformeVersion`:

- **Número consecutivo** `EYC-{AÑO}-{NNN}` (`generarNumeroInforme`, secuencia por año).
- **Concepto general**: `NO_FAVORABLE` si **cualquier** prueba lo es; `FAVORABLE` si todas cumplen.
- **`qr_token`** único (UUID) para validación pública por QR.
- **`fecha_vencimiento`** = emisión + 2 años (Resolución 1811).
- Es **idempotente**: si ya existe un informe para esa visita, lo devuelve en lugar de duplicar.
