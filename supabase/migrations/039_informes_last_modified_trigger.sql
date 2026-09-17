-- ============================================================
--  039 — Trigger last_modified en informes/informe_versiones (#154)
--
--  Contexto: estas dos tablas ya tenían columnas sync_status/
--  last_modified (migración 009, con DEFAULT NOW() cubriendo el
--  INSERT) pero el cliente las trataba como MASTER_TABLES (solo
--  pull) — nunca las subía. Al convertirlas en tablas de sync
--  bidireccional (ver sync-engine.ts SYNC_TABLES), igual que el
--  resto de tablas de sync (migración 016), necesitan el trigger
--  BEFORE UPDATE que reasigna NOW() a last_modified: sin él, un
--  UPDATE (vía UPSERT ON CONFLICT) no avanza el watermark y el pull
--  incremental de otro dispositivo nunca vuelve a traer la fila.
--
--  Idempotente (reutiliza update_last_modified() de la 016).
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['informes', 'informe_versiones'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
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
