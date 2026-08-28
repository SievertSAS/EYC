# Módulo: motor de permisos (`src/lib/db/types.ts`)

> Estado: 🟡 en curso (Tier 1 · pasada ligera) · 2026-08-28
> Ya bien cubierto por `src/lib/db/permisos.test.ts` (3 bloques, ~30 asserts).
> Esta pasada: doc + pin de la matriz completa + subir umbral de cobertura.

---

## 1. Responsabilidad

Es la **única fuente de verdad de "¿este rol puede hacer esta acción sobre
este módulo?"**. Tres funciones puras + una matriz de defaults, todo en
`src/lib/db/types.ts`. No toca la base ni la red.

- **Roles** (`RolUsuario` / `ROLES_DISPONIBLES`): `coordinador`, `programador`,
  `tecnico`, `comercial`.
- **Módulos** (`MODULOS_APP` / `ModuloApp`): `dashboard`, `clientes`,
  `solicitudes`, `visitas`, `revision`, `equipos`, `informes`, `sync`,
  `configuracion`.
- **Acciones** (`AccionPermiso`): `ver`, `crear`, `editar`, `eliminar`.

## 2. API pública

| Export                                                 | Firma               | Efectos                                                   | Error                                                      | Idempotente |
| ------------------------------------------------------ | ------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| `permisoDefault(rol, modulo)`                          | → `AccionesPermiso` | ninguno                                                   | no lanza; módulo sin entrada → `SIN_ACCESO` (todo `false`) | sí          |
| `accionesEfectivas(permiso?, rol, modulo)`             | → `AccionesPermiso` | ninguno                                                   | no lanza                                                   | sí          |
| `resolverPermiso(permiso?, rol, modulo, accion="ver")` | → `boolean`         | ninguno                                                   | no lanza                                                   | sí          |
| `PERMISOS_DEFAULT_MATRIZ`                              | —                   | **no exportada** (privada); el acceso es `permisoDefault` | —                                                          | —           |

### Semántica

- `permisoDefault` → los presets de la matriz por rol/módulo. Presets:
  `ACCESO_TOTAL` (CRUD), `SOLO_VER`, `GESTIONAR` (ver+crear+editar, sin
  eliminar), `EJECUTAR` (ver+editar), `SIN_ACCESO`.
- `accionesEfectivas(permiso, rol, modulo)` → los 4 bits "crudos" de un
  registro `rol_permisos`:
  - `ver` = `permiso?.activo ?? false` — **NO cae al default de la matriz**.
  - `crear`/`editar`/`eliminar` = valor del registro, o el default del rol si
    es `null`/`undefined` (datos previos a permisos granulares).
  - Expone los overrides aunque `ver` esté en `false` (para que la UI de
    Configuración no los pierda al apagar "ver").
- `resolverPermiso` = `accionesEfectivas` + la regla **"sin `ver` no hay
  ninguna acción"**. `accion` por defecto `"ver"`.

## 3. Modelo de datos

- No es dueño de ninguna tabla. Define el tipo `RolPermiso` y la matriz.
- La tabla `rol_permisos` se siembra con `seedRolPermisos()` (Módulo 1):
  36 filas = 4 roles × 9 módulos, materializando `PERMISOS_DEFAULT_MATRIZ`.
- `rol_permisos` es `MASTER_TABLE` en sync (solo baja). Los cambios locales de
  la UI de Configuración se replican a Supabase por `persistirPermisoRemoto`
  (fuera de este módulo).

## 4. Flujo de control

`role-provider.hasPermission(modulo, accion)` (consumidor principal):

1. `if (!role) return false` — sin rol activo, nada.
2. Busca en la lista viva de `db.rol_permisos` la fila `(role.cargo, modulo)`.
3. `resolverPermiso(fila, role.cargo, modulo, accion)`.

## 5. Comportamiento offline / online

- 100% puro y offline. `hasPermission` depende de la lista de `rol_permisos`
  en Dexie, que se sembró/sincronizó antes.

## 6. Interacción con sync

