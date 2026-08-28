-- ============================================================
--  016 — Trigger last_modified en TODAS las tablas de sync
--
--  Contexto (hallazgo #5 de la intervención):
--  El cliente quita `last_modified` antes de pushear (LOCAL_ONLY_FIELDS
--  en sync-engine.ts). Del lado Supabase, la columna tiene DEFAULT NOW()
--  (cubre el INSERT) pero el trigger BEFORE UPDATE que reasigna NOW()
--  existía solo en 5 tablas (visitas, prueba_resultados,
--  mediciones_radiometricas, evidencias, grupo_resultados).
--
--  Consecuencia: en las ~30 tablas restantes, un UPDATE (vía UPSERT
--  ON CONFLICT) NO avanzaba `last_modified` → el pull incremental de
--  otro dispositivo (`.gt(last_modified, watermark)`) nunca volvía a
--  traer esa fila editada. Los edits de clientes/equipos/conv_* no
--  propagaban entre dispositivos.
--
--  Esta migración crea el trigger BEFORE INSERT OR UPDATE en cada tabla
--  de sync que tenga la columna `last_modified`. Idempotente
--  (DROP TRIGGER IF EXISTS). Correr en Supabase → SQL Editor.
-- ============================================================

-- La función ya existe (001), pero la re-declaramos por si esta
-- migración corre sobre una base parcial.
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
    'tubos','colimadores','gantry','solicitudes',
    'visitas','grupo_resultados','prueba_resultados','mediciones_radiometricas','evidencias',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items','conv_elementos_proteccion',
    'conv_raysafe_setup','conv_raysafe_mediciones','conv_cae_setup','conv_cae_mediciones',
    'conv_ddi_mediciones','conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
    'conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ];
BEGIN
  FOREACH t IN ARRAY sync_tables LOOP
    -- Solo si la tabla existe y tiene la columna last_modified.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'last_modified'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_modified ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%I_modified BEFORE INSERT OR UPDATE ON public.%I '
        || 'FOR EACH ROW EXECUTE FUNCTION update_last_modified()', t, t);
      RAISE NOTICE 'trigger last_modified creado en %', t;
    ELSE
      RAISE NOTICE 'SALTADA: % no existe o no tiene columna last_modified', t;
    END IF;
  END LOOP;
END $$;
