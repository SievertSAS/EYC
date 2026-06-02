# Plan de Implementación: App Estudios y Controles - Sievert S.A.S.

## Contexto

Sievert S.A.S. presta servicios de protección contra radiación ionizante. Su línea de **Estudios y Controles** realiza pruebas de control de calidad a equipos de rayos X en hospitales y clínicas, generando informes técnicos regulados por la **Resolución 1811 de 2025** y el **IAEA-TECDOC-1958**.

**Problema actual**: La captura de datos en campo y la generación de informes se hace de forma manual/desconectada. No hay integración con el CRM (SuiteCRM) y los técnicos no siempre tienen acceso a internet en las instalaciones donde prestan servicio.

**Objetivo**: Desarrollar una PWA mobile-first que permita capturar datos de pruebas en campo (offline), generar pre-informes para revisión del ingeniero, y sincronizar con SuiteCRM vía endpoint REST.

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | Next.js 15 (App Router) + TypeScript | PWA con soporte offline, mobile-first responsive |
| **UI** | Tailwind CSS + shadcn/ui | Componentes accesibles, optimizados para táctil |
| **Formularios** | React Hook Form + Zod | Validación tipada por prueba, autosave |
| **Offline DB** | Dexie.js (IndexedDB) | Almacenamiento local estructurado con sync hooks |
| **Backend** | Firebase (Auth + Firestore + Storage) | Auth multi-dispositivo, Storage para fotos. Firestore como capa de sincronización |
| **BD Relacional** | PostgreSQL (Cloud SQL o Supabase PostgreSQL) | La estructura de datos es altamente relacional; Firestore se usa como capa de cache/sync, PostgreSQL como fuente de verdad |
| **PDF** | jsPDF + autoTable | Generación de pre-informes offline sin servidor |
| **Fotos** | Camera API (MediaDevices) | Captura directa desde el dispositivo |
| **CRM** | SuiteCRM REST API v8 | Integración bidireccional vía endpoint |
| **PWA** | Serwist (Service Workers) | Precache de app shell + offline-first |

### Estrategia Offline (prioridad #1)

```
┌─────────────────────────────────────────────┐
│  DISPOSITIVO (Celular/Tablet/Laptop)        │
│                                             │
│  ┌─────────┐    ┌──────────────────────┐    │
│  │ React   │◄──►│ Dexie.js (IndexedDB) │    │
│  │ Forms   │    │                      │    │
│  └─────────┘    │ - clientes           │    │
│                 │ - equipos            │    │
│                 │ - visitas            │    │
│                 │ - prueba_resultados  │    │
│                 │ - fotos (blobs)      │    │
│                 │ - sync_queue         │    │
│                 └──────────┬───────────┘    │
│                            │                │
│              ┌─────────────▼──────────┐     │
│              │  Sync Engine           │     │
│              │  (detecta conexión,    │     │
│              │   procesa cola)        │     │
│              └─────────────┬──────────┘     │
└────────────────────────────┼────────────────┘
                             │ Cuando hay internet
                             ▼
              ┌──────────────────────────┐
              │  Firebase / PostgreSQL   │
              │  + SuiteCRM endpoint     │
              └──────────────────────────┘
```

**Flujo**: Todo se guarda PRIMERO en IndexedDB local. El Sync Engine detecta conexión y sube datos pendientes. Si no hay internet, el técnico trabaja 100% offline y sincroniza cuando vuelva a tener señal.

---

## Actualizaciones al Esquema de Base de Datos

### Tablas nuevas (faltan en el DBML actual)

**tecnicos** (asignación de servicios):
- id, nombre, cedula, email, telefono, cargo, activo, firebase_uid, creado_en

**tubos** (separados de equipos, un equipo puede tener múltiples tubos):
- id, equipo_id (FK), marca, modelo, numero_serie, tipo, mas_max, kv_max, ma_max, tiempo_s, foco_fino_mm, foco_grueso_mm

**colimadores**:
- id, equipo_id (FK), marca, modelo, numero_serie

**gantry** (solo para CT):
- id, equipo_id (FK), marca, modelo, numero_serie, tipo_detector

