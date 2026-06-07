# EyC — Roadmap de desarrollo

## Estado actual

### ✅ Completado
- **Informacion General (precarga)**: pagina editable con 7 secciones, porcentajes de llenado, autosave, creacion de contactos por cargo
- **Arquitectura por equipo**: tablas dedicadas `conv_*` en Dexie v6-v10, tipos en `convencional/db/types.ts`
- **Grupo A (2.1 + 2.2)**: levantamiento radiometrico + inspeccion visual en `conv/grupo-a`
  - Setup: fondo natural, distancia, tecnica, carga de trabajo con W auto-calculada
  - Tabla de mediciones: formula H*(10) con persistencia de U, W, I, dosis y concepto por fila
  - Inspeccion visual: 4 items equipo + 12 items condiciones operacion
  - Elementos de proteccion: tabla con catalogo desplegable estandarizado
  - Captura de imagenes por slot (montaje + plano radiometrico)
  - Alertas (amarillo) vs recomendaciones (morado)
- **Grupo B — RaySafe (2.4, 2.5, 2.6, 2.7, 2.21, 2.8)**: en `conv/grupo-b`
  - Setup: distancia foco-sensor, fotos de montaje
  - 8 grupos de disparos principales (20 tomas pre-inicializadas)
  - Mediciones con/sin rejilla para programas clinicos
  - Mediciones de Kerma en aire para factor PKA
  - Campos nominales + medidos por RaySafe
- **Grupo C — CAE (2.17, 2.18, 2.19, 2.20)**: en `conv/grupo-c`
  - 15 disparos pre-inicializados segun plantilla TECDOC
  - Valores base editables (sensibilidad, compensacion kVp, compensacion espesores)
  - Resultados auto-calculados:
    - 2.17 Sensibilidad: |medido - base| / base <= 50%
    - 2.18 Consistencia: (MAX-MIN)/promedio <= 30%
    - 2.19 Repetibilidad: CV (stdev/promedio) <= 10%
    - 2.20 Compensacion: variacion vs base <= 30%
- **Grupo D — DDI/EI, Cassettes, Uniformidad CR (2.9, 2.10, 2.14, 2.15)**: en `conv/grupo-d`
  - 6 disparos DDI/EI (grupo 1 x3 rep + grupos 2-4)
  - Valores base EI/DI de visita anterior
  - 2.9: desviacion vs base <= 20%
  - 2.10: CV de 3 repeticiones <= 20%
  - 2.14: inspeccion cassettes N dinamicos (5 checks + concepto)
  - 2.15: uniformidad CR (promedio + desviacion EI entre cassettes)
- **Grupo E — Colimacion, Resolucion, Contraste, MTF (2.3, 2.11, 2.12, 2.13, 2.16)**: en `conv/grupo-e`
  - 2.3: nominal/medido por 4 direcciones, variacion % vs SID, perpendicularidad
  - 2.11: N detectores con 5 ROIs x 2 orientaciones, uniformidad %, artefactos
  - 2.12: pl/mm visibles directo
  - 2.13: 8 niveles de contraste toggle visible/no visible
  - 2.16: MTF50/MTF20 horizontal y vertical + valores base
- **Manual de pruebas**: 21 definiciones TECDOC con objetivo, instrumentacion, pasos, criterios, tips, alertas
- **Drawer lateral**: componente reutilizable compacto con navegacion entre pruebas, animacion de entrada/salida
- **Editor visual pre-informe**: drag & drop para reordenar secciones, toggle on/off, concepto inline, acciones correctivas
- **Catalogo de secciones**: 21 pruebas con textos TECDOC para el PDF
- **Workspace**: porcentajes por modulo, boton iniciar visita para coordinador
- **module-completeness.ts**: consulta tablas `conv_*`, no las genericas
- **module-nav.tsx**: sin modulos viejos hardcodeados
- **Limpieza**: eliminadas paginas viejas, rutas prefijadas por equipo (`conv/grupo-*`)

### 🔲 Pendiente — Infraestructura

#### Generador PDF (pre-informe)
- Conectar `lib/pdf/generar-pre-informe.ts` con tablas `conv_*` y `conv_informe_secciones`
- Respetar el orden y seleccion de secciones del editor visual
- Usar `ConvInformeSeccion.concepto` y `acciones_correctivas` para cada prueba
- Calcular tablas de resultados desde las tablas `conv_*` (mismas formulas que las paginas)
- Embeber imagenes por slot desde `conv_evidencias`

#### Gestion de imagenes en el informe
- Definir como se insertan las imagenes de `conv_evidencias` en el PDF
- Slots de imagen por prueba (montaje, patron, DICOM, etc.)
- Redimensionamiento y compresion para PDF

#### Sync engine
- Agregar tablas `conv_*` al sync bidireccional (`lib/supabase/sync-engine.ts`)
- Crear tablas correspondientes en Supabase (PostgreSQL)
- Actualizar `lib/supabase/types.ts` con los tipos de las tablas nuevas

#### Control de cambios (trackChange)
- Activar `trackChange` en los save helpers de cada modulo
- Registrar quien modifico que campo y cuando
- Ya existe la tabla `change_logs` y la funcion `trackChange`

#### Importacion RaySafe
- Implementar parseo del archivo exportado del sensor RaySafe X2 (.csv/.xlsx)
- Llenar automaticamente los valores medidos en `conv_raysafe_mediciones`
- El boton "Cargar archivo RaySafe" en grupo-b esta pendiente de implementacion

#### Seed del paquete convencional
- Descomentar `seedFromPackage(CONVENCIONAL_PACKAGE)` en `lib/db/seed.ts`
- Esto crea los `GrupoPrueba` y `PruebaDefinicion` en la BD
- Necesario cuando se implemente el vinculo evidencias -> prueba_definicion

### 🔲 Pendiente — Mejoras UX

#### Progreso por modulo
- `getConvGrupoAPercentage` ya implementado
- Completar funciones de progreso para grupos B, C, D, E
- Cada uno consulta sus tablas `conv_*` especificas

#### Validaciones y gates
- Gate de "completar visita" debe verificar modulos requeridos usando tablas `conv_*`
- Actualmente `checkGate` en `visit-state-machine.ts` usa la completitud generica

#### Limpieza de tablas genericas
- Una vez que todos los equipos usen tablas dedicadas, eliminar de Dexie:
  - `mediciones_radiometricas` (reemplazada por `conv_mediciones`)
  - `elementos_proteccion` (reemplazada por `conv_elementos_proteccion`)
  - `prueba_resultados` (reemplazada por `conv_resultados_prueba`)
  - `grupo_resultados` (ya no se usa)
  - `partes_equipo` (reemplazada por `conv_inspeccion_items`)
  - `evidencias` (reemplazada por `conv_evidencias`)
- Requiere migracion Dexie (nueva version) que mueva datos existentes
