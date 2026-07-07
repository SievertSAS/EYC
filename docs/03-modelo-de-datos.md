# 3. Modelo de datos

La definición canónica de todas las entidades está en
[`src/lib/db/types.ts`](../src/lib/db/types.ts) (núcleo) y
[`src/lib/equipos/convencional/db/types.ts`](../src/lib/equipos/convencional/db/types.ts)
(tablas específicas del equipo convencional). El esquema Dexie/IndexedDB se declara en
[`src/lib/db/index.ts`](../src/lib/db/index.ts).

## 3.1 Base Dexie: `SievertEyC`

Una sola base de datos IndexedDB con **versionado incremental** (v1 → v13). Dexie exige que
**todas las versiones anteriores permanezcan declaradas** para poder migrar bases existentes; por
eso el constructor conserva el historial completo. **Nunca se modifica una versión ya publicada:
para cambiar el esquema se añade una `this.version(n)` nueva.**

Hitos del historial:

- **v1–v3:** esquema inicial, `change_logs`, introducción de grupos de pruebas.
- **v4:** renombre `tecnicos` → `usuarios` (con `.upgrade()` que migra filas y normaliza cargos).
- **v5:** se añade `sync_status` a las tablas maestras y `sync_meta`.
- **v6–v12:** tablas dedicadas del convencional (`conv_*`).
- **v11:** catálogos DIVIPOLA (`departamentos`, `municipios`) con id = código DANE.
- **v13:** **migración de claves primarias numéricas a UUID string** (ver
  [Arquitectura §2.2](02-arquitectura.md#23-identidad-por-uuid-generado-en-cliente)). Requiere DB
  vacía; hay scripts de reset en `src/lib/db/reset.ts` y `supabase/scripts/reset_all_data.sql`.

## 3.2 Campos de sincronización

Las tablas sincronizables extienden `SyncFields`:

```ts
type SyncStatus = "pending" | "synced" | "conflict" | "error";
interface SyncFields {
  sync_status: SyncStatus;
  last_modified: string; // ISO timestamp
}
```

`sync_status` se **indexa** en Dexie para que el motor de sync consulte eficientemente los
registros `pending`/`error`. Estos campos **nunca se envían a Supabase** (`LOCAL_ONLY_FIELDS` en
el sync engine).

## 3.3 Grupos de entidades

### Núcleo comercial / maestro

| Tabla | Descripción | Relaciones |
|-------|-------------|-----------|
| `clientes` | Entidad prestadora (NIT, naturaleza pública/privada/mixta) | ← contactos, sedes |
| `contactos` | Personas del cliente (médico, OPR, responsable de visita…) | → cliente |
| `sedes` | Ubicación física del cliente; denormaliza ciudad/departamento | → cliente, DIVIPOLA |
| `ubicaciones_rx` | Sala del equipo: licencia, habilitación, dimensiones, blindaje por zonas | → sede |
| `departamentos` / `municipios` | Catálogo DIVIPOLA (código DANE, **no** UUID) | |
| `cotizaciones` | Cotización comercial | → cliente |
| `solicitudes` | Encargo que dispara la visita; recorre un `pipeline_estado` | → cliente, ubicación, técnico |

### Equipo y su configuración técnica

| Tabla | Descripción |
|-------|-------------|
| `equipos` | Generador de rayos X: `tipo_equipo`, generador (marca/modelo/fase), filtración |
| `equipo_movimientos` | Historial de traslado de un equipo entre ubicaciones |
| `tubos` | Tubo(s) de rayos X: kVp/mA máximos, focos fino/grueso |
| `colimadores`, `gantry` | Componentes del equipo |
| `sala_dimensiones` | Dimensiones y zonas de blindaje (alternativa/legado a los campos en `ubicaciones_rx`) |
| `partes_equipo` | Estado de partes (bueno/regular/malo) |
| `valores_referencia` | Valores de referencia por equipo (Kerma, DDI/EI, MTF, CAE, rendimiento…) usados como línea base en las fórmulas |

### Usuarios y permisos

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuario de la app: `cargo` (rol), `auth_uid` (vínculo con Supabase Auth), `activo` |
| `rol_permisos` | Matriz granular rol × módulo × acción (ver, crear, editar, eliminar) |

La lógica de permisos vive en `types.ts` como **funciones puras**: `permisoDefault`,
`accionesEfectivas`, `resolverPermiso`, con una matriz por defecto (`PERMISOS_DEFAULT_MATRIZ`).
Detalle en [Workflow y roles §4.3](04-workflow-y-roles.md#43-permisos).

### Ejecución de visita (datos de campo)

| Tabla | Descripción |
|-------|-------------|
| `visitas` (`VisitaEjecucion`) | Ejecución en terreno: `estado_visita`, condiciones de operación y ambientales, observaciones, revisor |
| `mediciones_radiometricas` | Puntos de tasa de dosis (levantamiento radiométrico) — genérica |
| `elementos_proteccion` | Elementos de protección verificados |
| `evidencias` | Fotos (Blob en IndexedDB) |
| `prueba_definiciones` | Catálogo de pruebas (número TECDOC, fórmulas, criterios, textos) |
| `grupo_pruebas` / `grupo_resultados` | Grupos y su captura cruda genérica |
| `prueba_resultados` | Resultado de una prueba: `concepto`, `datos_json`, `resultados_calculados`, `evaluacion_criterios` |

> **Nota:** existen tablas genéricas (`mediciones_radiometricas`, `prueba_resultados`,
> `grupo_resultados`…) y tablas **dedicadas** por equipo (`conv_*`). El diseño migró hacia
> tablas dedicadas; las genéricas están marcadas para retiro en [`../TODO.md`](../TODO.md).

### Tablas dedicadas del equipo convencional (`conv_*`)

Definidas en `convencional/db/types.ts`. Cada una guarda una faceta de la captura:

| Tabla | Grupo | Contenido |
|-------|-------|-----------|
| `conv_levantamiento_setup` | A | Fondo natural, distancia, técnica, carga de trabajo |
| `conv_mediciones` | A | Puntos de medición radiométrica (H*(10), U, W, dosis, concepto) |
| `conv_inspeccion_items` | A | Inspección visual (equipo + condiciones de operación) |
| `conv_elementos_proteccion` | A | Elementos de protección |
| `conv_raysafe_setup` / `conv_raysafe_mediciones` | B | Setup y disparos medidos con el RaySafe X2 |
| `conv_cae_setup` / `conv_cae_mediciones` | C | Control Automático de Exposición |
| `conv_ddi_mediciones` | D | DDI/EI |
| `conv_cassette_inspeccion` | D | Inspección de cassettes |
| `conv_uniformidad_cr` | D | Uniformidad CR |
| `conv_colimacion` | E | Colimación |
| `conv_uniformidad_detector` | E | Uniformidad del detector |
| `conv_resolucion`, `conv_bajo_contraste`, `conv_mtf` | E | Resolución espacial, bajo contraste, MTF |
| `conv_resultados_prueba` | — | Resultado/concepto consolidado por prueba |
| `conv_informe_secciones` | — | Selección/orden/textos de secciones para el PDF |
| `conv_evidencias` | — | Imágenes por prueba (Blob local) |

### Informes y auditoría

| Tabla | Descripción |
|-------|-------------|
| `informes` | Documento final: `numero_informe` (`EYC-AAAA-NNN`), `qr_token` único, `fecha_vencimiento` (+2 años), `estado`, `concepto_general` |
| `informe_versiones` | Versionado del informe (emisión inicial, correcciones, aprobación) |
| `change_logs` | Auditoría campo a campo (quién cambió qué y cuándo) — infraestructura lista, `trackChange` pendiente de activar en los formularios |
| `sync_meta` | Marca de tiempo de la última descarga por tabla (`last_pulled_at`) |

## 3.4 Enums importantes

- **`TipoEquipo`** (17 valores): `CONVENCIONAL`, `CT`, `CT_DENTAL`, `MAMOGRAFO`, `PANORAMICO`,
  `PERIAPICAL`, `RX_PORTATIL`, `ARCOENC`, `FLUOROSCOPIOS`, `DENSITOMETRO`, `ANGIOGRAFO`,
  `INDUSTRIAL`, `VETERINARIO`, `MULTIPROPOSITO`, `LITOTRIPTOR`, `VARIOS_RX`, …
- **`EstadoVisita`**: `asignada → en_progreso → completada → pre_informe → en_revision → aprobada`.
- **`EstadoInforme`**: `borrador`, `pre_informe`, `en_revision`, `correccion_fisica`,
  `correccion_cliente`, `aprobado`, `vigente`, `vencido`.
- **`RolUsuario`**: `coordinador`, `programador`, `tecnico`, `comercial`.
- **`ModuloApp`**: `dashboard`, `clientes`, `solicitudes`, `visitas`, `revision`, `equipos`,
  `informes`, `sync`, `configuracion`.
- **Concepto de conformidad**: `FAVORABLE` | `NO_FAVORABLE` | `NO_APLICA`.

## 3.5 Estructuras flexibles de pruebas

El sistema de pruebas es **configurable por datos**, no hardcodeado. Las claves:

- `MedicionSchema` / `ColumnaDef`: definen las columnas de la tabla de captura de un grupo.
- `FormulaDefinicion`: un cálculo auto-evaluado (`campo_resultado`, `expresion` JS, `dependencias`).
- `CriterioAceptacion`: un límite normativo (`operador` lt/lte/gt/gte/between/eq, `valor`,
  `referencia_normativa`).
- `TextosPrueba`: `objetivo` / `instrumentacion` / `metodologia` / `criterio` para el informe.
- `SlotImagen` / `ImagenEmbebida`: espacios y almacenamiento de imágenes (Blob local + URL de storage).

Cómo se evalúan estas estructuras se explica en [Motor de pruebas](05-motor-de-pruebas.md).

## 3.6 Correspondencia con Supabase

El esquema PostgreSQL vive en [`supabase/migrations/`](../supabase/migrations/) (001 → 009). Los
tipos generados están en `src/lib/supabase/types.ts`. Las políticas **RLS** (Row Level Security)
se definen en `002_row_level_security.sql` y `005_rls_fix_and_new_tables.sql`. La migración
`009_migrate_pks_to_uuid.sql` es el espejo server-side de la migración Dexie v13.
