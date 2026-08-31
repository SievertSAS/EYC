-- ============================================================
--  023 — `deleted_at` en TODAS las tablas de sync
--
--  Contexto (pasada de prueba E2E): al eliminar un tubo desde Información
--  General, el borrado NO llega a Supabase. `deleteTubo` marca
--  `deleted_at` en Dexie y el push hace un UPSERT que incluye esa columna,
--  pero `tubos` (y `colimadores` / `gantry` / varias más) no la tienen en
--  la base → PGRST204 / 42703 y la fila queda `pending`/`failed`.
--
--  La migración 015 agregó `deleted_at` solo a 6 tablas conv_*. El
--  soft-delete (invariante `SyncFields.deleted_at`) aplica a TODAS las
--  tablas bidireccionales. Esto lo empareja.
--
--  Aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`). Correr en Supabase
--  → SQL Editor.
-- ============================================================

DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
    'tubos','colimadores','gantry','equipo_identificaciones','solicitudes',
    'visitas','grupo_resultados','prueba_resultados','mediciones_radiometricas','evidencias',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items','conv_elementos_proteccion',
    'conv_raysafe_setup','conv_raysafe_mediciones','conv_cae_setup','conv_cae_mediciones',
    'conv_ddi_mediciones','conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
    'conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ];
BEGIN
  FOREACH t IN ARRAY sync_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'tabla % no existe — se omite', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
  END LOOP;
END $$;
