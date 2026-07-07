# 9. Glosario

## Dominio y radioprotección

| Término | Significado |
|---------|-------------|
| **Radiación ionizante** | Radiación con energía suficiente para ionizar átomos (rayos X). Objeto de control de la app. |
| **Control de calidad (CC)** | Conjunto de pruebas que verifican que un equipo de rayos X opera dentro de tolerancias seguras. |
| **TECDOC 1958** | Documento técnico de la IAEA que define las pruebas de CC, su metodología y tolerancias. Cada prueba tiene un **número TECDOC** (`2.1`, `2.4`…). |
| **Resolución 1811 (2023)** | Norma colombiana de protección radiológica. Fija, entre otros, la vigencia de 2 años del informe y el concepto de conformidad. |
| **Levantamiento radiométrico** | Medición de tasa de dosis en distintos puntos de la sala para verificar blindaje (prueba 2.1). |
| **Tasa de dosis** | Dosis de radiación por unidad de tiempo (µSv/h, mSv/h). |
| **H*(10)** | Equivalente de dosis ambiental; magnitud del levantamiento radiométrico. |
| **kVp** | Tensión pico del tubo de rayos X (kilovoltios). Se verifica su exactitud/repetibilidad (2.5). |
| **mAs** | Producto corriente × tiempo; controla la cantidad de radiación. |
| **CHR / HVL** | Capa hemirreductora (Half-Value Layer): espesor que reduce a la mitad la intensidad; mide la calidad del haz. |
| **CAE** | Control Automático de Exposición: sensibilidad, consistencia, repetibilidad y compensación (2.17–2.20). |
| **DDI / EI** | Índice de dosis/exposición del detector digital. Su desviación vs base se controla (2.9, 2.10). |
| **MTF** | Función de Transferencia de Modulación: mide resolución/nitidez (MTF50, MTF20) (2.16). |
| **Resolución espacial** | Capacidad de distinguir detalles finos (pares de líneas por mm) (2.12). |
| **Bajo contraste** | Capacidad de distinguir objetos con poca diferencia de densidad (2.13). |
| **Uniformidad (CR / detector)** | Homogeneidad de la respuesta del receptor de imagen (2.11, 2.15). |
| **Colimación** | Alineación entre campo de luz y campo de radiación (2.3). |
| **Cassette / CR** | Radiografía computarizada (Computed Radiography): placas de fósforo reutilizables. |
| **RaySafe X2** | Instrumento multiparamétrico que mide kVp, tiempo, dosis, CHR, etc. Fuente de datos del Grupo B. |
| **Blindaje** | Barreras (plomo, concreto) que protegen zonas colindantes; se describe por zonas A/B/C/D. |
| **Concepto / conformidad** | Resultado de una prueba: `FAVORABLE`, `NO_FAVORABLE` o `NO_APLICA`. |
| **OPR** | Oficial/encargado de protección radiológica del cliente. |
| **DIVIPOLA / DANE** | Codificación oficial colombiana de departamentos y municipios. |
| **NIT** | Número de identificación tributaria del cliente. |

## Entidades y conceptos del código

| Término | Significado |
|---------|-------------|
| **Cliente / Sede / Ubicación RX / Equipo** | Jerarquía maestra (ver [Modelo de datos](03-modelo-de-datos.md)). |
| **Solicitud** | Encargo que dispara una visita; recorre el `pipeline_estado`. |
| **Visita (`VisitaEjecucion`)** | Ejecución en campo; recorre la máquina de estados. Núcleo del sistema. |
| **Módulo (`ModuloVisita`)** | Paso/pantalla dentro de una visita (p. ej. Grupo A). |
| **Grupo de prueba** | Conjunto de pruebas que comparten una sesión de medición. |
| **Prueba (`PruebaDefinicion` / `PruebaResultado`)** | Verificación individual: definición (catálogo) vs resultado (captura). |
| **Fórmula (`FormulaDefinicion`)** | Cálculo auto-evaluado sobre las mediciones crudas. |
| **Criterio (`CriterioAceptacion`)** | Límite normativo que decide si una prueba cumple. |
| **EquipmentPackage** | Paquete que encapsula módulos, grupos y generación de PDF de un tipo de equipo. |
| **Registry** | Mapa `TipoEquipo → EquipmentPackage`; único punto de acceso. |
| **Engine** | Evaluador puro de fórmulas y criterios (`lib/equipos/engine.ts`). |
| **Gate** | Validación bloqueante en una transición de estado (solo "completar visita"). |
| **Completitud (`getVisitCompleteness`)** | % de avance de los módulos de una visita. |
| **Informe / InformeVersion** | Documento final versionado, con número consecutivo y QR. |
| **`sync_status`** | Estado de sincronización de un registro: `pending` / `synced` / `conflict` / `error`. |
| **`pushSingle` / `fullSync` / `pushAllPending`** | Variantes del motor de sincronización. |
| **`sync_meta`** | Marca de tiempo de la última descarga por tabla. |
| **`change_logs` / `trackChange`** | Auditoría campo a campo (pendiente de activar). |
| **`RoleProvider` / `hasPermission`** | Contexto y API de permisos en React. |
| **`proxy.ts`** | Equivalente al middleware en Next.js 16; protege `/dashboard/*`. |
| **PWA / service worker** | Permite instalar la app y usarla offline. |
| **Dexie** | Wrapper de IndexedDB; base de datos local (fuente de verdad en runtime). |
| **Supabase** | Backend: PostgreSQL + Auth + RLS + Storage. |
| **RLS** | Row Level Security: autorización a nivel de fila en PostgreSQL. |

## Códigos y formatos

| Formato | Ejemplo | Significado |
|---------|---------|-------------|
| Número de informe | `EYC-2026-001` | `EYC-{año}-{secuencia}` |
| Plantilla convencional | `FT-LEC-6c` | Código de plantilla de informe del equipo |
| Número TECDOC | `2.17` | Identificador de prueba según IAEA TECDOC 1958 |
| Vigencia informe | emisión + 2 años | Resolución 1811 |
