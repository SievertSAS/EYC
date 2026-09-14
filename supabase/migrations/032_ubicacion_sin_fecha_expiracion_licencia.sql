-- ============================================================
--  032 — `ubicaciones_rx.sin_fecha_expiracion_licencia`
--
--  Necesidad de negocio (#104): el toggle "Sin fecha de expiración" en
--  captura debe persistir la intención explícita del usuario, distinta de
--  un campo simplemente vacío por no diligenciar.
-- ============================================================

ALTER TABLE public.ubicaciones_rx
  ADD COLUMN IF NOT EXISTS sin_fecha_expiracion_licencia boolean NOT NULL DEFAULT false;
