-- ============================================================
--  Migración 007: Renombrar estado de pipeline 'ejecutado' → 'ejecucion'
--
--  El estado refleja que el servicio está EN ejecución (visita en
--  curso, pre-informe, revisión), no que ya terminó.
-- ============================================================

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_pipeline_estado_check;

UPDATE solicitudes SET pipeline_estado = 'ejecucion' WHERE pipeline_estado = 'ejecutado';

ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_pipeline_estado_check
  CHECK (pipeline_estado IN ('solicitudes', 'programacion', 'ejecucion', 'notificado', 'enviado'));
