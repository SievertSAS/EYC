# 1. Visión general

## 1.1 Objetivo

**Sievert EyC** digitaliza el proceso de **control de calidad y verificación de cumplimiento**
de equipos generadores de radiación ionizante (rayos X de uso médico e industrial).

El objetivo de negocio es que un técnico especialista pueda ir a las instalaciones de un
cliente (una clínica, un hospital, un consultorio odontológico, una empresa) y, sin depender de
conexión a internet:

1. Ejecutar un protocolo de pruebas normalizado sobre un equipo de rayos X.
2. Capturar mediciones en campo (manuales o importadas de instrumentos como el RaySafe X2).
3. Obtener automáticamente los cálculos y la evaluación de **conformidad** de cada prueba.
4. Generar un **pre-informe PDF** que luego es revisado y aprobado por un coordinador/ingeniero.
5. Emitir un **informe final** con número consecutivo, vigencia de 2 años y validación por QR.

Esto sustituye un proceso tradicionalmente hecho en papel y hojas de cálculo, propenso a
errores de transcripción, sin trazabilidad y difícil de auditar.

## 1.2 Marco normativo

La lógica de las pruebas y los criterios de aceptación están alineados con:

- **Resolución 1811 de 2023** (Ministerio de Salud, Colombia) — reglamenta la protección
  radiológica y el control de calidad de equipos emisores de radiación ionizante. De ahí salen,
  entre otros, la **vigencia de 2 años** del informe y el concepto de conformidad.
- **IAEA TECDOC 1958** — documento técnico del Organismo Internacional de Energía Atómica que
  define las pruebas de control de calidad, su metodología, instrumentación y tolerancias. Las
  pruebas se identifican por su **número TECDOC** (`2.1`, `2.4`, `2.17`, etc.).

> El código refleja esta normativa de forma explícita: cada `PruebaDefinicion` tiene un
> `numero_tecdoc`, `criterios_aceptacion` con su `referencia_normativa`, y textos de informe
> (`objetivo`, `instrumentacion`, `metodologia`, `criterio`).

## 1.3 Usuarios y roles

Cuatro roles, cada uno con permisos por módulo (ver [Workflow y roles](04-workflow-y-roles.md)):

| Rol | Descripción | Actividad principal |
|-----|-------------|---------------------|
| **Técnico** | Especialista de campo | Ejecuta visitas, captura mediciones, genera el pre-informe |
| **Coordinador** | Administra la operación y calidad | Revisa y aprueba informes, gestiona usuarios y permisos (es el "admin") |
| **Programador** | Agenda el trabajo | Gestiona solicitudes y programación de visitas |
| **Comercial** | Pipeline comercial | Registra clientes y solicitudes, ve el pipeline |

## 1.4 Conceptos de dominio

Jerarquía de datos, de lo general a lo específico:

```
Cliente ─┬─ Contactos
         └─ Sede ── Ubicación RX (sala) ── Equipo ─┬─ Tubo(s)
                                                    ├─ Colimador / Gantry
                                                    └─ Valores de referencia
```

- **Cliente:** la entidad prestadora del servicio de salud o empresa (identificada por NIT).
- **Sede:** una ubicación física del cliente (con municipio/departamento DANE).
- **Ubicación RX:** la sala donde está el equipo, con sus dimensiones y blindaje.
- **Equipo:** el generador de rayos X. Tiene un `tipo_equipo` (CONVENCIONAL, CT, MAMOGRAFO…)
  que determina **qué pruebas aplican**.
- **Solicitud:** el encargo comercial/operativo que dispara una visita. Recorre un *pipeline*.
- **Visita:** la ejecución en terreno. Es el corazón del sistema; agrupa todas las mediciones y
  recorre una máquina de estados hasta convertirse en informe.
- **Prueba:** una verificación individual (p. ej. "exactitud del kVp"). Se agrupan en *grupos*
  que comparten una sesión de medición.
- **Informe:** el documento final versionado, con concepto general FAVORABLE / NO_FAVORABLE.

## 1.5 Ciclo de vida (alto nivel)

```
COMERCIAL/PROGRAMADOR        TÉCNICO (en campo, offline)              COORDINADOR
─────────────────────  ───────────────────────────────────────  ──────────────────
 Cliente → Solicitud →  Visita: asignada → en_progreso →          en_revision →
           (pipeline)   completada → pre_informe → en_revision    aprobada → Informe
                                                                   (o "devolver")
```

El detalle de cada transición, sus *gates* de validación y qué rol puede ejecutarla está en
[Flujo de trabajo y roles](04-workflow-y-roles.md).

## 1.6 Alcance actual

- **Implementado:** paquete de equipo **CONVENCIONAL** con sus 5 grupos (A–E) y 21 pruebas
  TECDOC, captura offline completa, precarga de información general, editor visual del
  pre-informe, permisos granulares por rol/módulo, sync bidireccional de las tablas núcleo.
- **En construcción:** generador PDF final, importación automática del archivo RaySafe,
  inclusión de las tablas `conv_*` en el sync, y los paquetes para los demás tipos de equipo
  (CT, MAMOGRAFO, PANORAMICO, etc.), que ya están declarados pero comentados en el registro.

Ver [`../TODO.md`](../TODO.md) para el detalle.
