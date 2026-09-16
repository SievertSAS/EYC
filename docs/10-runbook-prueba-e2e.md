# 10. Runbook — Prueba end-to-end guiada

> Para quién: cualquiera que quiera **ejecutar** el flujo completo de la app mientras
> **entiende por qué** cada paso funciona como funciona. No reemplaza al
> [Manual de usuario end-to-end](manual-usuario-e2e.md) (que audita issues por paso) — este
> documento es un runbook de ejecución con foco pedagógico en la arquitectura.

> ⚠️ **Ambiente**: hoy `.env.local` apunta al proyecto Supabase que también usan los
> coordinadores/técnicos reales (no hay staging separado todavía). Prefijá **todo** dato que
> crees con `PRUEBA-` (nombre de cliente, sede, equipo) para poder identificarlo y borrarlo
> después — ver [§9 Limpieza](#9-limpieza-de-datos-de-prueba).

## Cómo usar este runbook

Cada etapa tiene dos columnas de lectura:

- **Hacé esto** — la acción concreta en la UI (ruta, botón, campo).
- **Por qué funciona así** — qué pieza de código se activa y la decisión de diseño detrás,
  con el archivo:línea exacto y un link al documento que profundiza el tema.

Marcá cada casilla a medida que avanzás. Si algo no se comporta como describe el runbook, es
una señal real de regresión — no un error de este documento (fue verificado contra el código
el 2026-09-15).

---

## 0. Preparación

- [ ] `npm install` (si no lo corriste antes) y `npm run dev` → app en `http://localhost:3000`.
- [ ] Tené a mano una cuenta con rol **coordinador** (es el único rol con acceso total; ver
      [Flujo de trabajo y roles §4](04-workflow-y-roles.md)).
- [ ] Abrí las DevTools → pestaña **Application → IndexedDB → SievertEyC** en paralelo. Vas a
      ver las tablas Dexie cambiar en vivo a medida que uses la app — es la evidencia visual de
      que **IndexedDB es la fuente de verdad en tiempo de ejecución**, no un cache.

**Por qué funciona así**: la app es *local-first*. Cada lectura/escritura de la UI va contra
Dexie vía `useLiveQuery` (`dexie-react-hooks`), por eso la interfaz es instantánea y funciona
sin red. Supabase entra recién cuando el motor de sincronización decide subir/bajar cambios.
Ver [Arquitectura §2.2](02-arquitectura.md#22-principio-rector-offline-first-local-first).

---

## 1. Login y sesión

- [ ] Andá a `/login`, entrá con la cuenta coordinador.
- [ ] Mirá la Network tab: la respuesta de auth no es lo único que pasa — inmediatamente
      después debería dispararse un `fullSync()`.

**Por qué funciona así**: el login llama a `createClient()` (cliente Supabase browser,
`src/lib/supabase/client.ts`) y dispara `fullSync()` (`sync-engine.ts:299`) **esperando** a que
el usuario esté resuelto antes del primer pull — una corrección real (issue #17): antes el sync
post-login era fire-and-forget y podía perder la carrera, dejando la app vacía hasta el timer de
5 minutos.

Una vez adentro, `src/proxy.ts` (reemplaza `middleware.ts` en Next.js 16) es quien te deja pasar
a `/dashboard/*`: valida la sesión Supabase vía cookies, y si el backend está caído (5xx/429) en
vez de desloguearte cae a una verificación **local** del JWT con **7 días de gracia offline**
(`SESSION_GRACE_MS`, `src/lib/auth/session.ts:10`) — pensado para un técnico en campo sin señal
que no puede permitirse perder la sesión. Detalle completo en
[Seguridad §7.1](07-seguridad.md#71-autenticación).

> Nota de arquitectura: `proxy.ts` solo verifica que **haya sesión**. El control de **rol**
> (qué podés ver/hacer) es client-side, vía `useRole()`/`hasPermission()` — lo vas a notar en
> el siguiente paso porque el sidebar cambia de opciones según el rol.

---

## 2. Alta comercial — Cliente → Sede → Ubicación → Equipo → Solicitud

- [ ] `/dashboard/clientes` → crear cliente **`PRUEBA-Clínica Runbook`** (NIT, DIVIPOLA de
      ejemplo).
- [ ] Dentro del cliente, crear una **sede** y una **ubicación RX**.
- [ ] Crear un **equipo** tipo **Convencional** en esa ubicación.
- [ ] `/dashboard/solicitudes` → crear una solicitud para ese equipo.

**Por qué funciona así**:

- El `id` del cliente (y de todo lo demás que crees) es un **UUID generado en el navegador**
  (`crypto.randomUUID()`, `src/lib/uuid.ts`) en el momento del `INSERT` en Dexie — no un
  autoincremental del servidor. Por eso podés crear el cliente sin red: no hay que esperar un
  ID del backend, y cuando sincronice, Supabase hace `upsert(..., { onConflict: "id" })` con
  ese mismo UUID. Es la decisión que sostiene todo el modelo offline-first
  (migración Dexie v13). Ver [Arquitectura §2.2 — Identidad por UUID](02-arquitectura.md#identidad-por-uuid-generado-en-cliente).
- El catálogo de departamento/municipio que usás en la sede es **DIVIPOLA/DANE** — la única
  entidad del sistema que **no** usa UUID (mantiene su código numérico oficial). Ver
  [Modelo de datos](03-modelo-de-datos.md).
- El tipo de equipo que elegiste (Convencional) determina, desde este momento, qué paquete de
  lógica gobierna todo lo que sigue: `registry.ts` mapea `TipoEquipo → EquipmentPackage`, y hoy
  **solo `CONVENCIONAL_PACKAGE` existe** (CT/Mamógrafo/Panorámico están comentados en el
  registro). Si intentaras crear una visita para un tipo sin paquete, `assertCanCreateVisitFor`
  (`registry.ts:117-126`) lo bloquea explícitamente — es un guard real, no un olvido. Ver
  [Motor de pruebas §5.1](05-motor-de-pruebas.md).

---

## 3. Programación — Asignar técnico y crear la visita

- [ ] Desde la solicitud, asigná un técnico y creá la(s) visita(s).
- [ ] Abrí la visita creada: `/dashboard/visitas/[id]`.

**Por qué funciona así**: crear la visita instancia, a partir del `EquipmentPackage`
convencional, la lista fija de **módulos** (`ModuloVisita[]`): Info + Grupos A–E + Pre-informe.
Esa lista es la que después consulta `module-completeness.ts` para calcular el % de avance — el
mismo paquete que define "qué pruebas hay" define también "qué significa estar completo". Ver
[Flujo de trabajo §4.1](04-workflow-y-roles.md).

Estado inicial de la visita: `asignada`. La máquina de estados completa es
`asignada → en_progreso → en_revision → aprobada → enviada`
(`src/lib/workflow/visit-state-machine.ts:130-136`) — vas a recorrerla completa en este runbook.

---

## 4. Ejecución en campo — Info + Grupos A–E

> Simulá el trabajo del técnico. Podés (opcionalmente) poner Chrome en modo offline
> (DevTools → Network → Offline) para esta etapa entera y ver que **nada se rompe**.

- [ ] "Iniciar visita" → estado pasa a `en_progreso`.
- [ ] Completar el módulo **Info** (datos generales, generador, tubo, colimador — 7 secciones).
- [ ] Completar **Grupo A** (levantamiento + inspección visual).
- [ ] Completar **Grupo B** (RaySafe): probá el botón **"Cargar archivo RaySafe"** con una
      plantilla `.xlsx` (hay una descargable desde el propio formulario) en vez de tipear los
      valores a mano.
- [ ] Completar **Grupos C, D**.
- [ ] Completar **Grupo E** (colimación, resolución, contraste, MTF — prueba 2.16): subí las
      **3 evidencias** que pide: curva MTF horizontal, objeto borde (imagen DICOM), curva MTF
      vertical.

**Por qué funciona así**:

- **Offline real, no simulado**: cada guardado es un `db.<tabla>.put(...)` local; si activaste
  el modo avión, la UI no lo nota. `useLiveQuery` vuelve a renderizar apenas Dexie cambia,
  sin pasar por red. Ver [Sincronización §6.1](06-sincronizacion-offline.md).
- **Importación RaySafe**: `RaysafeUploadCard` (`grupo-b-modulo.tsx`) llama a
  `parseRaysafeXlsx`/`parseRaysafeTsv` (`src/lib/equipos/convencional/raysafe-parser.ts`), que
  soporta tanto el export nativo del instrumento como una plantilla estructurada. Es una
  funcionalidad completa, no un placeholder — vale la pena probarla en vez de tipear a mano.
- **Grupo E / MTF (cambio reciente, PR #138)**: hasta hace poco la prueba 2.16 pedía **una sola
  imagen**. Ahora captura **tres evidencias ordenadas** (slots `curva_mtf_horizontal` /
  `dicom_mtf` / `curva_mtf_vertical`, ensamblados en `src/lib/pdf/secciones-convencional.ts:389-408`)
  porque una sola imagen no alcanzaba para sustentar el veredicto de resolución — vas a verlas
  las tres reflejadas más adelante en el PDF. Ver [Motor de pruebas §5.2](05-motor-de-pruebas.md).
- **No hay motor de fórmulas genérico evaluando esto en vivo**: hasta 2026-09-01 existió
  `engine.ts`, un evaluador de expresiones-string sandboxeado con `new Function()` +
  `BLOCKED_PATTERNS`. Nunca se usó en producción y se eliminó (issue #45) — todo el veredicto
  que estás por ver en el siguiente paso lo calculan funciones puras escritas a mano en
  `evaluacion.ts`. Si te preguntás por qué no hay una "fórmula" configurable en pantalla, esa es
  la razón. Ver [Motor de pruebas §5.3](05-motor-de-pruebas.md#53-motor-de-fórmulas-y-criterios--⛔-retirado-45).

---

## 5. Pre-informe — Conceptos, "No ejecutada" y CV

- [ ] Abrí el editor del **pre-informe** (`.../pre-informe`).
- [ ] Mirá el veredicto automático (Favorable/No favorable) que ya calculó al menos una
      sección con datos numéricos (p. ej. una prueba con CV, como 2.10/2.15/2.19).
- [ ] Para **una** sección, forzá manualmente el estado **"No favorable - no ejecutada"** (el
      switch/botón dedicado, distinto de "no aplica") y observá cómo cambia el contador de
      pendientes del editor.
- [ ] Volvé a marcarla como incluida/normal si no querés que bloquee el envío (ver etapa 6).

**Por qué funciona así**:

- El **CV/desviación** que ves en pantalla sale de una única fuente:
  `src/lib/equipos/convencional/estadistica.ts` (`promedio`/`desviacion`/`cvPct`, desviación
  muestral n-1). Hasta hace poco esta fórmula estaba **reimplementada 7 veces** en distintos
  archivos y produjo un bug real (CV mostrado 1% vs. 1.6% calculado a mano, issue #121) — la
  consolidación garantiza que el número que ves acá sea el mismo que va a salir en el PDF. Ver
  [Motor de pruebas §5.3](05-motor-de-pruebas.md).
- **"No ejecutada"** es un cuarto valor de `Concepto`
  (`"No_favorable_no_ejecutada"`, `evaluacion.ts:37`, issue #120), para una prueba que
  **aplicaba pero no se pudo hacer** (p. ej. falló un componente del sensor durante la visita) —
  antes se forzaba mal el switch "no aplica", que semánticamente es otra cosa. La función pura
  `conceptoEfectivoSeccion()` (`evaluacion.ts:531-539`) decide la precedencia: `!incluida` gana
  siempre sobre todo lo demás; si no, el override manual "no ejecutada" gana sobre el veredicto
  automático. **Para el gate de completitud (próxima etapa), este estado cuenta como
  pendiente, no como resuelto** — es deliberado: una prueba "no ejecutada" necesita que alguien
  la revise, no queda cerrada silenciosamente. Ver
  [Módulo 7 — Evaluación §1.1](modules/07-evaluacion.md#11-estado-no-ejecutada-120).

---

## 6. Enviar a revisión — El gate de completitud

- [ ] Si dejaste la sección de la etapa 5 en "no ejecutada" o alguna prueba sin resolver, tocá
      **"Enviar a revisión"** y confirmá que **la app te bloquea** con un mensaje de módulos/
      pruebas pendientes.
- [ ] Resolvé lo que falte (marcá el resto de pruebas con un concepto, o volvé la sección a
      normal) y reintentá — ahora debería pasar. Estado de la visita → `en_revision`.

**Por qué funciona así**: `enviar_revision` es una de las dos **transiciones con gate**
(`GATED_ACTIONS`, junto con `aprobar`). `checkGate()`
(`src/lib/workflow/visit-state-machine.ts:209-238`) llama a `getVisitCompleteness` y bloquea si
hay módulos requeridos incompletos **o** si queda alguna prueba sin concepto asignado — ninguna
prueba puede llegar a revisión en un limbo. Es la misma lógica que alimenta la barra de progreso
que viste en la lista de visitas, así que lo que acabás de comprobar manualmente es exactamente
lo que ese número ya te venía anunciando. Ver
[Flujo de trabajo §4.2](04-workflow-y-roles.md#42-gate-de-completitud).

---

## 7. Revisar y aprobar

- [ ] Como coordinador (o el rol habilitado), andá a `/dashboard/revision`, abrí la visita y
      **aprobá**.
- [ ] Mirá `/dashboard/informes` — debería aparecer (o versionarse) el informe de esta visita en
      segundos, no instantáneo.

**Por qué funciona así**: `executeTransition` (líneas 244-358) valida rol + estado + gate y
escribe `visitas`+`solicitudes`(+`informes`) en **una sola transacción Dexie** — para que nunca
queden desincronizados entre sí si algo falla a mitad de camino. Pero la creación/versionado del
informe **y** la publicación del PDF oficial corren **después**, de forma asíncrona, fuera de
esa transacción (por eso el "no instantáneo": están generando el PDF con jsPDF + jspdf-autotable
vía import dinámico). Por esta misma asincronía existe `checkVisitConsistency` — una función
que detecta si esos dos pasos quedaron desalineados por algún error post-transacción. Ver
[Flujo de trabajo §4.3](04-workflow-y-roles.md).

---

## 8. PDF y verificación por QR

- [ ] Abrí el informe generado. Confirmá que las 21 secciones (2.1–2.21) están, que la 2.16
      muestra las **3 evidencias** de MTF, y que si dejaste alguna sección en "no ejecutada"
      aparece el label **"NO EJECUTADA"** con su propio párrafo (no como "No conforme").
- [ ] Escaneá (o abrí manualmente) el QR/URL de verificación: `/verificar/[token]`.

**Por qué funciona así**:

- El veredicto por prueba que ves en el PDF (`generar-pre-informe.ts:1123`) **no se recalcula**
  ahí — delega en el mismo `evaluarConceptoPrueba()`/`tieneCriterio()` de `evaluacion.ts` que
  viste en el editor. Es una garantía de paridad explícita: lo que aprobaste es exactamente lo
  que queda impreso, nunca una segunda pasada de cálculo que podría divergir. Ver
  [Módulo 9 — PDF](modules/09-pdf.md).
- `/verificar/[token]` es la **única ruta pública** de la app (sin login). Usa el cliente
  administrador de Supabase (`service role`, salta RLS) para poder mostrarle el informe a
  cualquiera con el link, pero solo expone los datos que ese informe necesita mostrar — no hay
  fuga de PII adicional (verificado en Seguridad §7). Ver
  [Arquitectura §2.3](02-arquitectura.md) y [Seguridad](07-seguridad.md).

---

## 9. Sincronización — Verla en acción

- [ ] Andá a `/dashboard/sync`. Si estuviste offline en la etapa 4, deberías ver registros
      `pending`. Forzá un sync manual.
- [ ] (Opcional, para ver un conflicto real) Abrí la misma visita en dos pestañas/dispositivos,
      editá el mismo campo en ambas sin sincronizar entre medio, y sincronizá — vas a ver que
      **gana la copia local de quien sincroniza último** (no hay merge por columna todavía).

**Por qué funciona así**: el ciclo (`runFullSync`, `sync-engine.ts:343`) es 1) **push** de todo
lo `pending` (subiendo primero cualquier imagen a Supabase Storage), 2) **pull** completo de
tablas maestras, 3) **pull incremental** de tus tablas por `last_modified > watermark`. El
watermark se captura **al iniciar** el pull (no al terminar) para no perderse filas insertadas
a mitad de camino, y solo se guarda si **todas** las páginas del pull tuvieron éxito. La
resolución de conflictos que viste en el paso opcional es una decisión **interina y documentada
como deuda técnica** (issues #3/#4/#5): local gana si hay cambios pendientes, sin merge por
columna. Ver [Sincronización §6.3–6.4](06-sincronizacion-offline.md).

---

## 10. Limpieza de datos de prueba

Como este runbook corrió contra el ambiente real:

- [ ] Borrá (soft-delete, desde la UI) el cliente `PRUEBA-Clínica Runbook` y todo lo que colgó
      de él (sede, ubicación, equipo, solicitud, visita, informe).
- [ ] Confirmá en `/dashboard/sync` que el borrado se propagó (columna `deleted_at`) antes de
      cerrar la sesión.

**Por qué funciona así**: la app nunca hace `DELETE` real desde la UI — todo borrado es
**soft-delete** (`deleted_at`), tanto en Dexie como en Supabase (migración
`023_deleted_at_todas_las_tablas_sync.sql`). Es lo que le permite al sync engine distinguir
"este registro nunca existió en tu dispositivo" de "existió y lo borraron en otro lado" sin
perder el historial. Ver [Sincronización §6.9](06-sincronizacion-offline.md) y
[Seguridad](07-seguridad.md).

---

## Lo que este runbook demostró, en una frase

Recorriste offline-first (Dexie + UUID cliente), el registro de paquetes por equipo, la
evaluación de conformidad sin motor genérico, la consolidación de CV, el nuevo estado "no
ejecutada", el gate de completitud, la generación de PDF con paridad garantizada, la
verificación pública por QR, y el ciclo de sincronización con su modelo de conflictos — es decir,
cada capa descrita en el [índice de documentación](README.md), pero viéndola correr.
