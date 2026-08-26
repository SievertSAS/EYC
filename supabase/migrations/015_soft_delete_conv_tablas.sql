-- ============================================================
-- Migración 015: soft-delete en tablas conv_* con filas hijas
--
-- Los borrados de mediciones/elementos/evidencias desde los módulos
-- de prueba Convencional eran puramente locales (dexieTable.delete)
-- — nunca se avisaba al motor de sync, así que la fila quedaba
-- huérfana en Supabase para siempre.
--
-- `pullSyncTable` es incremental (solo trae `last_modified >
-- watermark`), así que un DELETE real en Supabase no deja rastro:
-- un segundo dispositivo que ya tenía la fila local nunca se
-- enteraría de la baja. Con `deleted_at`, el borrado viaja como
-- cualquier otro cambio (mismo UPSERT local-first que ya usa el
-- motor) y el pull puede reconocerlo y borrar la copia local.
-- ============================================================

ALTER TABLE conv_mediciones ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conv_elementos_proteccion ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conv_evidencias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conv_cassette_inspeccion ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conv_uniformidad_cr ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conv_uniformidad_detector ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