- Ninguna directa. `rol_permisos` baja del servidor; los edits de la UI de
  Configuración se persisten aparte.

## 7. Rol / permisos

- Es _el_ módulo de permisos.
- **`isAdmin` NO pasa por acá**: `role-provider` lo calcula como
  `role.cargo === "coordinador"`, hardcodeado. Un coordinador es admin aunque
  se le editen los `rol_permisos`.

## 8. Invariantes y supuestos

1. **`resolverPermiso(undefined, …)` siempre da `false`.** Sin una fila
   `rol_permisos` para `(rol, modulo)`, ese módulo es invisible. En producción
   funciona solo porque `seedRolPermisos()` creó las 36 filas. Si la UI de
   Configuración borrara una fila, o el seed no corrió, ese permiso cae a
   `false` en silencio.
2. La matriz `PERMISOS_DEFAULT_MATRIZ` asume que todo módulo listado en
   `MODULOS_APP` tiene entrada para `coordinador` (los demás roles pueden
   omitir módulos → `SIN_ACCESO`).
3. `accionesEfectivas` asume que "no `ver`" es una decisión explícita del
   registro, no un default.

## 9. Modos de falla conocidos

| Falla                                                              | Efecto                                                               | Manejo actual                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------ |
| `rol_permisos` no sembrada / fila faltante                         | el módulo desaparece de la UI para ese rol                           | ninguno — `resolverPermiso(undefined)` → `false` |
| Módulo nuevo en `MODULOS_APP` sin entrada en la matriz para un rol | ese rol no lo ve (por diseño `?? SIN_ACCESO`)                        | correcto, pero silencioso                        |
| `accion` con string arbitrario                                     | TS lo previene; en runtime `efectivas[accion]` → `undefined` → falsy | aceptable                                        |

## 10. Preguntas abiertas / smells

- La asimetría de `ver` (no cae al default) vs `crear/editar/eliminar` (sí
  caen) es sutil y ya nos mordió (helper `makeRole` de Tier 0). ¿Vale
  documentarla en el JSDoc de `accionesEfectivas`?
- `isAdmin` hardcodeado — si algún día se quiere un "coordinador junior", hay
  que tocar `role-provider`, no la matriz.
- `PERMISOS_DEFAULT_MATRIZ` privada: los tests la validan solo a través de
  `permisoDefault`. Ok, pero un pin de la matriz completa (36×4) hace visible
  cualquier cambio accidental.

---

## Apéndice B — Log de decisiones

| #                                    | Descripción                      | Decisión                                                                                                                                      | Razón                                                                                                         |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `resolverPermiso(undefined)` → false | asimetría de `ver`               | **aceptar + pin + doc**: ya cubierto por `permisos.test.ts` ("sin registro, ninguna acción"); se agrega nota al JSDoc de `accionesEfectivas`. | Cambiar la semántica ahora rompería la UI de Configuración (que necesita distinguir "sin ver" de "sin fila"). |
| Matriz sin pin completo              | spot-checks, no snapshot literal | **fix-ahora**: `permisos-matriz.test.ts` con las 144 decisiones explícitas.                                                                   | Barato y atrapa cualquier edición accidental de la matriz.                                                    |
| `isAdmin` hardcodeado                | fuera del motor                  | **aceptar + doc**                                                                                                                             | Es una decisión de producto, no un bug.                                                                       |

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc completo
- [x] Matriz de escenarios (rol × módulo × acción) — pin completo en
      `permisos-matriz.test.ts` (144 celdas, 37 tests)
- [x] Cobertura: `permisos.test.ts` + el pin cubren las 3 funciones y la matriz.
      `types.ts` no lo mide v8 (archivo casi todo tipos) — cubierto de hecho.
- [x] Umbrales de `vitest.config.ts` subidos (global 12→13; `src/lib/db/*`
      con piso por archivo: `recovery.ts` 95, `seed.ts` 65, `index.ts` 63)
- [x] JSDoc de `accionesEfectivas` documenta la asimetría de `ver`
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
