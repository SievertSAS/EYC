-- ============================================================
--  Migración 002: Row Level Security (RLS)
--
--  Políticas:
--    - Usuarios autenticados pueden leer todo (datos compartidos)
--    - Técnicos solo pueden ESCRIBIR en visitas/pruebas que
--      les están asignadas
--    - Admin (coordinador/programador) puede escribir en todo
-- ============================================================

-- Helper: obtener el tecnico_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_tecnico_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.tecnicos WHERE auth_uid = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tecnicos
    WHERE auth_uid = auth.uid()
      AND cargo IN ('coordinador', 'programador')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Habilitar RLS en todas las tablas ───
ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones_rx        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tubos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE colimadores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantry                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_dimensiones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE partes_equipo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE valores_referencia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tecnicos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prueba_definiciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE prueba_resultados     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediciones_radiometricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE elementos_proteccion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE informe_versiones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_movimientos    ENABLE ROW LEVEL SECURITY;

-- ─── Datos maestros: lectura para todos, escritura para admin ───

-- Macro para tablas de lectura compartida
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos',
    'tubos','colimadores','gantry','sala_dimensiones','partes_equipo',
    'valores_referencia','tecnicos','cotizaciones','prueba_definiciones',
    'equipo_movimientos','informes','informe_versiones','change_logs'
  ] LOOP
    EXECUTE format('
      CREATE POLICY "Lectura autenticada" ON %I
        FOR SELECT TO authenticated USING (true);
    ', t);

    EXECUTE format('
      CREATE POLICY "Escritura admin" ON %I
        FOR ALL TO authenticated USING (public.is_admin())
        WITH CHECK (public.is_admin());
    ', t);
  END LOOP;
END $$;

-- ─── Solicitudes: lectura todos, escritura admin ───
CREATE POLICY "Lectura solicitudes" ON solicitudes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura solicitudes admin" ON solicitudes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Visitas: lectura todos, escritura técnico asignado o admin ───
CREATE POLICY "Lectura visitas" ON visitas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura visitas propio" ON visitas
  FOR UPDATE TO authenticated
  USING (tecnico_id = public.get_tecnico_id() OR public.is_admin());

CREATE POLICY "Insertar visitas admin" ON visitas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ─── Prueba resultados: técnico de la visita o admin ───
CREATE POLICY "Lectura pruebas" ON prueba_resultados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura pruebas propio" ON prueba_resultados
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = prueba_resultados.visita_id
            AND (visitas.tecnico_id = public.get_tecnico_id() OR public.is_admin()))
  );

-- ─── Mediciones: técnico de la visita o admin ───
CREATE POLICY "Lectura mediciones" ON mediciones_radiometricas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura mediciones propio" ON mediciones_radiometricas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = mediciones_radiometricas.visita_id
            AND (visitas.tecnico_id = public.get_tecnico_id() OR public.is_admin()))
  );

-- ─── Evidencias: técnico de la visita o admin ───
CREATE POLICY "Lectura evidencias" ON evidencias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura evidencias propio" ON evidencias
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = evidencias.visita_id
            AND (visitas.tecnico_id = public.get_tecnico_id() OR public.is_admin()))
  );

-- ─── Elementos protección: técnico de la visita o admin ───
CREATE POLICY "Lectura elementos" ON elementos_proteccion
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura elementos propio" ON elementos_proteccion
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = elementos_proteccion.visita_id
            AND (visitas.tecnico_id = public.get_tecnico_id() OR public.is_admin()))
  );
