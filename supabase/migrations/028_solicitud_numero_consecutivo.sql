-- ============================================================
--  028 — Consecutivo legible de solicitudes
--
--  `numero_solicitud` (SOL-{año}-{NNN}) para identificar la solicitud a
--  simple vista. El `id` (uuid) sigue siendo la clave real. Se asigna en
--  el cliente al crear (mismo criterio que `numero_informe`).
--
--  Aditiva. El backfill numera las solicitudes existentes por año según
--  `creado_en`. Sin constraint de unicidad — offline puede generar
--  duplicados y no queremos rechazar syncs por eso.
-- ============================================================

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS numero_solicitud text;

WITH numeradas AS (
  SELECT
    id,
    'SOL-' || to_char(creado_en, 'YYYY') || '-' ||
    lpad(
      (row_number() OVER (
        PARTITION BY to_char(creado_en, 'YYYY')
        ORDER BY creado_en, id
      ))::text,
      3, '0'
    ) AS num
  FROM public.solicitudes
)
UPDATE public.solicitudes s
SET numero_solicitud = n.num
FROM numeradas n
WHERE s.id = n.id
  AND s.numero_solicitud IS NULL;