**sala_dimensiones** (dimensiones del cuarto para levantamiento radiométrico):
- id, ubicacion_id (FK), ancho_m, largo_m, alto_m, area_m2, zona_a_desc, zona_b_desc, zona_c_desc, zona_d_desc

**valores_referencia** (37 campos de valores de referencia por equipo):
- id, equipo_id (FK), chr_min_mmal, rendimiento_ref, mtf50_h_ref, mtf50_v_ref, mtf20_h_ref, mtf20_v_ref, ddi_ref, ei_ref, cae_ref, dosis_receptor_extremidad, dosis_receptor_torax, dosis_receptor_abdomen, dosis_receptor_columna, cae_comp_60kvp, cae_comp_70kvp, cae_comp_80kvp, cae_comp_1mm_cu, cae_comp_2mm_cu, cae_comp_3mm_cu, pka_ref, pkl_ref, kerma_periapical_ref, bajo_contraste_ref, (+ campos restantes del Excel)

**prueba_definicion** (catálogo de pruebas por tipo de equipo):
- id, codigo, nombre, descripcion, tipos_equipo_aplicables (array), orden_sugerido, plantilla_informe

**prueba_resultado** (resultados capturados en campo):
- id, visita_id (FK), prueba_definicion_id (FK), equipo_id (FK), concepto ('FAVORABLE'|'NO_FAVORABLE'|'NO_APLICA'), acciones_correctivas, datos_json (JSONB - mediciones específicas por prueba), completado, fecha_ejecucion, _sync_status, _last_modified

**medicion_radiometrica** (puntos individuales del levantamiento):
- id, visita_id (FK), punto_id, ubicacion_desc, tasa_dosis_msv_h, factor_ocupacion, tipo_area ('controlada'|'supervisada'), dosis_anual_msv, concepto, observacion

**evidencia_fotografica**:
- id, visita_id (FK), prueba_resultado_id (FK nullable), tipo, blob_local (IndexedDB), url_storage (Firebase), descripcion, fecha_captura

### Modificaciones a tablas existentes

**visita_ejecucion**: Agregar → tecnico_id (FK), estado_visita ('asignada'|'en_progreso'|'completada'|'pre_informe'|'revisada'|'aprobada'), ingeniero_revisor_id, pre_informe_url, informe_final_url

**solicitudes**: Agregar → tecnico_asignado_id (FK a tecnicos), suitecrm_id (para mapeo con CRM)

---

## Arquitectura de Módulos (Navegación)

```
/login                          → Autenticación (Firebase Auth)
/dashboard                      → Servicios asignados al técnico
  /visitas                      → Lista de visitas pendientes/en progreso
    /[visitaId]                 → Workspace de la visita
      /info-general             → Datos del cliente/equipo (precargados, solo lectura)
      /condiciones              → Temperatura, presión, condiciones operación
      /levantamiento            → Levantamiento radiométrico (puntos + diagrama)
      /inspeccion               → Inspección visual (checklists)
      /pruebas                  → Lista de pruebas aplicables al equipo
        /[pruebaId]             → Formulario de prueba individual
      /evidencias               → Galería de fotos
      /pre-informe              → Preview + generar PDF
/revision                       → (Ingeniero) Revisar y aprobar pre-informes
/sync                           → Estado de sincronización
/admin                          → Gestión de técnicos, equipos, valores referencia
```

### Diseño del Workspace de Visita

Cada módulo de la visita se muestra como una **tarjeta** con indicador de progreso:
- 🔴 Sin iniciar
- 🟡 En progreso (parcialmente completado)
- 🟢 Completado

El técnico puede completar los módulos **en cualquier orden**. El botón "Generar Pre-informe" solo se habilita cuando todos los módulos obligatorios están en 🟢.

---

## Motor de Pruebas (Patrón Registry)

Cada prueba de control de calidad se modela como un módulo autocontenido:

