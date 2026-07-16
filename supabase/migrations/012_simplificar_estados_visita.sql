-- ============================================================
-- Migración 012: simplifica el pipeline de visita
-- Quita 'completada' y 'pre_informe', agrega 'enviada'.
-- Mueve visitas legacy en esos dos estados a 'en_progreso' antes de
-- endurecer la restricción, para no dejar filas inválidas.
-- ============================================================

UPDATE visitas
SET estado_visita = 'en_progreso'
WHERE estado_visita IN ('completada', 'pre_informe');

ALTER TABLE visitas DROP CONSTRAINT IF EXISTS visitas_estado_visita_check;

ALTER TABLE visitas
  ADD CONSTRAINT visitas_estado_visita_check
  CHECK (estado_visita IN ('asignada', 'en_progreso', 'en_revision', 'aprobada', 'enviada'));
