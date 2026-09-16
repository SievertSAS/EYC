# 4. Flujo de trabajo y roles

## 4.1 Máquina de estados de la visita

El ciclo de vida de una visita es una **máquina de estados con funciones puras y *gates* de
validación**, definida en
[`src/lib/workflow/visit-state-machine.ts`](../src/lib/workflow/visit-state-machine.ts).

```
              iniciar_visita      enviar_revision [GATE]      aprobar [GATE]      marcar_enviado
   asignada ───────────────► en_progreso ───────────────► en_revision ───────────► aprobada ───────────────► enviada
                                  ▲                              │                                              │
                                  │         devolver              │                                              │
                                  └──────────(observaciones)──────┘                                              │
                                  │                                                                              │
                                  └───────── solicitar_ajustes_cliente (observaciones) ────────────────────────────┘
```

Cada arista es una `VisitAction` con esta forma (`ActionDefinition`), definida en
`TRANSITIONS` ([`visit-state-machine.ts`](../src/lib/workflow/visit-state-machine.ts)):

| Acción | Desde → Hacia | Roles permitidos | Gate | Variante |
|--------|---------------|------------------|------|----------|
| `iniciar_visita` | asignada → en_progreso | técnico, coordinador | No | primary |
| `enviar_revision` | en_progreso → en_revision | técnico | **Sí** | success |
| `aprobar` | en_revision → aprobada | técnico, coordinador, programador | **Sí** | success |
| `devolver` | en_revision → en_progreso | técnico, coordinador, programador | No | warning |
| `marcar_enviado` | aprobada → enviada | coordinador, programador | No | primary |
| `solicitar_ajustes_cliente` | enviada → en_progreso | coordinador, programador | No | warning |

`devolver` y `solicitar_ajustes_cliente` exigen razón escrita (`requiereRazon`), que se guarda en
`observaciones_revision`. `enviada` es el último paso normal del ciclo — solo vuelve a
`en_progreso` si el cliente reporta que necesita ajustes.

> Nota histórica: versiones anteriores de este documento describían estados intermedios
> `completada` y `pre_informe`, y un gate en `completar_visita`. Ese pipeline se simplificó
> (commit `d2c3686`): hoy `pre-informe` es un **módulo** dentro de `en_progreso` (el técnico edita
> el pre-informe y asigna concepto a cada prueba antes de enviar a revisión), no un estado de la
> visita, y el gate se movió a `enviar_revision`/`aprobar`.

### API pública de la máquina de estados

- `getAvailableActions(estado, cargo)` — acciones que el rol actual puede ejecutar desde el
  estado actual (filtra por `roles`). La UI (`visit-action-bar.tsx`) la usa para renderizar botones.
- `canTransition(estado, action, cargo)` — chequeo booleano sin ejecutar gates.
- `checkGate(visitaId, action)` — corre la validación de completitud (`enviar_revision` y
  `aprobar`; ver `GATED_ACTIONS`).
- `executeTransition(visitaId, action, cargo, extra?)` — ejecuta la transición: valida rol y
  estado, corre el gate si aplica, actualiza la visita en Dexie, **sincroniza el pipeline de la
  solicitud** y hace un **push inmediato** a Supabase. Si la acción es `aprobar`, además crea o
  versiona el `Informe` y dispara la publicación de la versión oficial del PDF (ver §4.5); si es
  `solicitar_ajustes_cliente`, marca el informe existente como `correccion_cliente`. Las tres
  escrituras de estado (visita + solicitud + informe) van en una sola transacción Dexie.

### El *gate* de completitud

Se aplica a dos acciones — `enviar_revision` y `aprobar` (no a `iniciar_visita`) — con el mismo
criterio en ambas: los datos pueden haber cambiado entre el envío y la aprobación, y `aprobar` es
lo que publica el PDF oficial con QR, así que no debe poder aprobarse una visita incompleta. Antes
de ejecutarlas, `checkGate` llama a `getVisitCompleteness(visitaId)`
([`module-completeness.ts`](../src/lib/workflow/module-completeness.ts)) y bloquea si:

- hay módulos **requeridos** (según `getRequiredModules` del `EquipmentPackage` del equipo) que
  no llegaron a `completado`, o
