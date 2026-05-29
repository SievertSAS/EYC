-- ============================================================
--  Sievert EyC — Schema inicial PostgreSQL
--  Migración 001: todas las tablas del dominio
--
--  Ejecutar en Supabase SQL Editor o via CLI:
--    npx supabase db push
-- ============================================================

-- ─── Extensiones ───
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Datos maestros ───

CREATE TABLE clientes (
  id            BIGSERIAL PRIMARY KEY,
  nombre_cliente TEXT NOT NULL,
  nombre_prestador TEXT,
  nit           TEXT NOT NULL,
  digito_verificacion TEXT,
  naturaleza    TEXT CHECK (naturaleza IN ('privado', 'publico', 'mixto')),
  direccion     TEXT,
  telefono      TEXT,
  email         TEXT,
  nombre_representante_legal TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clientes_nit ON clientes(nit);

CREATE TABLE contactos (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  cargo         TEXT CHECK (cargo IN ('medico_responsable','tecnologo','opr','representante','otro')),
  cedula        TEXT,
  telefono      TEXT,
  email         TEXT,
  para_programar BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contactos_cliente ON contactos(cliente_id);

CREATE TABLE sedes (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre_sede   TEXT NOT NULL,
  direccion_sede TEXT,
  ciudad        TEXT,
  departamento  TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sedes_cliente ON sedes(cliente_id);

CREATE TABLE ubicaciones_rx (
  id                BIGSERIAL PRIMARY KEY,
  sede_id           BIGINT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  nombre_servicio   TEXT NOT NULL,
  licencia          TEXT,
  fecha_expiracion_licencia DATE,
  codigo_habilitacion TEXT,
  horas_x_dia       NUMERIC(4,1),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ubicaciones_sede ON ubicaciones_rx(sede_id);

CREATE TABLE equipos (
  id                    BIGSERIAL PRIMARY KEY,
  ubicacion_id          BIGINT NOT NULL REFERENCES ubicaciones_rx(id) ON DELETE CASCADE,
  tipo_equipo           TEXT,
  planilla_espacial     BOOLEAN NOT NULL DEFAULT FALSE,
  sistema_adquisicion   TEXT,
  distancia_foco_paciente NUMERIC(6,1),
  bucky                 TEXT CHECK (bucky IN ('Si','No','No_aplica')),
  gen_marca             TEXT,
  gen_modelo            TEXT,
  gen_numero_serie      TEXT,
  gen_fecha_fabricacion DATE,
  gen_fase              TEXT CHECK (gen_fase IN ('monofasico','trifasico','alta_frecuencia')),
  gen_energia_fotones_mev TEXT,
  filtracion_inherente_mmal NUMERIC(6,2),
  filtracion_anadida_mmal   NUMERIC(6,2),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipos_ubicacion ON equipos(ubicacion_id);
CREATE INDEX idx_equipos_tipo ON equipos(tipo_equipo);

CREATE TABLE tubos (
  id              BIGSERIAL PRIMARY KEY,
  equipo_id       BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
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
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tubos_equipo ON tubos(equipo_id);

CREATE TABLE colimadores (
  id              BIGSERIAL PRIMARY KEY,
  equipo_id       BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gantry (
  id              BIGSERIAL PRIMARY KEY,
  equipo_id       BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca           TEXT,
  modelo          TEXT,
  numero_serie    TEXT,
  tipo_detector   TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sala_dimensiones (
  id              BIGSERIAL PRIMARY KEY,
  ubicacion_id    BIGINT NOT NULL REFERENCES ubicaciones_rx(id) ON DELETE CASCADE,
  ancho_m         NUMERIC(6,2),
  largo_m         NUMERIC(6,2),
  alto_m          NUMERIC(6,2),
  area_m2         NUMERIC(8,2),
  zona_a_desc     TEXT,
  zona_b_desc     TEXT,
  zona_c_desc     TEXT,
  zona_d_desc     TEXT,
  plano_url       TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE partes_equipo (
  id              BIGSERIAL PRIMARY KEY,
  equipo_id       BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  parte_nombre    TEXT NOT NULL,
  estado          TEXT CHECK (estado IN ('bueno','regular','malo','no_aplica')),
  observacion     TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE valores_referencia (
  id              BIGSERIAL PRIMARY KEY,
  equipo_id       BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  kerma_aire_incidente    NUMERIC(12,4),
  pkl_panoramico          NUMERIC(12,4),
  pkl_ct_dental           NUMERIC(12,4),
  pka_ref                 NUMERIC(12,4),
  ddi_ref                 NUMERIC(12,4),
  ei_ref                  NUMERIC(12,4),
  mtf50_h_ref             NUMERIC(12,4),
  mtf50_v_ref             NUMERIC(12,4),
  mtf20_h_ref             NUMERIC(12,4),
  mtf20_v_ref             NUMERIC(12,4),
  cae_sensibilidad_ref    NUMERIC(12,4),
  cae_comp_60kvp          NUMERIC(12,4),
  cae_comp_70kvp          NUMERIC(12,4),
  cae_comp_80kvp          NUMERIC(12,4),
  cae_comp_1mm_cu         NUMERIC(12,4),
  cae_comp_2mm_cu         NUMERIC(12,4),
  cae_comp_3mm_cu         NUMERIC(12,4),
  rendimiento_ref         NUMERIC(12,4),
  rendimiento_repetibilidad NUMERIC(12,4),
  rendimiento_linealidad  NUMERIC(12,4),
  dosis_receptor_extremidad NUMERIC(12,4),
  dosis_receptor_torax    NUMERIC(12,4),
  dosis_receptor_columna  NUMERIC(12,4),
  dosis_receptor_abdomen  NUMERIC(12,4),
  bajo_contraste_ref      NUMERIC(12,4),
  valor_base_patron       TEXT,
  chr_min_mmal            NUMERIC(12,4),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipo_movimientos (
  id                    BIGSERIAL PRIMARY KEY,
  equipo_id             BIGINT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  ubicacion_anterior_id BIGINT REFERENCES ubicaciones_rx(id),
  ubicacion_nueva_id    BIGINT NOT NULL REFERENCES ubicaciones_rx(id),
  fecha_movimiento      DATE NOT NULL,
  motivo                TEXT,
  registrado_por_id     BIGINT,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Técnicos / Usuarios ───

CREATE TABLE tecnicos (
  id            BIGSERIAL PRIMARY KEY,
  auth_uid      UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  cedula        TEXT NOT NULL UNIQUE,
  cargo         TEXT CHECK (cargo IN ('fisico_tecnico','ingeniero','tecnologo','coordinador','programador')),
  email         TEXT,
  telefono      TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tecnicos_auth ON tecnicos(auth_uid);
CREATE INDEX idx_tecnicos_cedula ON tecnicos(cedula);

-- ─── Comercial ───

CREATE TABLE cotizaciones (
  id                BIGSERIAL PRIMARY KEY,
  cliente_id        BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  valor_total       NUMERIC(14,2),
  forma_pago        TEXT,
  fecha_cotizacion  DATE,
  fecha_aceptacion  DATE,
  estado            TEXT CHECK (estado IN ('borrador','enviada','aceptada','rechazada')) DEFAULT 'borrador',
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE solicitudes (
  id                    BIGSERIAL PRIMARY KEY,
  cotizacion_id         BIGINT REFERENCES cotizaciones(id) ON DELETE SET NULL,
  cliente_id            BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contacto_programar_id BIGINT REFERENCES contactos(id) ON DELETE SET NULL,
  ubicacion_id          BIGINT REFERENCES ubicaciones_rx(id) ON DELETE SET NULL,
  tecnico_asignado_id   BIGINT REFERENCES tecnicos(id) ON DELETE SET NULL,
  tipo_servicio         TEXT,
  pipeline_estado       TEXT NOT NULL DEFAULT 'solicitudes'
                        CHECK (pipeline_estado IN ('solicitudes','programacion','ejecutado','notificado','enviado')),
  forma_pago            TEXT,
  pago_recibido         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_solicitud       DATE,
  fecha_estimada_visita DATE,
  fecha_real_visita     DATE,
  fecha_entrega         DATE,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_solicitudes_cliente ON solicitudes(cliente_id);
CREATE INDEX idx_solicitudes_pipeline ON solicitudes(pipeline_estado);
CREATE INDEX idx_solicitudes_tecnico ON solicitudes(tecnico_asignado_id);

-- ─── Prueba definiciones (catálogo) ───

CREATE TABLE prueba_definiciones (
  id                      BIGSERIAL PRIMARY KEY,
  codigo                  TEXT NOT NULL UNIQUE,
  nombre                  TEXT NOT NULL,
  descripcion             TEXT,
  tipos_equipo_aplicables TEXT[] NOT NULL DEFAULT '{}',
  orden_sugerido          INT,
  plantilla_informe       TEXT,
  activa                  BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Ejecución en campo ───

CREATE TABLE visitas (
  id                      BIGSERIAL PRIMARY KEY,
  solicitud_id            BIGINT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  equipo_id               BIGINT REFERENCES equipos(id),
  ubicacion_id            BIGINT REFERENCES ubicaciones_rx(id),
  tecnico_id              BIGINT REFERENCES tecnicos(id),
  estado_visita           TEXT NOT NULL DEFAULT 'asignada'
                          CHECK (estado_visita IN ('asignada','en_progreso','completada','pre_informe','en_revision','aprobada')),
  ingeniero_revisor_id    BIGINT REFERENCES tecnicos(id),
  -- Condiciones de operación
  dias_laborados_semana   INT,
  pacientes_por_semana    INT,
  radiografias_por_semana INT,
  kv_maximo_usado         NUMERIC(8,2),
  mas_maximo_usado        NUMERIC(8,2),
  max_disparos_paciente   INT,
  porcentaje_rechazo      NUMERIC(5,2),
  -- Condiciones ambientales
  temperatura_c           NUMERIC(6,2),
  presion_hpa             NUMERIC(8,2),
  observaciones           TEXT,
  observaciones_revision  TEXT,
  devuelto_en             TIMESTAMPTZ,
  fecha_visita            DATE,
  last_modified           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_visitas_solicitud ON visitas(solicitud_id);
CREATE INDEX idx_visitas_tecnico ON visitas(tecnico_id);
CREATE INDEX idx_visitas_estado ON visitas(estado_visita);
CREATE INDEX idx_visitas_equipo ON visitas(equipo_id);

CREATE TABLE prueba_resultados (
  id                    BIGSERIAL PRIMARY KEY,
  visita_id             BIGINT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_definicion_id  BIGINT NOT NULL REFERENCES prueba_definiciones(id),
  equipo_id             BIGINT NOT NULL REFERENCES equipos(id),
  concepto              TEXT CHECK (concepto IN ('FAVORABLE','NO_FAVORABLE','NO_APLICA')),
  acciones_correctivas  TEXT,
  datos_json            JSONB,
  completado            BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_ejecucion       DATE,
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prueba_res_visita ON prueba_resultados(visita_id);
CREATE INDEX idx_prueba_res_definicion ON prueba_resultados(prueba_definicion_id);

CREATE TABLE mediciones_radiometricas (
  id                    BIGSERIAL PRIMARY KEY,
  visita_id             BIGINT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  punto_numero          INT NOT NULL,
  ubicacion_descripcion TEXT NOT NULL,
  tasa_dosis_msv_h      NUMERIC(12,6),
  factor_ocupacion      TEXT,
  tipo_area             TEXT CHECK (tipo_area IN ('controlada','supervisada')),
  dosis_anual_msv       NUMERIC(12,6),
  concepto              TEXT CHECK (concepto IN ('Conforme','No_conforme')),
  observacion           TEXT,
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mediciones_visita ON mediciones_radiometricas(visita_id);

CREATE TABLE evidencias (
  id                    BIGSERIAL PRIMARY KEY,
  visita_id             BIGINT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_resultado_id   BIGINT REFERENCES prueba_resultados(id) ON DELETE SET NULL,
  tipo                  TEXT,
  descripcion           TEXT,
  storage_path          TEXT,
  url_storage           TEXT,
  fecha_captura         TIMESTAMPTZ,
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evidencias_visita ON evidencias(visita_id);

CREATE TABLE elementos_proteccion (
  id            BIGSERIAL PRIMARY KEY,
  visita_id     BIGINT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  descripcion   TEXT NOT NULL,
  cantidad      INT,
  concepto      TEXT CHECK (concepto IN ('Conforme','No_conforme')),
  observacion   TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Informes ───

CREATE TABLE informes (
  id                BIGSERIAL PRIMARY KEY,
  visita_id         BIGINT NOT NULL REFERENCES visitas(id),
  equipo_id         BIGINT NOT NULL REFERENCES equipos(id),
  ubicacion_id      BIGINT NOT NULL REFERENCES ubicaciones_rx(id),
  numero_informe    TEXT NOT NULL,
  plantilla         TEXT,
  titulo            TEXT,
  version_actual    INT NOT NULL DEFAULT 1,
  concepto_general  TEXT CHECK (concepto_general IN ('FAVORABLE','NO_FAVORABLE')),
  qr_token          UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  qr_url            TEXT,
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','pre_informe','en_revision','correccion_fisica','correccion_cliente','aprobado','vigente','vencido')),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_informes_visita ON informes(visita_id);
CREATE INDEX idx_informes_numero ON informes(numero_informe);
CREATE INDEX idx_informes_estado ON informes(estado);
CREATE INDEX idx_informes_vencimiento ON informes(fecha_vencimiento);

CREATE TABLE informe_versiones (
  id                  BIGSERIAL PRIMARY KEY,
  informe_id          BIGINT NOT NULL REFERENCES informes(id) ON DELETE CASCADE,
  numero_version      INT NOT NULL,
  motivo_cambio       TEXT CHECK (motivo_cambio IN ('emision_inicial','correccion_fisico','correccion_cliente','actualizacion')),
  descripcion_cambio  TEXT,
  generado_por_id     BIGINT REFERENCES tecnicos(id),
  revisado_por_id     BIGINT REFERENCES tecnicos(id),
  pdf_url             TEXT,
  fecha_generacion    TIMESTAMPTZ NOT NULL,
  fecha_revision      TIMESTAMPTZ,
  fecha_aprobacion    TIMESTAMPTZ,
  estado              TEXT CHECK (estado IN ('borrador','en_revision','aprobado','reemplazado')),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auditoría ───

CREATE TABLE change_logs (
  id                BIGSERIAL PRIMARY KEY,
  tabla             TEXT NOT NULL,
  registro_id       BIGINT NOT NULL,
  campo             TEXT NOT NULL,
  valor_anterior    TEXT,
  valor_nuevo       TEXT,
  modificado_por_id BIGINT NOT NULL REFERENCES tecnicos(id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_changelog_tabla ON change_logs(tabla, registro_id);
CREATE INDEX idx_changelog_fecha ON change_logs(fecha);

-- ─── Trigger para auto-actualizar last_modified ───

CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visitas_modified BEFORE UPDATE ON visitas
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER trg_prueba_res_modified BEFORE UPDATE ON prueba_resultados
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER trg_mediciones_modified BEFORE UPDATE ON mediciones_radiometricas
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER trg_evidencias_modified BEFORE UPDATE ON evidencias
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();
