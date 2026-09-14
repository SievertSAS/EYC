-- ============================================================
--  030 — `usuarios.firma_url`
--
--  Necesidad de negocio (#109): la fila "Responsable de generación de
--  documento" del informe debe tomar automáticamente la firma del usuario
--  que genera/publica el informe, sin gestión manual por visita.
--
--  Guarda el PATH dentro del bucket `evidencias` (no una URL), misma
--  convención que `url_storage` en las evidencias fotográficas — ver
--  src/lib/supabase/storage.ts.
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS firma_url text;
