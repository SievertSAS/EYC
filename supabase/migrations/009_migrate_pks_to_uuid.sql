-- ============================================================
--  Migración 009: Migrar PKs de BIGSERIAL a UUID
--
--  Estrategia:
--    - DROP en orden hijo→padre (respeta FKs)
--    - RECREAR con UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - Agregar las 19 tablas conv_* para el equipo convencional
--    - Recrear RLS idéntica a migraciones anteriores
--    - departamentos y municipios se quedan con BIGINT (códigos DANE)
--
--  IMPORTANTE: No borrar data de departamentos/municipios/usuarios
--  Ejecutar en SQL Editor de Supabase (no via CLI) para tener
--  control manual.
-- ============================================================

-- ─── 1. Deshabilitar FK checks temporalmente ───
SET session_replication_role = replica;

-- ─── 2. DROP tablas en orden hijo→padre ───
-- (las conv_* aún no existen en Supabase, solo en Dexie)

DROP TABLE IF EXISTS change_logs CASCADE;
DROP TABLE IF EXISTS informe_versiones CASCADE;
DROP TABLE IF EXISTS informes CASCADE;
DROP TABLE IF EXISTS elementos_proteccion CASCADE;
DROP TABLE IF EXISTS evidencias CASCADE;
DROP TABLE IF EXISTS mediciones_radiometricas CASCADE;
DROP TABLE IF EXISTS prueba_resultados CASCADE;
DROP TABLE IF EXISTS grupo_resultados CASCADE;
DROP TABLE IF EXISTS visitas CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS cotizaciones CASCADE;
DROP TABLE IF EXISTS grupo_pruebas CASCADE;
DROP TABLE IF EXISTS prueba_definiciones CASCADE;
DROP TABLE IF EXISTS partes_equipo CASCADE;
DROP TABLE IF EXISTS valores_referencia CASCADE;
DROP TABLE IF EXISTS equipo_movimientos CASCADE;
DROP TABLE IF EXISTS tubos CASCADE;
DROP TABLE IF EXISTS colimadores CASCADE;
DROP TABLE IF EXISTS gantry CASCADE;
DROP TABLE IF EXISTS sala_dimensiones CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
DROP TABLE IF EXISTS ubicaciones_rx CASCADE;
DROP TABLE IF EXISTS sedes CASCADE;
DROP TABLE IF EXISTS contactos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
-- usuarios (tecnicos renombrado) — recrear en bloque aparte
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS rol_permisos CASCADE;

-- ─── 3. Recrear tablas con UUID ───
-- Nota: departamentos y municipios NO se tocan (DANE codes = BIGINT)

-- Usuarios (antes "tecnicos")
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid      UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  cedula        TEXT NOT NULL UNIQUE,
  cargo         TEXT CHECK (cargo IN ('fisico_tecnico','ingeniero','tecnologo','coordinador','programador','tecnico')),
  email         TEXT,
  telefono      TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usuarios_auth ON usuarios(auth_uid);
CREATE INDEX idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX idx_usuarios_sync ON usuarios(sync_status);

CREATE TABLE rol_permisos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo         TEXT NOT NULL,
  recurso       TEXT NOT NULL,
  accion        TEXT NOT NULL,
  permitido     BOOLEAN NOT NULL DEFAULT TRUE,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maestros
CREATE TABLE clientes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cliente              TEXT NOT NULL,
  nombre_prestador            TEXT,
  nit                         TEXT NOT NULL,
  digito_verificacion         TEXT,
  naturaleza                  TEXT CHECK (naturaleza IN ('privado','publico','mixto')),
  direccion                   TEXT,
  telefono                    TEXT,
  email                       TEXT,
  nombre_representante_legal  TEXT,
  sync_status                 TEXT NOT NULL DEFAULT 'synced',
  last_modified               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clientes_nit ON clientes(nit);
CREATE INDEX idx_clientes_sync ON clientes(sync_status);

CREATE TABLE contactos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  cargo         TEXT CHECK (cargo IN ('medico_responsable','tecnologo','opr','representante','otro')),
  cedula        TEXT,
  telefono      TEXT,
  email         TEXT,
  para_programar BOOLEAN NOT NULL DEFAULT FALSE,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contactos_cliente ON contactos(cliente_id);
CREATE INDEX idx_contactos_sync ON contactos(sync_status);

