# Manual de usuario — flujo end-to-end por roles

> Sievert EyC · App de control de calidad de equipos de rayos X (offline-first).
> Última actualización: `2026-08-28`.

Este manual recorre el ciclo completo de un estudio, desde que se da de alta un
cliente hasta que el cliente final verifica el informe por QR. Cada paso indica
**quién** lo hace, **dónde** (ruta de la app) y **qué ocurre por detrás**. Al
final de cada etapa hay un recuadro **"Puntos de atención"** que ubica los
issues abiertos y las correcciones ya aplicadas en ese punto exacto del flujo.

El índice completo de issues está en la [§ Mapa de issues](#mapa-de-issues-por-paso)
y el [Anexo de issues transversales](#anexo--issues-transversales).

---

## 1. Roles y permisos

La app tiene 4 roles. El permiso se resuelve en el cliente
(`hasPermission(modulo, accion)` / `isAdmin`); el `proxy.ts` solo garantiza que
haya **sesión** (autenticación), no el rol. El único chequeo de rol
**server-side** es el alta de usuarios.

| Módulo                            | Coordinador       | Programador  | Técnico           | Comercial    |
| --------------------------------- | ----------------- | ------------ | ----------------- | ------------ |
| Dashboard                         | total             | ver          | ver               | ver          |
| Clientes                          | total             | ver          | —                 | crear/editar |
| Solicitudes                       | total             | crear/editar | —                 | crear/editar |
| Visitas                           | total             | crear/editar | ejecutar (editar) | —            |
| Revisión                          | total             | ver          | ver               | —            |
| Equipos                           | total             | ver          | ejecutar (editar) | —            |
| Informes                          | total             | ver          | ver               | —            |
| Sync                              | total             | ver          | ver               | —            |
| Configuración (usuarios/permisos) | total (`isAdmin`) | —            | —                 | —            |

- **Coordinador** — administra todo. Único que gestiona usuarios y publica/
  reenvía informes.
- **Programador** — programa solicitudes y visitas, revisa, marca enviados.
- **Técnico** — ejecuta la visita en campo (captura). Puede aprobar su propia
  visita (ver [Etapa 4](#etapa-4--revisión)).
- **Comercial** — sólo clientes y solicitudes. No ve visitas ni informes.
- **Cliente final / inspector** — sin login. Solo `/verificar/[token]` vía QR.

---

## 2. El flujo end-to-end

```
Comercial/Coord        Coord/Programador        Técnico (offline)         Coord/Prog/Téc        Coord/Programador     Cliente final
──────────────────     ─────────────────        ─────────────────         ──────────────        ─────────────────     ─────────────
Cliente → Sede →       Asignar técnico →        Iniciar visita →          Revisar →             Publicar oficial →    Escanear QR →
Ubicación → Equipo →   Crear visita(s)          Info + Grupos A-E →       Aprobar / Devolver    Marcar enviado /      /verificar/[token]
Solicitud              desde la solicitud       Pre-informe →                                   Solicitar ajustes
                                                Enviar a revisión
```

Estados de la **visita**: `asignada → en_progreso → en_revision → aprobada → enviada`
Pipeline de la **solicitud**: `solicitudes (por programar) → programacion → ejecucion → notificado → enviado`

---

### Etapa 0 — Alta del sistema · **Coordinador**

| Paso                 | Dónde                      | Qué hace                                                                                                                                                                                                                                                     |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 Crear usuarios   | `/dashboard/configuracion` | Alta de técnicos/comerciales/etc. Llama a `POST /api/usuarios` — **único chequeo de rol server-side**: valida sesión + que el llamante sea `coordinador`, crea el usuario en Supabase Auth y la fila en `usuarios`, con rollback si el segundo insert falla. |
| 0.2 Ajustar permisos | `/dashboard/configuracion` | Overrides de la matriz por rol (`rol_permisos`). Best-effort a Supabase; si no hay red se aplica local.                                                                                                                                                      |

> **Puntos de atención — Etapa 0**
>
> - ✅ **Corregido (Tier 7, PR #56):** `POST /api/usuarios` tiene tests que fijan los 6 caminos de seguridad (429 rate-limit / 401 / 403 / 400 sin filtrar el schema / 201 + rollback).
> - 🟡 **Aceptado — T7-4:** el rate-limit es **por instancia** serverless (`rate-limit.ts`), no distribuido. Complementado por el límite global de Supabase Auth. Migrar a Upstash Redis si escala.
> - 🟡 **Backlog — #37:** el `proxy.ts` valida la firma del JWT con el secreto **HS256** (simétrico). Un proyecto Supabase con firma asimétrica (RS256/ES256) cae a la "barrera blanda" offline (deja pasar si el token está bien formado y no vencido). Hoy el proyecto usa HS256; documentar antes de rotar llaves.

---

### Etapa 1 — Alta comercial · **Comercial** o **Coordinador**

| Paso                | Dónde                                     | Qué hace                                                                                                      |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1.1 Crear cliente   | `/dashboard/clientes` → "Nuevo"           | Alta de `clientes` (razón social, NIT, naturaleza, contacto).                                                 |
| 1.2 Crear sede      | `/dashboard/clientes/[id]` → "Nueva sede" | `sedes` ligada al cliente (ciudad, dirección).                                                                |
| 1.3 Crear ubicación | dentro de la sede                         | `ubicaciones_rx` (servicio, dimensiones de sala).                                                             |
| 1.4 Crear equipo    | dentro de la ubicación                    | `equipos` + sub-formularios de **tubo / colimador / gantry**. Se elige el `tipo_equipo`.                      |
| 1.5 Crear solicitud | `/dashboard/solicitudes` → "Nueva"        | `solicitudes` con cliente + ubicación + equipos a estudiar. Nace en pipeline `solicitudes` ("por programar"). |

> **Puntos de atención — Etapa 1**
>
> - ✅ **Corregido (Tier 6, PR #54) — #11:** al reabrir cualquiera de los 7 diálogos de alta/edición con un objeto nuevo del padre, se **pisaban las ediciones en curso**. Ahora el form se repuebla sólo en la transición de apertura (`useReseedOnOpen`).
> - ✅ **Corregido (Tier 6, PR #54) — #10:** el diálogo de **equipo** escribía `equipos` + `tubos`/`colimadores`/`gantry` en operaciones separadas — un fallo a mitad dejaba el equipo sin sus hijos. Ahora todo va en una transacción; si se limpian todos los campos de un hijo, se hace soft-delete.
> - 🟡 **Backlog — #7 / #48:** si en 1.4 se elige un `tipo_equipo` **distinto de CONVENCIONAL**, no hay paquete de pruebas implementado. Un guard (`registry.ts`) impide crear la visita (Etapa 2) con un `NoPackageError`. Cuando se implemente el 2º tipo de equipo hay que unificar los IDs de módulo entre `getModuleStatuses` y `getDefaultModules` **antes** — es prerrequisito.

---

### Etapa 2 — Programación · **Coordinador** o **Programador**

| Paso                | Dónde                           | Qué hace                                                                                                                                                     |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 Abrir solicitud | `/dashboard/solicitudes/[id]`   | Vista de la solicitud con sus equipos.                                                                                                                       |
| 2.2 Asignar técnico | misma pantalla                  | Setea `tecnico_asignado_id` en la solicitud.                                                                                                                 |
| 2.3 Crear visita(s) | botón "Crear visita" por equipo | `crearVisitaDesdeSolicitud(solicitudId, equipoId)` — una visita por equipo, en estado `asignada`. Auto-genera las filas de pruebas del paquete CONVENCIONAL. |

> **Puntos de atención — Etapa 2**
>
> - ✅ **Corregido (Tier 4) — #6:** `crearVisitaDesdeSolicitud` **regeneraba el id** de la visita, **se tragaba los errores** devolviendo `{success:false}` sin log, y una visita cuyas pruebas no se auto-generaron se leía como **100 % completa** (podía enviarse a revisión y aprobarse vacía). Ahora respeta el id, loguea/propaga el error real, y una visita sin pruebas cuenta como **0 %** → bloquea.
> - 🟡 **Backlog — #7 / #48:** para equipos no-CONVENCIONAL el guard de `registry.ts` rechaza este paso (por diseño, hasta implementar el 2º tipo).

---

### Etapa 3 — Ejecución en campo · **Técnico** · (mayormente **offline**)

| Paso                                            | Dónde                           | Qué hace                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 Login                                       | `/login`                        | Autentica contra Supabase. Tras entrar, `router.push(redirect)` + `fullSync()` en background.                                                                                                            |
| 3.2 Abrir la visita                             | `/dashboard/visitas/[id]`       | Workspace de la visita con la lista de módulos y su % de completitud.                                                                                                                                    |
| 3.3 **Iniciar Visita**                          | barra de acciones               | `asignada → en_progreso`. Solicitud pasa a pipeline `ejecucion`.                                                                                                                                         |
| 3.4 Info General                                | módulo `info`                   | Completa cliente, sede, contactos, generador, tubo, colimador, condiciones y dimensiones de sala. Se guarda campo a campo (debounce) contra `visitas`/`equipos`/`ubicaciones_rx`/`clientes`/`contactos`. |
| 3.5 Grupo A — Levantamiento + Inspección visual | módulo `grupo-a` (requerido)    | Mediciones radiométricas por punto, inspección visual de equipo y condiciones de operación, elementos de protección, evidencias fotográficas.                                                            |
| 3.6 Grupo B — RaySafe                           | módulo `grupo-b` (requerido)    | Tiempo, kVp, CHR, rendimiento y dosis. Import de archivo RaySafe X2 (TSV/XLSX).                                                                                                                          |
| 3.7 Grupo C — CAE                               | módulo `grupo-c` (**opcional**) | Control automático de exposición.                                                                                                                                                                        |
| 3.8 Grupo D — DDI/EI + CR                       | módulo `grupo-d` (requerido)    | Índice de exposición, integridad y uniformidad de placas CR.                                                                                                                                             |
| 3.9 Grupo E — Colimación + MTF                  | módulo `grupo-e` (requerido)    | Colimación, resolución, contraste, MTF.                                                                                                                                                                  |
| 3.10 Pre-Informe                                | módulo `pre-informe` (opcional) | Concepto por prueba (derivado de `evaluacion.ts`) + genera el **PDF borrador**.                                                                                                                          |
| 3.11 **Enviar a Revisión**                      | barra de acciones               | `en_progreso → en_revision` — **con gate de completitud**: exige los módulos requeridos (A, B, D, E).                                                                                                    |
| 3.12 Reconexión                                 | automática                      | El sync engine sube todo lo capturado offline.                                                                                                                                                           |

> **Puntos de atención — Etapa 3**
>
> **Login (3.1)**
>
> - ✅ **Corregido (Tier 7, PR #56) — T7-1:** `?redirect=` se usaba sin validar → **open redirect** (`/login?redirect=https://evil.com`). Ahora `safeRedirect()` solo permite rutas internas.
> - ✅ **Corregido (Tier 2) — #17:** `fullSync()` post-login era fire-and-forget y podía perder la carrera con la resolución del usuario → la app quedaba vacía hasta el timer de 5 min. Ahora se espera al usuario autenticado antes del pull inicial.
> - ✅ **Corregido (Tier 1) — #16:** un 5xx/429 transitorio de Supabase devolvía `{error}` (no throw) y el proxy **deslogueaba** al usuario durante un wobble del backend. Ahora se distingue "auth falló" de "backend inalcanzable".
>
> **Captura (3.4–3.10)**
>
> - ✅ **Corregido (Tier 6, PR #54):** la deuda de `set-state-in-effect` en los 7 módulos de captura + smoke tests (21) que fijan los 3 estados de render de cada uno.
> - 🟡 **Backlog — #14 (parcial):** `conv_inspeccion_items` se **lista sin filtrar `deleted_at`** en los módulos de grupo (el cálculo de conformidad sí lo filtra desde Tier 3).
> - 🟡 **Backlog — #43:** el import RaySafe X2 (3.6) **no valida el layout** — un archivo con columnas inesperadas puede pasar en silencio y meter números mal ubicados.
> - 🟡 **Backlog — #13 → issue #42:** varios evaluadores de `evaluacion.ts` marcaban **datos faltantes como "Conforme"** (baseline ausente, CV con n<2). Interino aplicado (Tier 3): ahora devuelven `undefined` = _pendiente_. La revisión prueba-por-prueba de cada regla se hace al recrear el flujo desde la app (**#42**).
> - 🟡 **Backlog — #12 → #41 / #45:** el evaluador **genérico** de fórmulas (`engine.ts`) está **dormido** — no lo llama nada en producción; la conformidad real la calcula `evaluacion.ts` (a mano). Interino: `engine.ts` ya no devuelve `null` en silencio ante expresiones legítimas. Falta decidir la arquitectura (un sistema u otro) — **#45**, bloquea el rediseño técnico **#41**.
>
> **Gate de completitud (3.11)**
>
> - ✅ **Corregido (Tier 4) — #6:** una visita vacía ya no cuenta como 100 %.
> - 🟡 **Backlog — #7 / #48:** para equipos no-CONVENCIONAL el gate **nunca pasa** (mismatch de IDs de módulo entre `getModuleStatuses` y `getDefaultModules`) — por eso el guard de la Etapa 2.
> - 🟡 **Backlog — #15 → #47:** `getVisitCompletenessBulk` hace `O(visitas × ~15 escaneos conv_*)` secuencial y se re-ejecuta en cada mutación → puede **trabar la lista de visitas** con muchos registros.
>
> **Reconexión y sync (3.12)**
>
> - ✅ **Corregido (Tier 2) — #19:** una tabla que fallaba el pull en cada ciclo era invisible salvo leyendo logs. Ahora se registra `last_pull_error` por tabla y se muestra en la consola de sync.
> - ✅ **Corregido (Tier 2) — #18:** el botón global de reintento no recuperaba filas en estado `failed` (solo `error`). Ahora incluye ambos.
> - ✅ **Corregido (Tier 2) — #21:** el parpadeo de conectividad encolaba ciclos de sync superpuestos. Ahora hay debounce de reconexión (3 s).
> - ✅ **Corregido — interino (Tier 2) — #5:** `last_modified` como watermark sufría clock skew del dispositivo. Migración `016` agrega triggers server-side en las 34 tablas de sync (**el dueño debe correrla en el SQL Editor de Supabase**).
> - 🔴 **Backlog alto — #3 / #4 / #5 → issue #38:** el **modelo de conflicto**. Hoy: _local gana, silencioso_ (`logger.warn`); una edición concurrente a columnas distintas de la misma fila **pierde columnas** (upsert de fila completa). Interino (Tier 2): se **detecta** la colisión (fila server más nueva que la base local) y se loguea como `error` visible + contador. El rediseño real (dirty-tracking por columna) es **#38**.
> - 🟡 **Backlog — #20 → #39:** las listas `LOCAL_ONLY_FIELDS` de `prepareForRemote` se mantienen a mano — una columna local nueva sin clasificar manda la fila directo a `failed` (`PGRST204`/`42703`). Falta un guard que diffee el schema.

---

### Etapa 4 — Revisión · **Coordinador / Programador** (y el **Técnico** puede aprobar su visita)

| Paso                               | Dónde                      | Qué hace                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 Bandeja de revisión            | `/dashboard/revision`      | Lista de visitas `en_revision`. Página con **gate de rol** (`hasPermission("revision")`).                                                                                                                                       |
| 4.2 Abrir la visita                | `/dashboard/revision/[id]` | Resumen de conceptos + PDF borrador.                                                                                                                                                                                            |
| 4.3 **Aprobar**                    | botón "Aprobar"            | `en_revision → aprobada` **con gate de completitud**. `executeTransition` además **crea el informe y publica la versión oficial** (PDF con QR + SHA-256, subido a Storage) en el mismo paso. Solicitud → pipeline `notificado`. |
| 4.4 **Devolver con Observaciones** | botón "Devolver"           | `en_revision → en_progreso` — **requiere razón**. La visita vuelve al técnico con `observaciones_revision`.                                                                                                                     |

> **Puntos de atención — Etapa 4**
>
> - ✅ **Corregido (Tier 4) — #8:** `aprobar` **no tenía gate de completitud** — un coordinador podía aprobar (y publicar el PDF oficial con QR/hash) de una visita **incompleta**. Ahora aplica el mismo gate que `enviar_revision`.
> - ✅ **Corregido (Tier 4) — #22:** `crearInforme` / `solicitar_ajustes_cliente` tomaban `db.informes…first()` → una **versión arbitraria** cuando la visita tenía varias. Ahora ordena por versión descendente y toma la última.
> - 🔴 **Backlog alto — #9 → issue #46:** `executeTransition` al aprobar hace **update de visita + creación de informe + update de solicitud + publicación** como pasos **separados no transaccionales** → estados divergentes alcanzables. Interino (Tier 4): `checkVisitConsistency(visitaId)` detecta y reporta la divergencia; la publicación oficial dejó de ser fire-and-forget con `console.error`. El rediseño transaccional es **#46**.

---

### Etapa 5 — Publicación y entrega · **Coordinador / Programador**

| Paso                                | Dónde                      | Qué hace                                                                                                                                                              |
| ----------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 Lista de informes               | `/dashboard/informes`      | Página con **gate de rol** (`hasPermission("informes")`).                                                                                                             |
| 5.2 Detalle del informe             | `/dashboard/informes/[id]` | Historial de versiones, hash SHA-256, QR. Página con **gate de rol** (agregado en Tier 7).                                                                            |
| 5.3 **Publicar versión oficial**    | botón en el detalle        | Si no se publicó al aprobar (o tras una corrección): genera QR + SHA-256 + sube el PDF a Storage. Requiere permiso `informes:editar` (por defecto, solo coordinador). |
| 5.4 **Marcar como Enviado**         | barra de acciones          | `aprobada → enviada`. Solicitud → pipeline `enviado`.                                                                                                                 |
| 5.5 **Solicitar Ajustes (Cliente)** | barra de acciones          | `enviada → en_progreso` — **requiere razón**. Abre una nueva versión del informe; el ciclo vuelve a Etapa 3/4.                                                        |

> **Puntos de atención — Etapa 5**
>
> - ✅ **Corregido (Tier 7, PR #56) — T7-2:** el **detalle** de informe (`/dashboard/informes/[id]`) **no tenía gate de rol** (la lista sí) y el botón "Publicar versión oficial" **no chequeaba permiso** — cualquier usuario interno con la URL podía publicar la versión oficial. Ahora: gate de página `hasPermission("informes")` + botón condicionado a `informes:editar`.
> - 🟡 **Backlog — #51:** `recopilarDatosConv` (arma los datos del PDF) filtra `deleted_at` en **solo 6 de 19** tablas `conv_*` → una medición borrada de RaySafe/CAE/DDI **sigue apareciendo en el PDF oficial**.
> - 🟡 **Backlog — #52:** `getLogoBase64` no tiene `try/catch` — un **404 del logo** (`/logo-informe.png`) **rompe la generación completa** del PDF.

---

### Etapa 6 — Verificación pública · **Cliente final / inspector** (sin login)

| Paso               | Dónde                | Qué hace                                                                                                                                                                                      |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 Escanear el QR | `/verificar/[token]` | Página pública (Server Component, cliente `service_role`). Muestra número de informe, concepto, vigencia (vigente/vencido/en corrección), fechas y un enlace al **PDF firmado** (válido 1 h). |

> **Puntos de atención — Etapa 6**
>
> - ✅ **Verificado (Tier 7, PR #56):** la página **no filtra PII del cliente**. Solo consulta `informes` / `informe_versiones` / `equipos` con listas de columnas explícitas — nunca `clientes` / `sedes` / `contactos` / `solicitudes` / `ubicaciones_rx` / `visitas`. El `qr_token` es un UUID v4 (122 bits) → no enumerable. Test de contrato lo fija.
> - ℹ️ El PDF firmado **sí** contiene los datos del cliente y las mediciones — es el documento oficial que el QR está pensado para publicar.

---

## Mapa de issues por paso

Leyenda: ✅ corregido · 🟡 interino aplicado / backlog contenido · 🔴 backlog alto (rediseño) · ℹ️ aceptado y documentado

| Issue     | Título corto                                                                    | Etapa / paso                     | Estado                                  |
| --------- | ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| #2        | Fallback offline confiaba en JWT sin verificar firma                            | 0 · sesión / 3.1 login           | ✅ Tier 1 (residual → #37)              |
| #37       | `proxy.ts` solo verifica firma HS256 (simétrica)                                | 0 · sesión                       | 🟡 backlog                              |
| T7-4      | `rate-limit` per-instancia (no distribuido)                                     | 0.1 crear usuarios               | ℹ️ aceptado                             |
| #11       | Reapertura de diálogo pisaba ediciones en curso                                 | 1.1–1.5 · todos los form-dialogs | ✅ Tier 6 (PR #54)                      |
| #10       | Diálogo de equipo: writes multi-tabla no transaccionales                        | 1.4 crear equipo                 | ✅ Tier 6 (PR #54)                      |
| #7 / #48  | Visitas no-CONVENCIONAL: IDs de módulo no coinciden                             | 1.4 / 2.3 / 3.11                 | 🟡 backlog + guard (prerreq. 2º equipo) |
| #6        | `crearVisitaDesdeSolicitud`: id regenerado, error tragado, visita vacía = 100 % | 2.3 crear visita                 | ✅ Tier 4                               |
| T7-1      | Open redirect en `/login` (`?redirect=`)                                        | 3.1 login                        | ✅ Tier 7 (PR #56)                      |
| #17       | `fullSync()` post-login pierde la carrera → app vacía                           | 3.1 login                        | ✅ Tier 2                               |
| #16       | 5xx/429 transitorio deslogueaba al usuario                                      | 3.1 login / sesión               | ✅ Tier 1                               |
| #14       | Soft-delete no filtrado en listas (`conv_inspeccion_items`, maestras)           | 3.5 grupo A (+ transversal)      | 🟡 conv path Tier 3; maestras → #34     |
| #43       | Import RaySafe X2 sin validación de layout                                      | 3.6 grupo B                      | 🟡 backlog                              |
| #13       | Evaluadores marcaban datos faltantes como "Conforme"                            | 3.4–3.10 (conformidad)           | 🟡 interino Tier 3; deep review → #42   |
| #12 / #41 | `engine.ts`: falso positivo de regex + `null` silencioso                        | 3.4–3.10 (conformidad)           | 🟡 interino Tier 3; rediseño → #41      |
| #45       | Decisión de arquitectura: `engine.ts` vs `evaluacion.ts`                        | 3.4–3.10 (conformidad)           | 🔴 bloquea #41                          |
| #15 / #47 | `getVisitCompletenessBulk` O(n·15) secuencial                                   | 3.11 gate / lista de visitas     | 🟡 backlog                              |
| #5        | Watermark `last_modified` sufre clock skew                                      | 3.12 reconexión                  | 🟡 interino (migración `016`) → #38     |
| #3 / #4   | Conflicto: local gana silencioso; pérdida de columnas concurrentes              | 3.12 reconexión                  | 🔴 interino Tier 2; rediseño → #38      |
| #19       | Errores de pull por tabla invisibles                                            | 3.12 reconexión                  | ✅ Tier 2                               |
| #18       | Retry global no recuperaba filas `failed`                                       | 3.12 reconexión                  | ✅ Tier 2                               |
| #21       | Parpadeo de conectividad encolaba ciclos superpuestos                           | 3.12 reconexión                  | ✅ Tier 2                               |
| #20 / #39 | Columna local nueva sin clasificar → fila a `failed`                            | 3.12 reconexión                  | 🟡 backlog                              |
| #8        | `aprobar` sin gate de completitud → PDF oficial de visita vacía                 | 4.3 aprobar                      | ✅ Tier 4                               |
| #22       | `informes…first()` toma una versión arbitraria                                  | 4.3 / 5.5                        | ✅ Tier 4                               |
| #9 / #46  | `executeTransition` al aprobar: pasos separados no transaccionales              | 4.3 aprobar                      | 🔴 interino Tier 4; rediseño → #46      |
| T7-2      | `/dashboard/informes/[id]` sin gate de rol; publicar sin permiso                | 5.2 / 5.3                        | ✅ Tier 7 (PR #56)                      |
| #51       | PDF: `recopilarDatosConv` filtra `deleted_at` inconsistente (6/19)              | 5.3 publicar                     | 🟡 backlog                              |
| #52       | PDF: `getLogoBase64` sin `try/catch` — 404 del logo rompe el informe            | 5.3 publicar / 3.10 pre-informe  | 🟡 backlog                              |
| —         | `/verificar/[token]` no filtra PII                                              | 6.1 verificar                    | ✅ verificado (Tier 7)                  |
| T7-3      | Páginas de dashboard sin gate de **página** (solo de acciones)                  | transversal (rutas)              | ℹ️ aceptado (base de usuarios interna)  |

---

## Anexo — issues transversales

No pertenecen a un paso del flujo; son deuda de código o infraestructura.

| Issue | Descripción                                                                                                           | Estado                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| #23   | Infra de test sin cablear (jest-dom, user-event, thresholds, CI)                                                      | ✅ Tier 0                                 |
| #34   | Listas de **tablas maestras** no filtran `deleted_at` (latente hasta que haya UI de borrado de maestras)              | 🟡 backlog + lint guard pendiente         |
| #35   | Enum `SyncStatus`: el valor `"conflict"` quedó muerto                                                                 | 🟡 limpieza                               |
| #36   | Código muerto: `resetAllLocalData`, `seedFromPackage` en `src/lib/db/`                                                | 🟡 limpieza                               |
| #38   | **Rediseño del modelo de conflicto** (#3 completo + #4 + #5 completo)                                                 | 🔴 proyecto aparte                        |
| #39   | Guard de columnas locales vs Supabase (#20)                                                                           | 🟡 backlog                                |
| #41   | `engine.ts`: rediseño a allowlist real + deep-freeze + retorno `{value,error}`                                        | 🔴 bloqueado por #45                      |
| #42   | `evaluacion.ts`: revisión a fondo **prueba por prueba** de las reglas de conformidad                                  | 🔴 hacer al recrear el flujo desde la app |
| #45   | Decisión de arquitectura: `engine.ts` (genérico) vs `evaluacion.ts` (a mano)                                          | 🔴 decisión pendiente                     |
| #46   | `executeTransition` al aprobar: transaccionalidad + publicación reintentable                                          | 🔴 proyecto aparte                        |
| #47   | `getVisitCompletenessBulk`: memoizar / batch-load / indexar                                                           | 🟡 backlog                                |
| #48   | Unificar IDs de módulo entre `getModuleStatuses` y `getDefaultModules` — **prerrequisito del 2º tipo de equipo** (#7) | 🔴 al arrancar el 2º equipo               |
| #51   | PDF: `recopilarDatosConv` filtra `deleted_at` inconsistente (extiende #34)                                            | 🟡 backlog                                |
| #52   | PDF: `getLogoBase64` sin manejo de error                                                                              | 🟡 backlog                                |

### Tareas del dueño pendientes (no son issues de código)

- Correr la migración `supabase/migrations/016_last_modified_all_sync_tables.sql` en el **SQL Editor de Supabase** (necesaria para el interino de #5).
- Confirmar que **RLS está activo** en todas las tablas de Supabase (defensa en profundidad; hoy el único authz server-side es `/api/usuarios`).
- Poner el valor real de `SUPABASE_JWT_SECRET` en `.env.local` **y** en las variables de entorno de Vercel (para la verificación de firma offline del `proxy.ts`).
- Dar el sign-off en cada `docs/modules/*.md` tras revisar el log de decisiones.
- Ejecutar la matriz de escenarios manual (P1–P5) módulo por módulo.