```
src/pruebas/
  registry.ts                    → registerPrueba(), getPruebasForEquipo()
  types.ts                       → PruebaDefinition interface
  modules/
    levantamiento-radiometrico/
      schema.ts                  → Zod schema de los campos
      form.tsx                   → Componente React del formulario
      calculator.ts              → Lógica de cálculo y criterios aceptación
      pdf-section.ts             → Renderizado para el PDF
    inspeccion-visual/
    colimacion/
    kvp-exactitud-repetibilidad/
    tiempo-exposicion/
    chr/
    rendimiento-tubo/
    factor-pka/
    ddi-ei/
    uniformidad-detector/
    resolucion-espacial/
    bajo-contraste/
    mtf/
    cae-sensibilidad/
    cae-consistencia/
    cae-repetibilidad/
    cae-compensacion/
    dosis-receptor/
    alineacion-panoramico/       → Solo para equipos panorámicos
    pkl-pka-dental/              → Solo para equipos dentales
```

Cada módulo exporta:
```typescript
interface PruebaModule {
  id: string;
  nombre: string;
  tiposEquipoAplicables: TipoEquipo[];
  schema: ZodSchema;
  FormComponent: React.FC;
  calcularConcepto: (datos: any, referencia: any) => 'FAVORABLE' | 'NO_FAVORABLE' | 'NO_APLICA';
  renderPdfSection: (datos: any, doc: jsPDF) => void;
}
```

---

## Generación de Pre-informe PDF

### Estructura del PDF (basada en informes ejemplo)

1. **Portada**: Licencia, tipo informe (FT-LEC-6c/6b), No. informe, fecha, equipo evaluado, institución, vigencia
2. **Contenido**: Índice automático de pruebas
3. **Información de la práctica**: Datos generales + datos instalación + especificaciones equipo
4. **Pruebas** (por cada una):
   - Objetivo (texto fijo por tipo de prueba)
   - Instrumentación (texto fijo)
   - Metodología (texto fijo referenciando TECDOC-1958)
   - Resultados (tabla con datos capturados)
   - Análisis (generado automáticamente según resultados vs criterios)
   - Criterio de aceptación (texto fijo + valores de referencia)
   - Evidencia gráfica (fotos embebidas)
   - Concepto (FAVORABLE/NO FAVORABLE/NO APLICA)
   - Acciones correctivas (texto ingresado o "No se requieren")
5. **Resumen de resultados**: Tabla consolidada de todas las pruebas
6. **Concepto general**: FAVORABLE/NO FAVORABLE
7. **Firmas**: Director técnico, responsable visita, generador documento

### Plantillas por tipo de equipo
- **FT-LEC-6c**: Radiografía General (convencional, portátil) → 21 pruebas
- **FT-LEC-6b**: Radiología Extraoral (panorámico, CT dental) → pruebas específicas
- Otras plantillas se agregarán en fases posteriores (mamógrafo, CT, fluoroscopia, etc.)

---

## Integración SuiteCRM

```
SuiteCRM ──(REST API v8)──► Endpoint propio ──► Firebase/PostgreSQL
                                                      │
                                                      ▼
                                                 App (Precarga)
```

- **Pull**: Solicitudes asignadas, datos de cliente/equipo → se descargan como precarga
- **Push**: Estado de la visita, URL del informe aprobado → se actualiza en SuiteCRM
- **Adaptador**: Interfaz abstracta `CRMAdapter` para que el conector sea intercambiable

---

## Roadmap de Desarrollo (Fases)

### Fase 0: Fundamentos (Semanas 1-3)
- Scaffold Next.js 15 + TypeScript + Tailwind + PWA
- Configurar Firebase (Auth, Firestore, Storage)
- Actualizar esquema DBML con todas las tablas nuevas
- Implementar Dexie.js con esquema IndexedDB
- App shell responsive (mobile-first) con navegación
- Login con Firebase Auth
- **Entregable**: PWA instalable con autenticación, sin funcionalidad de negocio

### Fase 1: Precarga + Workspace (Semanas 4-6)
- Módulo de precarga: descargar datos cliente/equipo a IndexedDB
- Dashboard del técnico: lista de servicios asignados
- Workspace de visita con tarjetas de módulos y estado de progreso
- Formulario de condiciones ambientales y operación (primer módulo simple)
- Autosave en IndexedDB en cada cambio de campo
- **Entregable**: Técnico puede ver servicios asignados, abrir una visita y capturar condiciones ambientales offline