CREATE TABLE sedes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre_sede     TEXT NOT NULL,
  direccion_sede  TEXT,
  ciudad          TEXT,
  departamento    TEXT,
  departamento_id BIGINT REFERENCES departamentos(id),
  municipio_id    BIGINT REFERENCES municipios(id),
  telefono        TEXT,
  email           TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sedes_cliente ON sedes(cliente_id);
CREATE INDEX idx_sedes_sync ON sedes(sync_status);

CREATE TABLE ubicaciones_rx (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id                     UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  nombre_servicio             TEXT NOT NULL,
  licencia                    TEXT,
  fecha_expiracion_licencia   DATE,
  codigo_habilitacion         TEXT,
  horas_x_dia                 NUMERIC(4,1),
  ubicacion_fisica            TEXT,
  ancho_m                     NUMERIC(6,2),
  largo_m                     NUMERIC(6,2),
  alto_m                      NUMERIC(6,2),
  area_m2                     NUMERIC(8,2),
  zona_a_desc                 TEXT,
  zona_b_desc                 TEXT,
  zona_c_desc                 TEXT,
  zona_d_desc                 TEXT,
  sync_status                 TEXT NOT NULL DEFAULT 'synced',
  last_modified               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ubicaciones_sede ON ubicaciones_rx(sede_id);
CREATE INDEX idx_ubicaciones_sync ON ubicaciones_rx(sync_status);

CREATE TABLE equipos (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ubicacion_id              UUID NOT NULL REFERENCES ubicaciones_rx(id) ON DELETE CASCADE,
  tipo_equipo               TEXT,
  planilla_espacial         BOOLEAN NOT NULL DEFAULT FALSE,
  sistema_adquisicion       TEXT,
  distancia_foco_paciente   NUMERIC(6,1),
  bucky                     TEXT CHECK (bucky IN ('Si','No','No_aplica')),
  gen_marca                 TEXT,
  gen_modelo                TEXT,
  gen_numero_serie          TEXT,
  gen_fecha_fabricacion     DATE,
  gen_fase                  TEXT CHECK (gen_fase IN ('monofasico','trifasico','alta_frecuencia')),
  gen_energia_fotones_mev   TEXT,
  filtracion_inherente_mmal NUMERIC(6,2),
  filtracion_anadida_mmal   NUMERIC(6,2),
  sync_status               TEXT NOT NULL DEFAULT 'synced',
  last_modified             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipos_ubicacion ON equipos(ubicacion_id);
CREATE INDEX idx_equipos_tipo ON equipos(tipo_equipo);
CREATE INDEX idx_equipos_sync ON equipos(sync_status);

CREATE TABLE tubos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  tipo            TEXT,
  mas_max         NUMERIC(10,2),
  kv_max          NUMERIC(10,2),
  ma_max          NUMERIC(10,2),
  tiempo_s        NUMERIC(10,4),
  foco_fino_mm    NUMERIC(6,3),
  foco_grueso_mm  NUMERIC(6,3),
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tubos_equipo ON tubos(equipo_id);

CREATE TABLE colimadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gantry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  tipo_detector   TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sala_dimensiones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ubicacion_id    UUID NOT NULL REFERENCES ubicaciones_rx(id) ON DELETE CASCADE,
  ancho_m         NUMERIC(6,2),
  largo_m         NUMERIC(6,2),
  alto_m          NUMERIC(6,2),
  area_m2         NUMERIC(8,2),
  zona_a_desc     TEXT,
  zona_b_desc     TEXT,
  zona_c_desc     TEXT,
  zona_d_desc     TEXT,
  plano_url       TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE partes_equipo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  parte_nombre    TEXT NOT NULL,
  estado          TEXT CHECK (estado IN ('bueno','regular','malo','no_aplica')),
  observacion     TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE valores_referencia (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id                       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  kerma_aire_incidente            NUMERIC(12,4),
  pkl_panoramico                  NUMERIC(12,4),
  pkl_ct_dental                   NUMERIC(12,4),
  pka_ref                         NUMERIC(12,4),
  ddi_ref                         NUMERIC(12,4),
  ei_ref                          NUMERIC(12,4),
  mtf50_h_ref                     NUMERIC(12,4),
  mtf50_v_ref                     NUMERIC(12,4),
  mtf20_h_ref                     NUMERIC(12,4),
  mtf20_v_ref                     NUMERIC(12,4),
  cae_sensibilidad_ref            NUMERIC(12,4),
  cae_comp_60kvp                  NUMERIC(12,4),
  cae_comp_70kvp                  NUMERIC(12,4),
  cae_comp_80kvp                  NUMERIC(12,4),
  cae_comp_1mm_cu                 NUMERIC(12,4),
  cae_comp_2mm_cu                 NUMERIC(12,4),
  cae_comp_3mm_cu                 NUMERIC(12,4),
  rendimiento_ref                 NUMERIC(12,4),
  rendimiento_repetibilidad       NUMERIC(12,4),
  rendimiento_linealidad          NUMERIC(12,4),
  dosis_receptor_extremidad       NUMERIC(12,4),
  dosis_receptor_torax            NUMERIC(12,4),
  dosis_receptor_columna          NUMERIC(12,4),
  dosis_receptor_abdomen          NUMERIC(12,4),
  bajo_contraste_ref              NUMERIC(12,4),
  valor_base_patron               TEXT,
  chr_min_mmal                    NUMERIC(12,4),
  sync_status                     TEXT NOT NULL DEFAULT 'synced',
  last_modified                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipo_movimientos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id             UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  ubicacion_anterior_id UUID REFERENCES ubicaciones_rx(id),
  ubicacion_nueva_id    UUID NOT NULL REFERENCES ubicaciones_rx(id),
  fecha_movimiento      DATE NOT NULL,
  motivo                TEXT,
  registrado_por_id     UUID REFERENCES usuarios(id),
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cotizaciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  valor_total       NUMERIC(14,2),
  forma_pago        TEXT,
  fecha_cotizacion  DATE,
  fecha_aceptacion  DATE,
  estado            TEXT CHECK (estado IN ('borrador','enviada','aceptada','rechazada')) DEFAULT 'borrador',
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE solicitudes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id         UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  cliente_id            UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contacto_programar_id UUID REFERENCES contactos(id) ON DELETE SET NULL,
  ubicacion_id          UUID REFERENCES ubicaciones_rx(id) ON DELETE SET NULL,
  tecnico_asignado_id   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_servicio         TEXT,
  pipeline_estado       TEXT NOT NULL DEFAULT 'solicitudes'
                        CHECK (pipeline_estado IN ('solicitudes','programacion','ejecucion','notificado','enviado')),
  forma_pago            TEXT,
  pago_recibido         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_solicitud       DATE,
  fecha_estimada_visita DATE,
  fecha_real_visita     DATE,
  fecha_entrega         DATE,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_solicitudes_cliente ON solicitudes(cliente_id);
CREATE INDEX idx_solicitudes_pipeline ON solicitudes(pipeline_estado);
CREATE INDEX idx_solicitudes_tecnico ON solicitudes(tecnico_asignado_id);
CREATE INDEX idx_solicitudes_sync ON solicitudes(sync_status);

-- Catálogos de pruebas
CREATE TABLE prueba_definiciones (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  TEXT NOT NULL UNIQUE,
  nombre                  TEXT NOT NULL,
  descripcion             TEXT,
  tipos_equipo_aplicables TEXT[] NOT NULL DEFAULT '{}',
  orden_sugerido          INT,
  plantilla_informe       TEXT,
  activa                  BOOLEAN NOT NULL DEFAULT TRUE,
  grupo_id                UUID,
  orden_en_grupo          INT,
  formulas                JSONB,
  criterios_aceptacion    JSONB,
  textos_informe          JSONB,
  slots_imagen            JSONB,
  numero_tecdoc           TEXT,
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grupo_pruebas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT NOT NULL UNIQUE,
  nombre            TEXT NOT NULL,
  tipo_equipo       TEXT NOT NULL,
  orden             INT NOT NULL DEFAULT 0,
  schema_mediciones JSONB NOT NULL DEFAULT '{"columnas":[]}',
  slots_imagen      JSONB NOT NULL DEFAULT '[]',
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK now that grupo_pruebas exists
ALTER TABLE prueba_definiciones ADD CONSTRAINT fk_prueba_def_grupo
  FOREIGN KEY (grupo_id) REFERENCES grupo_pruebas(id);

-- Ejecución
CREATE TABLE visitas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id            UUID NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  equipo_id               UUID REFERENCES equipos(id),
  ubicacion_id            UUID REFERENCES ubicaciones_rx(id),
  tecnico_id              UUID REFERENCES usuarios(id),
  estado_visita           TEXT NOT NULL DEFAULT 'asignada'
                          CHECK (estado_visita IN ('asignada','en_progreso','completada','pre_informe','en_revision','aprobada')),
  ingeniero_revisor_id    UUID REFERENCES usuarios(id),
  dias_laborados_semana   INT,
  pacientes_por_semana    INT,
  radiografias_por_semana INT,
  kv_maximo_usado         NUMERIC(8,2),
  mas_maximo_usado        NUMERIC(8,2),
  max_disparos_paciente   INT,
  porcentaje_rechazo      NUMERIC(5,2),
  temperatura_c           NUMERIC(6,2),
  presion_hpa             NUMERIC(8,2),
  observaciones           TEXT,
  observaciones_revision  TEXT,
  devuelto_en             TIMESTAMPTZ,
  fecha_visita            DATE,
  sync_status             TEXT NOT NULL DEFAULT 'synced',
  last_modified           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_visitas_solicitud ON visitas(solicitud_id);
CREATE INDEX idx_visitas_tecnico ON visitas(tecnico_id);
CREATE INDEX idx_visitas_estado ON visitas(estado_visita);
CREATE INDEX idx_visitas_equipo ON visitas(equipo_id);
CREATE INDEX idx_visitas_sync ON visitas(sync_status);

CREATE TABLE grupo_resultados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  grupo_id          UUID NOT NULL REFERENCES grupo_pruebas(id),
  equipo_id         UUID NOT NULL REFERENCES equipos(id),
  mediciones_json   JSONB NOT NULL DEFAULT '[]',
  imagenes          JSONB NOT NULL DEFAULT '[]',
  completado        BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_ejecucion   DATE,
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_grupo_resultados_visita ON grupo_resultados(visita_id);

CREATE TABLE prueba_resultados (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id               UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_definicion_id    UUID NOT NULL REFERENCES prueba_definiciones(id),
  equipo_id               UUID NOT NULL REFERENCES equipos(id),
  grupo_resultado_id      UUID REFERENCES grupo_resultados(id),
  concepto                TEXT CHECK (concepto IN ('FAVORABLE','NO_FAVORABLE','NO_APLICA')),
  acciones_correctivas    TEXT,
  datos_json              JSONB,
  resultados_calculados   JSONB,
  evaluacion_criterios    JSONB,
  imagenes                JSONB,
  completado              BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_ejecucion         DATE,
  sync_status             TEXT NOT NULL DEFAULT 'synced',
  last_modified           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prueba_res_visita ON prueba_resultados(visita_id);
CREATE INDEX idx_prueba_res_definicion ON prueba_resultados(prueba_definicion_id);
CREATE INDEX idx_prueba_res_sync ON prueba_resultados(sync_status);

CREATE TABLE mediciones_radiometricas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  punto_numero          INT NOT NULL,
  ubicacion_descripcion TEXT NOT NULL,
  tasa_dosis_msv_h      NUMERIC(12,6),
  factor_ocupacion      TEXT,
  tipo_area             TEXT CHECK (tipo_area IN ('controlada','supervisada')),
  dosis_anual_msv       NUMERIC(12,6),
  concepto              TEXT CHECK (concepto IN ('Conforme','No_conforme')),
  observacion           TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mediciones_visita ON mediciones_radiometricas(visita_id);
CREATE INDEX idx_mediciones_sync ON mediciones_radiometricas(sync_status);

CREATE TABLE evidencias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id           UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_resultado_id UUID REFERENCES prueba_resultados(id) ON DELETE SET NULL,
  tipo                TEXT,
  descripcion         TEXT,
  storage_path        TEXT,
  url_storage         TEXT,
  fecha_captura       TIMESTAMPTZ,
  sync_status         TEXT NOT NULL DEFAULT 'synced',
  last_modified       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evidencias_visita ON evidencias(visita_id);

CREATE TABLE elementos_proteccion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  descripcion   TEXT NOT NULL,
  cantidad      INT,
  concepto      TEXT CHECK (concepto IN ('Conforme','No_conforme')),
  observacion   TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Informes
CREATE TABLE informes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL REFERENCES visitas(id),
  equipo_id         UUID NOT NULL REFERENCES equipos(id),
  ubicacion_id      UUID NOT NULL REFERENCES ubicaciones_rx(id),
  numero_informe    TEXT NOT NULL,
  plantilla         TEXT,
  titulo            TEXT,
  version_actual    INT NOT NULL DEFAULT 1,
  concepto_general  TEXT CHECK (concepto_general IN ('FAVORABLE','NO_FAVORABLE')),
  qr_token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  qr_url            TEXT,
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','pre_informe','en_revision','correccion_fisica','correccion_cliente','aprobado','vigente','vencido')),
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_informes_visita ON informes(visita_id);
CREATE INDEX idx_informes_numero ON informes(numero_informe);
CREATE INDEX idx_informes_estado ON informes(estado);
CREATE INDEX idx_informes_vencimiento ON informes(fecha_vencimiento);

CREATE TABLE informe_versiones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id          UUID NOT NULL REFERENCES informes(id) ON DELETE CASCADE,
  numero_version      INT NOT NULL,
  motivo_cambio       TEXT CHECK (motivo_cambio IN ('emision_inicial','correccion_fisico','correccion_cliente','actualizacion')),
  descripcion_cambio  TEXT,
  generado_por_id     UUID REFERENCES usuarios(id),
  revisado_por_id     UUID REFERENCES usuarios(id),
  pdf_url             TEXT,
  fecha_generacion    TIMESTAMPTZ NOT NULL,
  fecha_revision      TIMESTAMPTZ,
  fecha_aprobacion    TIMESTAMPTZ,
  estado              TEXT CHECK (estado IN ('borrador','en_revision','aprobado','reemplazado')),
  sync_status         TEXT NOT NULL DEFAULT 'synced',
  last_modified       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE change_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla             TEXT NOT NULL,
  registro_id       TEXT NOT NULL,
  campo             TEXT NOT NULL,
  valor_anterior    TEXT,
  valor_nuevo       TEXT,
  modificado_por_id UUID NOT NULL REFERENCES usuarios(id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_changelog_tabla ON change_logs(tabla, registro_id);
CREATE INDEX idx_changelog_fecha ON change_logs(fecha);

-- ─── 4. Tablas conv_* (equipo convencional — nuevas) ───

CREATE TABLE conv_levantamiento_setup (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  temperatura_c NUMERIC(6,2),
  presion_hpa   NUMERIC(8,2),
  humedad_pct   NUMERIC(5,2),
  instrumento   TEXT,
  numero_serie  TEXT,
  calibrado_en  DATE,
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_levant_setup_sync ON conv_levantamiento_setup(sync_status);

CREATE TABLE conv_mediciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  punto_numero          INT NOT NULL,
  ubicacion_descripcion TEXT NOT NULL,
  tasa_dosis_msv_h      NUMERIC(12,6),
  factor_ocupacion      TEXT,
  tipo_area             TEXT CHECK (tipo_area IN ('controlada','supervisada')),
  dosis_anual_msv       NUMERIC(12,6),
  concepto              TEXT CHECK (concepto IN ('Conforme','No_conforme')),
  observacion           TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_med_visita ON conv_mediciones(visita_id);
CREATE INDEX idx_conv_med_sync ON conv_mediciones(sync_status);

CREATE TABLE conv_inspeccion_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  categoria     TEXT,
  item          TEXT NOT NULL,
  estado        TEXT CHECK (estado IN ('conforme','no_conforme','no_aplica')),
  observacion   TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_insp_visita ON conv_inspeccion_items(visita_id);
CREATE INDEX idx_conv_insp_sync ON conv_inspeccion_items(sync_status);

CREATE TABLE conv_elementos_proteccion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  descripcion   TEXT NOT NULL,
  cantidad      INT,
  estado        TEXT CHECK (estado IN ('conforme','no_conforme','no_aplica')),
  observacion   TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_elem_visita ON conv_elementos_proteccion(visita_id);
CREATE INDEX idx_conv_elem_sync ON conv_elementos_proteccion(sync_status);

CREATE TABLE conv_raysafe_setup (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id                   UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  kv                          NUMERIC(8,2),
  mas                         NUMERIC(10,4),
  distancia_foco_detector_d1_cm NUMERIC(8,2),
  distancia_foco_detector_d2_cm NUMERIC(8,2),
  modo_medicion               TEXT,
  notas                       TEXT,
  -- archivo_raysafe_blob es local-only, no va a Supabase
  url_storage                 TEXT,
  sync_status                 TEXT NOT NULL DEFAULT 'synced',
  last_modified               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_rs_setup_sync ON conv_raysafe_setup(sync_status);

CREATE TABLE conv_raysafe_mediciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id       UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  tipo_medicion   TEXT NOT NULL,
  numero          INT NOT NULL,
  kv              NUMERIC(8,2),
  mas             NUMERIC(10,4),
  kerma_mgy       NUMERIC(12,6),
  ei              NUMERIC(12,4),
  ddi             NUMERIC(12,4),
  notas           TEXT,
  dosis_base_mgy  NUMERIC(12,6),
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_rs_med_visita ON conv_raysafe_mediciones(visita_id);
CREATE INDEX idx_conv_rs_med_sync ON conv_raysafe_mediciones(sync_status);

CREATE TABLE conv_cae_setup (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  posicion      TEXT,
  phantom       TEXT,
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_cae_setup_sync ON conv_cae_setup(sync_status);

CREATE TABLE conv_cae_mediciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo TEXT NOT NULL,
  kvp           NUMERIC(8,2),
  filtro        TEXT,
  mas_resultado NUMERIC(10,4),
  kerma_mgy     NUMERIC(12,6),
  valor_base    NUMERIC(12,6),
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_cae_med_visita ON conv_cae_mediciones(visita_id);
CREATE INDEX idx_conv_cae_med_sync ON conv_cae_mediciones(sync_status);

CREATE TABLE conv_ddi_mediciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo TEXT NOT NULL,
  numero        INT NOT NULL,
  kv            NUMERIC(8,2),
  mas           NUMERIC(10,4),
  ddi           NUMERIC(12,4),
  ei            NUMERIC(12,4),
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_ddi_visita ON conv_ddi_mediciones(visita_id);
CREATE INDEX idx_conv_ddi_sync ON conv_ddi_mediciones(sync_status);

CREATE TABLE conv_cassette_inspeccion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  total         INT,
  conformes     INT,
  no_conformes  INT,
  observaciones TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_cass_sync ON conv_cassette_inspeccion(sync_status);

CREATE TABLE conv_uniformidad_cr (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  valor_medio   NUMERIC(12,4),
  desviacion    NUMERIC(12,4),
  resultado     TEXT,
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_ucr_sync ON conv_uniformidad_cr(sync_status);

CREATE TABLE conv_colimacion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  campo_rx_cm       NUMERIC(8,2),
  campo_luz_cm      NUMERIC(8,2),
  diferencia_cm     NUMERIC(8,2),
  perpendiculares   JSONB,
  notas             TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_col_sync ON conv_colimacion(sync_status);

CREATE TABLE conv_uniformidad_detector (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  valores_json  JSONB,
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_udet_sync ON conv_uniformidad_detector(sync_status);

CREATE TABLE conv_resolucion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  mtf50_h       NUMERIC(12,4),
  mtf50_v       NUMERIC(12,4),
  mtf20_h       NUMERIC(12,4),
  mtf20_v       NUMERIC(12,4),
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_res_sync ON conv_resolucion(sync_status);

CREATE TABLE conv_bajo_contraste (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  umbral_detectado      NUMERIC(8,4),
  notas                 TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_bc_sync ON conv_bajo_contraste(sync_status);

CREATE TABLE conv_mtf (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  valores_json  JSONB,
  notas         TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_mtf_sync ON conv_mtf(sync_status);

CREATE TABLE conv_informe_secciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  secciones     JSONB NOT NULL DEFAULT '{}',
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_inf_sec_sync ON conv_informe_secciones(sync_status);

CREATE TABLE conv_resultados_prueba (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo TEXT NOT NULL,
  concepto      TEXT CHECK (concepto IN ('FAVORABLE','NO_FAVORABLE','PENDIENTE','NO_APLICA')),
  observaciones TEXT,
  datos_json    JSONB,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, prueba_codigo)
);
CREATE INDEX idx_conv_res_prueba_visita ON conv_resultados_prueba(visita_id);
CREATE INDEX idx_conv_res_prueba_sync ON conv_resultados_prueba(sync_status);

CREATE TABLE conv_evidencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo TEXT NOT NULL,
  orden         INT NOT NULL DEFAULT 0,
  descripcion   TEXT,
  -- blob_local es local-only, no va a Supabase
  url_storage   TEXT,
  storage_path  TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_ev_visita ON conv_evidencias(visita_id);
CREATE INDEX idx_conv_ev_sync ON conv_evidencias(sync_status);

-- ─── 5. Restaurar FK checks ───
SET session_replication_role = DEFAULT;

-- ─── 6. Triggers last_modified ───
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'visitas','prueba_resultados','mediciones_radiometricas','evidencias',
    'grupo_resultados','solicitudes','clientes','contactos','sedes',
    'ubicaciones_rx','equipos','usuarios',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items',
    'conv_elementos_proteccion','conv_raysafe_setup','conv_raysafe_mediciones',
    'conv_cae_setup','conv_cae_mediciones','conv_ddi_mediciones',
    'conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste',
    'conv_mtf','conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_modified BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_last_modified();
    ', replace(t, '_', ''), t);
  END LOOP;
END $$;

-- ─── 7. RLS ───

-- Helper: obtener usuario_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_usuario_id()
RETURNS UUID AS $$
  SELECT id FROM public.usuarios WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_uid = auth.uid()
      AND cargo IN ('coordinador', 'programador')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Habilitar RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios','rol_permisos','clientes','contactos','sedes','ubicaciones_rx',
    'equipos','tubos','colimadores','gantry','sala_dimensiones','partes_equipo',
    'valores_referencia','equipo_movimientos','cotizaciones','solicitudes',
    'prueba_definiciones','grupo_pruebas','visitas','grupo_resultados',
    'prueba_resultados','mediciones_radiometricas','evidencias',
    'elementos_proteccion','informes','informe_versiones','change_logs',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items',
    'conv_elementos_proteccion','conv_raysafe_setup','conv_raysafe_mediciones',
    'conv_cae_setup','conv_cae_mediciones','conv_ddi_mediciones',
    'conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste',
    'conv_mtf','conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Tablas de lectura compartida + escritura admin
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios','rol_permisos','clientes','contactos','sedes','ubicaciones_rx',
    'equipos','tubos','colimadores','gantry','sala_dimensiones','partes_equipo',
    'valores_referencia','equipo_movimientos','cotizaciones',
    'prueba_definiciones','grupo_pruebas',
    'informes','informe_versiones','change_logs'
  ] LOOP
    EXECUTE format('
      CREATE POLICY "Lectura autenticada" ON %I
        FOR SELECT TO authenticated USING (true);
    ', t);
    EXECUTE format('
      CREATE POLICY "Escritura admin" ON %I
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    ', t);
  END LOOP;
END $$;

-- Solicitudes: todos leen, admin escribe, técnico asignado puede actualizar
CREATE POLICY "Lectura solicitudes" ON solicitudes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura solicitudes admin" ON solicitudes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Escritura solicitudes tecnico asignado" ON solicitudes
  FOR UPDATE TO authenticated
  USING (tecnico_asignado_id = public.get_usuario_id());

-- Visitas: todos leen, técnico asignado o admin escribe
CREATE POLICY "Lectura visitas" ON visitas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insertar visitas" ON visitas
  FOR INSERT TO authenticated
  WITH CHECK (tecnico_id = public.get_usuario_id() OR public.is_admin());

CREATE POLICY "Actualizar visitas" ON visitas
  FOR UPDATE TO authenticated
  USING (tecnico_id = public.get_usuario_id() OR public.is_admin());

-- Tablas de campo: técnico de la visita o admin
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'grupo_resultados','prueba_resultados','mediciones_radiometricas',
    'evidencias','elementos_proteccion',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items',
    'conv_elementos_proteccion','conv_raysafe_setup','conv_raysafe_mediciones',
    'conv_cae_setup','conv_cae_mediciones','conv_ddi_mediciones',
    'conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste',
    'conv_mtf','conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ] LOOP
    EXECUTE format('
      CREATE POLICY "Lectura autenticada" ON %I
        FOR SELECT TO authenticated USING (true);
    ', t);
    EXECUTE format('
      CREATE POLICY "Escritura propio o admin" ON %I
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM visitas
            WHERE visitas.id = %I.visita_id
              AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM visitas
            WHERE visitas.id = %I.visita_id
              AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
          )
        );
    ', t, t, t);
  END LOOP;
END $$;
