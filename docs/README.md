# Documentación — Sievert EyC

Documentación técnica y funcional de la plataforma **Sievert Estudios y Controles (EyC)**:
una aplicación web PWA para el control de calidad y cumplimiento normativo de equipos de
radiación ionizante, con soporte **offline-first** para trabajo de campo.

> Esta carpeta es la fuente de verdad para entender **qué hace** la app, **cómo está
> construida** y **cómo trabajar** sobre ella. Está pensada tanto para desarrolladores nuevos
> como para stakeholders (coordinación, calidad, comercial).

## Índice

| # | Documento | Para quién | Contenido |
|---|-----------|-----------|-----------|
| 1 | [Visión general](01-vision-general.md) | Todos | Objetivo, dominio, usuarios, normativa, alcance |
| 2 | [Arquitectura](02-arquitectura.md) | Desarrolladores | Stack, capas, decisiones de diseño, estructura de carpetas |
| 3 | [Modelo de datos](03-modelo-de-datos.md) | Desarrolladores | Entidades, esquema Dexie, tipos, catálogos |
| 4 | [Flujo de trabajo y roles](04-workflow-y-roles.md) | Todos | Máquina de estados de visitas, roles, permisos, pipeline |
| 5 | [Motor de pruebas y equipos](05-motor-de-pruebas.md) | Desarrolladores | Paquetes por equipo, motor de fórmulas, criterios TECDOC |
| 6 | [Sincronización offline](06-sincronizacion-offline.md) | Desarrolladores | Sync bidireccional, estados, conflictos, PWA |
| 7 | [Seguridad](07-seguridad.md) | Desarrolladores / Seguridad | Auth, permisos, sandbox de fórmulas, API |
| 8 | [Guía de desarrollo](08-guia-desarrollo.md) | Desarrolladores | Setup, comandos, convenciones, testing, migraciones |
| 9 | [Glosario](09-glosario.md) | Todos | Términos de dominio, radioprotección y del código |

## Resumen en 60 segundos

- **Qué es:** herramienta para que técnicos de campo ejecuten inspecciones de control de
  calidad de equipos de rayos X y generen pre-informes conforme a la **Resolución 1811 de 2023**
  (Colombia) y el **IAEA TECDOC 1958**.
- **Cómo funciona:** el técnico ejecuta una *visita* estructurada en módulos/grupos de pruebas,
  captura mediciones (algunas importadas del sensor **RaySafe X2**), el sistema calcula
  resultados y evalúa criterios de aceptación, y produce un **pre-informe PDF** que un
  coordinador revisa y aprueba.
- **Offline-first:** todo funciona sin conexión sobre **IndexedDB (Dexie)**; cuando hay red,
  un motor de sincronización sube y baja cambios contra **Supabase (PostgreSQL + Auth)**.
- **Multi-equipo:** la lógica de pruebas está encapsulada en "paquetes" por tipo de equipo.
  Hoy está implementado el paquete **CONVENCIONAL**; el resto está previsto en el registro.

## Estado del proyecto

Consulta [`../TODO.md`](../TODO.md) para el roadmap detallado. En una frase: el flujo de captura
de las 21 pruebas del equipo convencional está construido; están pendientes la conexión final
del **generador PDF**, la **importación RaySafe**, y añadir las tablas `conv_*` al **sync**.
