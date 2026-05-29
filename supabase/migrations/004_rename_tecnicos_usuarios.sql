-- ============================================================
--  Migración 004: Renombrar tecnicos → usuarios
--  + Crear tabla rol_permisos
--  + Actualizar funciones helper y políticas RLS
--
--  Ejecutar en SQL Editor → Run
-- ============================================================

-- ─── 1. Renombrar tabla ───
ALTER TABLE tecnicos RENAME TO usuarios;

-- ─── 2. Actualizar constraint de cargo ───
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS tecnicos_cargo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_check
  CHECK (cargo IN ('coordinador', 'programador', 'tecnico', 'comercial'));

-- Migrar cargos antiguos a los nuevos
UPDATE usuarios SET cargo = 'tecnico' WHERE cargo IN ('fisico_tecnico', 'ingeniero', 'tecnologo');

-- ─── 3. Crear tabla rol_permisos ───
CREATE TABLE IF NOT EXISTS rol_permisos (
  id BIGSERIAL PRIMARY KEY,
  rol TEXT NOT NULL CHECK (rol IN ('coordinador', 'programador', 'tecnico', 'comercial')),
  modulo TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  modificado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rol, modulo)
);

ALTER TABLE rol_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura autenticada" ON rol_permisos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura admin" ON rol_permisos
  FOR ALL TO authenticated USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 4. Actualizar funciones helper ───
CREATE OR REPLACE FUNCTION public.get_tecnico_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.usuarios WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_usuario_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.usuarios WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_uid = auth.uid()
      AND cargo IN ('coordinador', 'programador')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── 5. Seed permisos por defecto ───
INSERT INTO rol_permisos (rol, modulo, activo) VALUES
  -- Coordinador: todo
  ('coordinador', 'dashboard', true),
  ('coordinador', 'clientes', true),
  ('coordinador', 'solicitudes', true),
  ('coordinador', 'visitas', true),
  ('coordinador', 'revision', true),
  ('coordinador', 'equipos', true),
  ('coordinador', 'informes', true),
  ('coordinador', 'sync', true),
  ('coordinador', 'configuracion', true),
  -- Programador: todo menos configuración
  ('programador', 'dashboard', true),
  ('programador', 'clientes', true),
  ('programador', 'solicitudes', true),
  ('programador', 'visitas', true),
  ('programador', 'revision', true),
  ('programador', 'equipos', true),
  ('programador', 'informes', true),
  ('programador', 'sync', true),
  ('programador', 'configuracion', false),
  -- Técnico
  ('tecnico', 'dashboard', true),
  ('tecnico', 'clientes', false),
  ('tecnico', 'solicitudes', false),
  ('tecnico', 'visitas', true),
  ('tecnico', 'revision', true),
  ('tecnico', 'equipos', true),
  ('tecnico', 'informes', true),
  ('tecnico', 'sync', true),
  ('tecnico', 'configuracion', false),
  -- Comercial
  ('comercial', 'dashboard', true),
  ('comercial', 'clientes', true),
  ('comercial', 'solicitudes', true),
  ('comercial', 'visitas', false),
  ('comercial', 'revision', false),
  ('comercial', 'equipos', false),
  ('comercial', 'informes', false),
  ('comercial', 'sync', false),
  ('comercial', 'configuracion', false)
ON CONFLICT (rol, modulo) DO NOTHING;