- quedan **pruebas sin concepto** (`pendientesPruebas > 0`): ninguna prueba puede quedar sin
  resolver (ver §4.2).

## 4.2 Completitud de módulos

`module-completeness.ts` calcula el progreso de cada módulo consultando las **tablas dedicadas**
del equipo (`conv_*`). Conceptos:

- `ModuloStatus`: `sin_iniciar` (0%) | `en_progreso` (1–99%) | `completado` (100%).
- El módulo `info` (precarga) usa proporción de campos no vacíos (`pct()`) sobre `INFO_CAMPOS` —
  la misma lista que alimenta el panel "Datos faltantes" del pre-informe, para que nunca diverjan.
- Los módulos `grupo-a` … `grupo-e` usan un criterio distinto: no es proporción de campos
  llenos, sino de **pruebas resueltas** (`pctResueltas`, sobre `getEstadoPruebasPorGrupo` en
  [`evaluacion.ts`](../src/lib/equipos/convencional/evaluacion.ts)). Una prueba cuenta como
  resuelta si está excluida del informe (`incluida === false`), si no tiene criterio evaluable, o
  si el evaluador automático (`evaluarConceptoPrueba`) ya produjo un veredicto. El mismo criterio
  se aplica por igual a los 5 grupos — ya no hay un cálculo por campos con pesos, ni un cálculo
  "fino" pendiente para B–E como el que describían versiones anteriores de este documento.
- **El override manual "No favorable - no ejecutada"** (`ConvInformeSeccion.concepto`, ver
  [Modelo de datos §3.4](03-modelo-de-datos.md)) **no cuenta como resuelta** para este gate:
  `getEstadoPruebasPorGrupo` solo mira el toggle `incluida` y el veredicto automático, no el
  concepto manual de la sección. Documentar que un componente falló no libera el gate — la prueba
  sigue "pendiente" hasta que se repita (o se marque "No aplica" si de verdad no aplica al
  equipo). El propio generador de PDF trata este estado como pendiente para el concepto general
  del informe, con el mismo razonamiento ("el gate de `enviar_revision`/`aprobar` ya lo impide")
  como defensa en profundidad antes de publicar la versión oficial.
- `getVisitCompleteness` agrega todo → `{ total, completed, percentage, blocking[], modules[],
  pendientesPruebas }`. `blocking` = módulos requeridos que no están al 100% (solo `grupo-a`…
  `grupo-e`; `info` y `pre-informe` quedan fuera de la lista de módulos "requeridos" del gate).
  `pendientesPruebas` es la cuenta total de pruebas sin concepto en todos los grupos, incluidos
  los opcionales (CAE), y es el segundo motivo de bloqueo del gate (independiente de `blocking`).

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
`ejecucion`; al aprobar (`aprobada`), pasa a `notificado`; al marcar como enviada (`enviada`), pasa
a `enviado`. Los tres cambios se empujan a Supabase.

## 4.5 De visita aprobada a informe

Al aprobar, [`informe-service.ts`](../src/lib/workflow/informe-service.ts) crea el `Informe` y su
primera `InformeVersion`:

- **Número consecutivo** `EYC-{AÑO}-{NNN}` (`generarNumeroInforme`, secuencia por año).
- **Concepto general**: `NO_FAVORABLE` si **cualquier** prueba lo es; `FAVORABLE` si todas cumplen.
- **`qr_token`** único (UUID) para validación pública por QR.
- **`fecha_vencimiento`** = emisión + 2 años (Resolución 1811).
- Es **idempotente por informe**: si ya existe uno para esa visita, no crea un duplicado — agrega
  una nueva `InformeVersion` sobre el mismo `id` (caso de re-aprobación tras
  `solicitar_ajustes_cliente`) e incrementa `version_actual`.

Inmediatamente después, `executeTransition` dispara `publicarVersionOficial` (asíncrono, no
bloquea la transición): genera el PDF oficial con `generarPreInforme`, calcula su **hash SHA-256**
y lo sube a Supabase Storage junto con la `InformeVersion`. Si esa publicación falla, la visita ya
quedó aprobada pero el PDF oficial queda pendiente de reintento manual (botón en `informes/[id]`);
se registra con `logger.error`, no se pierde silenciosamente.
