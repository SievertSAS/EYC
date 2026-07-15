-- ============================================================
--  010 — Corrige el desfase de esquema en las tablas conv_*
--
--  Diagnóstico: la migración 009 creó las 19 tablas conv_* como
--  un borrador temprano (columnas genéricas: kv, mas, notas,
--  JSONB agregados). El módulo Convencional real
--  (src/lib/equipos/convencional/db/types.ts) se desarrolló
--  después con un modelo mucho más detallado, pero nunca se
--  escribió una migración que actualizara el esquema remoto.
--  Resultado: prácticamente ninguna columna coincide entre lo
--  que la app envía y lo que Supabase acepta → PGRST204 en cada
--  push, y 4 tablas además tienen UNIQUE(visita_id) cuando la
--  app necesita múltiples filas por visita.
--
--  Como el push nunca funcionó, no hay datos reales que preservar
--  en estas 19 tablas remotas — se reconstruyen desde cero para
--  calcar exactamente los tipos de TypeScript.
--
--  IMPORTANTE: ejecutar manualmente en el SQL Editor de Supabase
--  (igual que las migraciones anteriores — no hay CLI vinculado).
-- ============================================================

BEGIN;

-- ─── 1. Eliminar las 19 tablas conv_* (CASCADE limpia triggers,
--         índices y políticas RLS asociadas automáticamente) ───

DROP TABLE IF EXISTS conv_evidencias CASCADE;
DROP TABLE IF EXISTS conv_resultados_prueba CASCADE;
DROP TABLE IF EXISTS conv_informe_secciones CASCADE;
DROP TABLE IF EXISTS conv_mtf CASCADE;
DROP TABLE IF EXISTS conv_bajo_contraste CASCADE;
DROP TABLE IF EXISTS conv_resolucion CASCADE;
DROP TABLE IF EXISTS conv_uniformidad_detector CASCADE;
DROP TABLE IF EXISTS conv_colimacion CASCADE;
DROP TABLE IF EXISTS conv_uniformidad_cr CASCADE;
DROP TABLE IF EXISTS conv_cassette_inspeccion CASCADE;
DROP TABLE IF EXISTS conv_ddi_mediciones CASCADE;
DROP TABLE IF EXISTS conv_cae_mediciones CASCADE;
DROP TABLE IF EXISTS conv_cae_setup CASCADE;
DROP TABLE IF EXISTS conv_raysafe_mediciones CASCADE;
DROP TABLE IF EXISTS conv_raysafe_setup CASCADE;
DROP TABLE IF EXISTS conv_elementos_proteccion CASCADE;
DROP TABLE IF EXISTS conv_inspeccion_items CASCADE;
DROP TABLE IF EXISTS conv_mediciones CASCADE;
DROP TABLE IF EXISTS conv_levantamiento_setup CASCADE;

-- ─── 2. Recrear cada tabla calcada de db/types.ts ───

