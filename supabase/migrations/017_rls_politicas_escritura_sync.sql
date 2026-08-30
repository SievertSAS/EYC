-- ============================================================
--  017 — Políticas RLS de escritura para TODAS las tablas de sync
--
--  Contexto (issue #59, hallazgo de la pasada de prueba E2E):
--  Al capturar contactos desde Información General, el push respondía
--  403 / 42501 ("new row violates row-level security policy for table
--  contactos"). Causa: RLS habilitado en `contactos` (y potencialmente
--  en otras) SIN políticas permisivas de INSERT/UPDATE → todo write del
--  usuario autenticado se rechaza.
--
--  El motor de sync escribe con el cliente de sesión (anon key + JWT del
--  usuario), así que TODO pasa por RLS como `authenticated`. Esta app no
--  implementa ownership por fila; el modelo de acceso real es "cualquier
--  usuario autenticado del staff puede leer/escribir los datos de
--  campo". Esta migración deja ese modelo CONSISTENTE en todas las
--  tablas de sync: RLS habilitado + una política permisiva por comando
--  para el rol `authenticated`.
--
--  Defensa en profundidad (ownership / RLS por rol) es un proyecto
--  aparte (ver #38 y siguientes). Esto NO agrega restricciones nuevas:
--  restaura el estado de escritura que las tablas que hoy SÍ funcionan
--  ya tienen de facto.
--
--  Idempotente (DROP POLICY IF EXISTS). Correr en Supabase → SQL Editor.
--
--  Antes de correr, para inventariar el estado actual:
--
--    -- tablas con RLS on pero sin política de escritura:
--    SELECT c.relname
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
--      AND NOT EXISTS (
--        SELECT 1 FROM pg_policies p
--        WHERE p.tablename = c.relname AND p.cmd IN ('INSERT','UPDATE','ALL')
--      )
--    ORDER BY c.relname;
--
--    -- todas las políticas de las tablas de sync:
--    SELECT tablename, policyname, cmd, roles, qual, with_check
--    FROM pg_policies
--    WHERE tablename = ANY(ARRAY[
--      'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
--      'tubos','colimadores','gantry','solicitudes','visitas','grupo_resultados',
--      'prueba_resultados','mediciones_radiometricas','evidencias',
--      'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items',
--      'conv_elementos_proteccion','conv_raysafe_setup','conv_raysafe_mediciones',
--      'conv_cae_setup','conv_cae_mediciones','conv_ddi_mediciones',
--      'conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
--      'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
--      'conv_informe_secciones','conv_resultados_prueba','conv_evidencias'])
--    ORDER BY tablename, cmd;
-- ============================================================

DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
    'tubos','colimadores','gantry','solicitudes',
    'visitas','grupo_resultados','prueba_resultados','mediciones_radiometricas','evidencias',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items','conv_elementos_proteccion',
    'conv_raysafe_setup','conv_raysafe_mediciones','conv_cae_setup','conv_cae_mediciones',
    'conv_ddi_mediciones','conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
    'conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ];
BEGIN
  FOREACH t IN ARRAY sync_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'tabla % no existe — se omite', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_auth_select', t
    );

    -- INSERT
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      t || '_auth_insert', t
    );

    -- UPDATE (incluye el UPSERT ON CONFLICT del sync)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t || '_auth_update', t
    );

    -- DELETE (el borrado real es soft-delete vía UPDATE, pero se deja por
    -- si algún flujo administrativo hace hard-delete).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
      t || '_auth_delete', t
    );

    RAISE NOTICE 'RLS + políticas authenticated aplicadas a %', t;
  END LOOP;
END $$;

-- Defensivo (issue #35): el valor `sync_status = 'conflict'` se retiró del
-- enum del cliente en Tier 2. Si quedaron filas viejas en ese estado,
-- pasarlas a 'pending' para que el próximo push las reintente.
DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
    'tubos','colimadores','gantry','solicitudes',
    'visitas','grupo_resultados','prueba_resultados','mediciones_radiometricas','evidencias',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items','conv_elementos_proteccion',
    'conv_raysafe_setup','conv_raysafe_mediciones','conv_cae_setup','conv_cae_mediciones',
    'conv_ddi_mediciones','conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
    'conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
  ];
BEGIN
  FOREACH t IN ARRAY sync_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'sync_status'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET sync_status = ''pending'' WHERE sync_status = ''conflict''', t
      );
    END IF;
  END LOOP;
END $$;
