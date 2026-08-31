-- ============================================================
--  026 — Reprogramación de visitas (#64)
--
--  Un programador / coordinador puede cambiar la fecha y el técnico de una
--  visita que todavía está en estado `asignada` (no iniciada). Se guarda
--  traza: cuándo, quién y por qué. La fecha/técnico se propagan a la
--  solicitud padre (`fecha_estimada_visita` / `tecnico_asignado_id`).
--
--  Aditiva e idempotente.
-- ============================================================

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS reprogramada_en timestamptz,
  ADD COLUMN IF NOT EXISTS reprogramada_por_id uuid,
  ADD COLUMN IF NOT EXISTS reprogramacion_motivo text;