-- Prueba 2.1 (setup) — 1 fila por visita
CREATE TABLE conv_levantamiento_setup (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id                  UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  fondo_natural_usv_h        NUMERIC,
  distancia_tubo_operario_m  NUMERIC,
  tecnica_kv                 NUMERIC,
  tecnica_ma                 NUMERIC,
  tecnica_tiempo_s           NUMERIC,
  tecnica_mas                NUMERIC,
  w_estimada                 NUMERIC,
  w_estandar                 NUMERIC,
  factor_uso_u                NUMERIC,
  semanas_laborales          NUMERIC,
  sync_status                TEXT NOT NULL DEFAULT 'synced',
  last_modified              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_levant_setup_sync ON conv_levantamiento_setup(sync_status);

-- Prueba 2.1 (puntos de medición) — N filas por visita
CREATE TABLE conv_mediciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  punto_numero          INT NOT NULL,
  ubicacion_descripcion TEXT NOT NULL,
  tasa_dosis_usv_h      NUMERIC,
  tasa_dosis_msv_h      NUMERIC,
  factor_ocupacion_t    NUMERIC,
  factor_uso_u          NUMERIC,
  carga_trabajo_w       NUMERIC,
  corriente_prueba_i    NUMERIC,
  tipo_area             TEXT CHECK (tipo_area IN ('controlada', 'supervisada')),
  dosis_anual_msv       NUMERIC,
  concepto              TEXT CHECK (concepto IN ('Conforme', 'No_conforme')),
  observacion           TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_med_visita ON conv_mediciones(visita_id);
CREATE INDEX idx_conv_med_sync ON conv_mediciones(sync_status);

-- Prueba 2.2 (checklist inspección) — N filas por visita
CREATE TABLE conv_inspeccion_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  seccion       TEXT NOT NULL CHECK (seccion IN ('equipo', 'condiciones_operacion')),
  item_numero   INT NOT NULL,
  concepto      TEXT CHECK (concepto IN ('Conforme', 'No_conforme', 'No_aplica')),
  observacion   TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_insp_visita ON conv_inspeccion_items(visita_id);
CREATE INDEX idx_conv_insp_seccion ON conv_inspeccion_items(visita_id, seccion);
CREATE INDEX idx_conv_insp_sync ON conv_inspeccion_items(sync_status);

-- Prueba 2.2 (elementos de protección) — N filas por visita
CREATE TABLE conv_elementos_proteccion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  descripcion   TEXT NOT NULL,
  cantidad      INT,
  tipo_paciente TEXT CHECK (tipo_paciente IN ('adulto', 'pediatrico')),
  concepto      TEXT CHECK (concepto IN ('Conforme', 'No_conforme', 'No_aplica')),
  observacion   TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_elem_visita ON conv_elementos_proteccion(visita_id);
CREATE INDEX idx_conv_elem_sync ON conv_elementos_proteccion(sync_status);

-- Grupo B (setup RaySafe) — 1 fila por visita
CREATE TABLE conv_raysafe_setup (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id                      UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  distancia_foco_sensor_cm       NUMERIC,
  distancia_foco_sensor_d1_cm    NUMERIC,
  distancia_foco_detector_d2_cm  NUMERIC,
  -- archivo_raysafe_blob es local-only, no va a Supabase
  archivo_raysafe_nombre         TEXT,
  sync_status                    TEXT NOT NULL DEFAULT 'synced',
  last_modified                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_rs_setup_sync ON conv_raysafe_setup(sync_status);

-- Grupo B (disparos: pruebas 2.4–2.8, 2.21) — N filas por visita
CREATE TABLE conv_raysafe_mediciones (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id                     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  tipo_medicion                 TEXT NOT NULL CHECK (tipo_medicion IN ('principal', 'con_rejilla', 'sin_rejilla', 'kerma')),
  grupo_numero                  INT,
  toma_numero                   INT NOT NULL,
  programa_clinico              TEXT,
  kv_nominal                    NUMERIC,
  ma_nominal                    NUMERIC,
  tiempo_nominal_s              NUMERIC,
  mas_nominal                   NUMERIC,
  kv_medido                     NUMERIC,
  tiempo_medido_s               NUMERIC,
  dosis_medida_mgy              NUMERIC,
  chr_medido_mmal                NUMERIC,
  dap_medido                    NUMERIC,
  dosis_base_mgy                NUMERIC,
  dap_nominal                   NUMERIC,
  ancho_irradiacion_cm          NUMERIC,
  largo_irradiacion_cm          NUMERIC,
  distancia_foco_sensor_cm      NUMERIC,
  distancia_foco_detector_cm    NUMERIC,
  sync_status                   TEXT NOT NULL DEFAULT 'synced',
  last_modified                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_rs_med_visita ON conv_raysafe_mediciones(visita_id);
CREATE INDEX idx_conv_rs_med_tipo ON conv_raysafe_mediciones(visita_id, tipo_medicion);
CREATE INDEX idx_conv_rs_med_sync ON conv_raysafe_mediciones(sync_status);

-- Grupo C (bases CAE: pruebas 2.17, 2.20) — 1 fila por visita
CREATE TABLE conv_cae_setup (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  mas_base_217  NUMERIC,
  ei_base_217   NUMERIC,
  di_base_217   NUMERIC,
  mas_base_60kv NUMERIC,
  ei_base_60kv  NUMERIC,
  di_base_60kv  NUMERIC,
  mas_base_70kv NUMERIC,
  ei_base_70kv  NUMERIC,
  di_base_70kv  NUMERIC,
  mas_base_81kv NUMERIC,
  ei_base_81kv  NUMERIC,
  di_base_81kv  NUMERIC,
  mas_base_cu1  NUMERIC,
  ei_base_cu1   NUMERIC,
  di_base_cu1   NUMERIC,
  mas_base_cu2  NUMERIC,
  ei_base_cu2   NUMERIC,
  di_base_cu2   NUMERIC,
  mas_base_cu3  NUMERIC,
  ei_base_cu3   NUMERIC,
  di_base_cu3   NUMERIC,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_cae_setup_sync ON conv_cae_setup(sync_status);

-- Grupo C (mediciones CAE: pruebas 2.17–2.20) — N filas por visita
CREATE TABLE conv_cae_mediciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id       UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  toma_numero     INT NOT NULL,
  kv_nominal      NUMERIC,
  espesor_cu_mm   NUMERIC,
  posicion_sensor TEXT,
  carga_mas       NUMERIC,
  ei              NUMERIC,
  di              NUMERIC,
  tei             NUMERIC,
  dap             NUMERIC,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_cae_med_visita ON conv_cae_mediciones(visita_id);
CREATE INDEX idx_conv_cae_med_toma ON conv_cae_mediciones(visita_id, toma_numero);
CREATE INDEX idx_conv_cae_med_sync ON conv_cae_mediciones(sync_status);

-- Grupo D (DDI/EI: pruebas 2.9, 2.10) — N filas por visita
CREATE TABLE conv_ddi_mediciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id       UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  grupo           INT NOT NULL,
  toma_numero     INT NOT NULL,
  serie_detector  TEXT,
  kv_nominal      NUMERIC,
  carga_mas       NUMERIC,
  ei              NUMERIC,
  di              NUMERIC,
  tei             NUMERIC,
  ei_base         NUMERIC,
  di_base         NUMERIC,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_ddi_visita ON conv_ddi_mediciones(visita_id);
CREATE INDEX idx_conv_ddi_grupo_toma ON conv_ddi_mediciones(visita_id, grupo, toma_numero);
CREATE INDEX idx_conv_ddi_sync ON conv_ddi_mediciones(sync_status);

-- Prueba 2.14 (cassettes/pantallas IP) — N filas por visita (¡antes 1!)
CREATE TABLE conv_cassette_inspeccion (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  item_numero           INT NOT NULL,
  serie_detector        TEXT,
  integridad_externa    TEXT CHECK (integridad_externa IN ('Conforme', 'No_conforme')),
  estado_interno        TEXT CHECK (estado_interno IN ('Conforme', 'No_conforme')),
  polvo_suciedad        TEXT CHECK (polvo_suciedad IN ('Conforme', 'No_conforme')),
  rayones_defectos      TEXT CHECK (rayones_defectos IN ('Conforme', 'No_conforme')),
  limpieza_realizada    TEXT CHECK (limpieza_realizada IN ('Conforme', 'No_conforme')),
  concepto              TEXT CHECK (concepto IN ('Conforme', 'No_conforme')),
  observacion           TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, item_numero)
);
CREATE INDEX idx_conv_cass_visita ON conv_cassette_inspeccion(visita_id);
CREATE INDEX idx_conv_cass_sync ON conv_cassette_inspeccion(sync_status);

-- Prueba 2.15 (uniformidad IP CR) — N filas por visita (¡antes 1!)
CREATE TABLE conv_uniformidad_cr (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  item_numero   INT NOT NULL,
  serie_cassette TEXT,
  carga_mas     NUMERIC,
  ei            NUMERIC,
  di            NUMERIC,
  tei           NUMERIC,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, item_numero)
);
CREATE INDEX idx_conv_ucr_visita ON conv_uniformidad_cr(visita_id);
CREATE INDEX idx_conv_ucr_sync ON conv_uniformidad_cr(sync_status);

-- Prueba 2.3 (colimación y perpendicularidad) — 1 fila por visita
CREATE TABLE conv_colimacion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  sid_cm            NUMERIC,
  tecnica_kv        NUMERIC,
  tecnica_ma        NUMERIC,
  tecnica_tiempo_s  NUMERIC,
  tecnica_mas       NUMERIC,
  anodo_nominal     NUMERIC,
  anodo_medido      NUMERIC,
  catodo_nominal    NUMERIC,
  catodo_medido     NUMERIC,
  izquierda_nominal NUMERIC,
  izquierda_medido  NUMERIC,
  derecha_nominal   NUMERIC,
  derecha_medido    NUMERIC,
  posicion_esfera   TEXT CHECK (posicion_esfera IN ('Centro', 'Primer circulo', 'Segundo circulo', 'Fuera del circulo externo')),
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_col_sync ON conv_colimacion(sync_status);

-- Prueba 2.11 (uniformidad y artefactos del detector) — N filas por visita (¡antes 1!)
CREATE TABLE conv_uniformidad_detector (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id              UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  item_numero            INT NOT NULL,
  serie_detector         TEXT,
  roi_0_vmp_ac           NUMERIC,
  roi_1_vmp_ac           NUMERIC,
  roi_2_vmp_ac           NUMERIC,
  roi_3_vmp_ac           NUMERIC,
  roi_4_vmp_ac           NUMERIC,
  roi_0_desv_ac          NUMERIC,
  roi_1_desv_ac          NUMERIC,
  roi_2_desv_ac          NUMERIC,
  roi_3_desv_ac          NUMERIC,
  roi_4_desv_ac          NUMERIC,
  roi_0_vmp_ca           NUMERIC,
  roi_1_vmp_ca           NUMERIC,
  roi_2_vmp_ca           NUMERIC,
  roi_3_vmp_ca           NUMERIC,
  roi_4_vmp_ca           NUMERIC,
  roi_0_desv_ca          NUMERIC,
  roi_1_desv_ca          NUMERIC,
  roi_2_desv_ca          NUMERIC,
  roi_3_desv_ca          NUMERIC,
  roi_4_desv_ca          NUMERIC,
  tolerancia_pct         NUMERIC,
  pixeles_defectuosos    BOOLEAN,
  artefactos             BOOLEAN,
  artefactos_descripcion TEXT,
  sync_status            TEXT NOT NULL DEFAULT 'synced',
  last_modified          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, item_numero)
);
CREATE INDEX idx_conv_udet_visita ON conv_uniformidad_detector(visita_id);
CREATE INDEX idx_conv_udet_sync ON conv_uniformidad_detector(sync_status);

-- Prueba 2.12 (resolución espacial) — 1 fila por visita
CREATE TABLE conv_resolucion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  sid_cm            NUMERIC,
  tecnica_kv        NUMERIC,
  tecnica_ma        NUMERIC,
  tecnica_tiempo_s  NUMERIC,
  tecnica_mas       NUMERIC,
  pares_lineas_plmm NUMERIC,
  concepto          TEXT CHECK (concepto IN ('Conforme', 'No_conforme')),
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_res_sync ON conv_resolucion(sync_status);

-- Prueba 2.13 (bajo contraste) — 1 fila por visita
CREATE TABLE conv_bajo_contraste (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id         UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  sid_cm            NUMERIC,
  tecnica_kv        NUMERIC,
  tecnica_ma        NUMERIC,
  tecnica_tiempo_s  NUMERIC,
  tecnica_mas       NUMERIC,
  contraste_9_4     BOOLEAN,
  contraste_8_0     BOOLEAN,
  contraste_5_6     BOOLEAN,
  contraste_4_0     BOOLEAN,
  contraste_2_8     BOOLEAN,
  contraste_1_8     BOOLEAN,
  contraste_1_3     BOOLEAN,
  contraste_0_9     BOOLEAN,
  concepto          TEXT CHECK (concepto IN ('Conforme', 'No_conforme')),
  sync_status       TEXT NOT NULL DEFAULT 'synced',
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_bc_sync ON conv_bajo_contraste(sync_status);

-- Prueba 2.16 (MTF) — 1 fila por visita
CREATE TABLE conv_mtf (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id                UUID NOT NULL UNIQUE REFERENCES visitas(id) ON DELETE CASCADE,
  distancia_foco_sensor_cm NUMERIC,
  tecnica_kv               NUMERIC,
  tecnica_ma               NUMERIC,
  tecnica_tiempo_s         NUMERIC,
  tecnica_mas              NUMERIC,
  pixel_size_mm            NUMERIC,
  nyquist_lpmm             NUMERIC,
  mtf50_horizontal         NUMERIC,
  mtf20_horizontal         NUMERIC,
  mtf50_vertical           NUMERIC,
  mtf20_vertical           NUMERIC,
  mtf50_base_horizontal    NUMERIC,
  mtf20_base_horizontal    NUMERIC,
  mtf50_base_vertical      NUMERIC,
  mtf20_base_vertical      NUMERIC,
  concepto                 TEXT CHECK (concepto IN ('Conforme', 'No_conforme')),
  sync_status              TEXT NOT NULL DEFAULT 'synced',
  last_modified            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_mtf_sync ON conv_mtf(sync_status);

-- Editor de pre-informe: 1 fila por prueba (2.1..2.21) por visita (¡antes 1 por visita!)
CREATE TABLE conv_informe_secciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id             UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo         TEXT NOT NULL,
  orden                 INT NOT NULL,
  incluida              BOOLEAN NOT NULL DEFAULT TRUE,
  concepto              TEXT CHECK (concepto IN ('Conforme', 'No_conforme', 'No_aplica')),
  acciones_correctivas  TEXT,
  observaciones         TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_modified         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, prueba_codigo)
);
CREATE INDEX idx_conv_inf_sec_visita ON conv_informe_secciones(visita_id);
CREATE INDEX idx_conv_inf_sec_sync ON conv_informe_secciones(sync_status);

-- Resultado calculado por prueba — 1 fila por prueba por visita (cardinalidad ya era correcta)
CREATE TABLE conv_resultados_prueba (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id            UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo        TEXT NOT NULL,
  resultado_principal  NUMERIC,
  resultado_secundario NUMERIC,
  datos_calculados     JSONB,
  concepto             TEXT CHECK (concepto IN ('Conforme', 'No_conforme', 'No_aplica')),
  acciones_correctivas TEXT,
  completado           BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_ejecucion      DATE,
  sync_status          TEXT NOT NULL DEFAULT 'synced',
  last_modified        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visita_id, prueba_codigo)
);
CREATE INDEX idx_conv_res_prueba_visita ON conv_resultados_prueba(visita_id);
CREATE INDEX idx_conv_res_prueba_sync ON conv_resultados_prueba(sync_status);

