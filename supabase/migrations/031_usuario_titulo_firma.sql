-- ============================================================
--  031 — `usuarios.titulo_firma`
--
--  Necesidad de negocio (#109): el cargo mostrado bajo la firma en
--  "Responsable de generación de documento" debe ser un título libre
--  (ej. "Coordinadora de estudios y controles"), no el `cargo` de
--  permisos (RolUsuario), que solo tiene 4 valores genéricos.
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS titulo_firma text;