### Fase 2: Motor de Pruebas + primeras 6 pruebas (Semanas 7-10)
- Implementar patrón Registry de pruebas
- Componente base `PruebaForm` reutilizable
- 6 pruebas iniciales: Inspección Visual, Colimación, kVp, Tiempo Exposición, CHR, Rendimiento Tubo
- Filtrado automático por tipo de equipo
- Cálculo automático de concepto (FAVORABLE/NO FAVORABLE) según criterios de aceptación
- **Entregable**: Técnico puede completar 6 pruebas para un equipo convencional/portátil

### Fase 3: Levantamiento Radiométrico + Fotos (Semanas 11-13)
- Módulo de levantamiento: captura de puntos de medición con datos de dosis
- Cálculo automático de dosis anual por punto
- Clasificación automática área controlada/supervisada
- Integración Camera API: captura, compresión, almacenamiento en IndexedDB
- Galería de evidencias por visita y por prueba
- **Entregable**: Levantamiento radiométrico completo con fotos offline

### Fase 4: Pruebas restantes (Semanas 14-17)
- Pruebas FT-LEC-6c restantes: DDI/EI, CAE (4 sub-pruebas), Uniformidad, Resolución Espacial, Bajo Contraste, MTF, Factor PKA, Dosis al Receptor, Cassettes/IP CR
- Pruebas FT-LEC-6b para equipos panorámicos/extraoral
- Validaciones completas contra valores de referencia
- **Entregable**: Todas las pruebas para radiografía general y extraoral

### Fase 5: Generación de Pre-informe PDF (Semanas 18-20)
- Motor de plantillas PDF con jsPDF
- Portada, índice, secciones por prueba, tablas de resultados
- Embeber fotos comprimidas en el PDF
- Resumen de resultados y concepto general
- Preview del PDF en la app
- **Entregable**: Técnico genera PDF del pre-informe offline directamente en el dispositivo

### Fase 6: Sync Engine + Revisión del Ingeniero (Semanas 21-24)
- Motor de sincronización: cola de cambios, detección de conexión, retry con backoff
- Dashboard de sync (pendientes/sincronizados/errores)
- Background Sync API
- Interfaz de revisión para el ingeniero: ver datos, editar, aprobar
- Workflow de aprobación (pre-informe → revisado → aprobado)
- Generación del informe final aprobado
- **Entregable**: Flujo completo campo → sync → revisión → aprobación

### Fase 7: Integración SuiteCRM (Semanas 25-27)
- Adaptador CRM con interfaz abstracta
- Conector SuiteCRM REST API v8
- Pull: solicitudes y datos de cliente
- Push: estado de visita e informe aprobado
- **Entregable**: Datos fluyen bidireccionalmente entre la app y SuiteCRM

### Fase 8: Equipos adicionales + Pulido (Semanas 28-30)
- Módulos de prueba para: Mamógrafo, CT, Arco en C, Fluoroscopia, Periapical, Densitómetro
- Optimización de rendimiento en dispositivos móviles
- Testing end-to-end con datos reales
- **Entregable**: App lista para producción con todos los tipos de equipo

---

## Verificación y Testing

- **Cada fase**: Probar en Chrome Android (celular), Chrome tablet, Chrome laptop
- **Offline**: Activar modo avión, capturar datos completos de una visita, verificar que todo se persiste en IndexedDB
- **Sync**: Restaurar conexión, verificar que datos suben correctamente
- **PDF**: Comparar pre-informe generado con informes ejemplo (docs/202604014... y docs/202604006...)
- **Validación**: Verificar que los criterios de aceptación de cada prueba coinciden con la Resolución 1811 y el TECDOC-1958

---

## Archivos Críticos de Referencia

- `docs/estudios_controles.dbml` → Esquema BD actual (requiere extensión)
- `docs/20260424 Campos Precarga.xlsx` → 108 campos con tablas, tipos y validaciones
- `docs/resolucion-1811-de-2025.pdf` → Normativa regulatoria
- `docs/202604014 CE PORT HOSPITAL SANTA SOFIA MANIZALES.pdf` → Plantilla FT-LEC-6c (42 págs, RX portátil)
- `docs/202604006 CE PANO FERNANDO DEL CASTILLO.pdf` → Plantilla FT-LEC-6b (20 págs, panorámico)