-- Evidencias fotográficas por prueba/slot — N filas por visita
CREATE TABLE conv_evidencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id     UUID NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  prueba_codigo TEXT NOT NULL,
  slot          TEXT NOT NULL,
  descripcion   TEXT,
  -- blob_local es local-only, no va a Supabase
  url_storage   TEXT,
  fecha_captura TIMESTAMPTZ,
  sync_status   TEXT NOT NULL DEFAULT 'synced',
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conv_ev_visita ON conv_evidencias(visita_id);
CREATE INDEX idx_conv_ev_prueba ON conv_evidencias(visita_id, prueba_codigo);
CREATE INDEX idx_conv_ev_sync ON conv_evidencias(sync_status);

-- ─── 3. Trigger de last_modified (mismo patrón que 009) ───

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
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

-- ─── 4. RLS (mismo patrón que 009: lectura autenticada,
--         escritura del técnico asignado a la visita o admin) ───

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items',
    'conv_elementos_proteccion','conv_raysafe_setup','conv_raysafe_mediciones',
    'conv_cae_setup','conv_cae_mediciones','conv_ddi_mediciones',
    'conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste',
    'conv_mtf','conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
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

-- ─── 5. Refrescar el schema cache de PostgREST ───
NOTIFY pgrst, 'reload schema';

COMMIT;
