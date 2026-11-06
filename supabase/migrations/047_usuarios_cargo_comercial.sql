-- ============================================================
--  047 — `usuarios.cargo` admite 'comercial' (#205)
--
--  La 004 definió el CHECK con ('coordinador','programador','tecnico',
--  'comercial'), pero la 009 recreó `usuarios` con un CHECK sin
--  'comercial' (y con los cargos legacy 'fisico_tecnico', 'ingeniero',
--  'tecnologo'). Resultado: crear un usuario comercial desde la app
--  (/api/usuarios, que sí lo acepta) fallaba en el INSERT.
--
--  El CHECK queda alineado con los roles de la app (RolUsuario /
--  CARGOS_VALIDOS). Verificado en producción (2026-11-06): solo existen
--  filas con cargo coordinador, programador y tecnico, así que ninguna
--  fila viola el CHECK nuevo. Si en otro entorno quedara un cargo legacy,
--  el ADD CONSTRAINT falla y la migración no aplica nada (transacción).
-- ============================================================

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_cargo_check
  CHECK (cargo IN ('coordinador', 'programador', 'tecnico', 'comercial'));
