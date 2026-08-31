-- ============================================================
--  027 — Cancelar solicitud (#64)
--
--  Nuevo valor `cancelada` en `pipeline_estado` + traza de la cancelación.
--  Regla de negocio (en el cliente, `cancelarSolicitud`): se bloquea si hay
--  visitas ya iniciadas; si solo hay visitas `asignada`, se hace soft-delete
--  de esas visitas en cascada.
--
--  Aditiva e idempotente.
-- ============================================================

ALTER TABLE public.solicitudes
  DROP CONSTRAINT IF EXISTS solicitudes_pipeline_estado_check;

ALTER TABLE public.solicitudes
  ADD CONSTRAINT solicitudes_pipeline_estado_check
  CHECK (
    pipeline_estado IN (
      'solicitudes', 'programacion', 'ejecucion', 'notificado', 'enviado', 'cancelada'
    )
  );

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS cancelada_motivo text,
  ADD COLUMN IF NOT EXISTS cancelada_por_id uuid,
  ADD COLUMN IF NOT EXISTS cancelada_en timestamptz;
