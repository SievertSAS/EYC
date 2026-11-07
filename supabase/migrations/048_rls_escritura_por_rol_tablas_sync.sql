-- ============================================================
--  048 — RLS de escritura por rol en las tablas de sync (#211)
--
--  Problema: la 017 (fix de #59) creó en las 34 tablas de sync las
--  políticas `{t}_auth_insert` / `{t}_auth_update` / `{t}_auth_delete`
--  con `true` para `authenticated`; la 021 (`equipo_identificaciones`) y
--  la 034 (`conv_equipo_valores_base`) repitieron el patrón. Postgres
--  combina las políticas permisivas con OR, así que esas anulan las
--  estrictas que ya existen debajo: cualquier autenticado (un comercial,
--  un técnico no asignado) podía modificar mediciones de visitas ajenas o
--  hacer DELETE físico de clientes, equipos o visitas llamando a la API.
--
--  Estado de producción (verificado 2026-11-06; las migraciones se
--  aplicaron a mano): además de las de la 017, ya existen debajo
--    - "Escritura propio o admin" (ALL, técnico de la visita o is_admin())
--      en conv_*, evidencias, grupo_resultados, prueba_resultados,
--      mediciones_radiometricas, informes, informe_versiones.
--    - visitas: "Insertar visitas" / "Actualizar visitas" (técnico de la
--      visita o is_admin()), sin política de DELETE.
--    - solicitudes: "Escritura solicitudes admin" (ALL is_admin()) y
--      "Escritura solicitudes tecnico asignado" (UPDATE).
--    - "Escritura admin" (ALL is_admin()) en clientes, contactos, sedes,
--      ubicaciones_rx, equipos, equipo_movimientos, tubos, colimadores,
--      gantry.
--    - conv_equipo_valores_base y equipo_identificaciones: SOLO las
--      políticas estilo 017 (ninguna estricta).
--
--  Qué escribe el cliente (el push del sync usa el cliente de sesión y
--  hace `upsert(..., { onConflict: "id" })` = INSERT ... ON CONFLICT DO
--  UPDATE, que exige pasar el WITH CHECK de INSERT sobre la fila propuesta
--  Y el USING/WITH CHECK de UPDATE; nunca hace DELETE — el borrado es
--  soft-delete con `deleted_at`):
--    - técnico: datos de SU visita (conv_*, resultados, evidencias,
--      visitas, informes); desde Información General de su visita edita el
--      cliente, la sede, la ubicación y agrega/edita contactos (#59); el
--      `pipeline_estado` de la solicitud de su visita; desde Equipos (módulo
--      con "editar") edita cualquier equipo, sus tubos / colimadores /
--      gantry / identificaciones y registra traslados; los valores base del
--      equipo de su visita (pruebas 2.8–2.21).
--    - comercial: crea/edita clientes, contactos, sedes, ubicaciones y
--      solicitudes (módulos "clientes" y "solicitudes"). No toca visitas.
--    - programador / coordinador: `is_admin()` (sin cambios).
--
--  Cambios:
--   1. Se borran las `{t}_auth_insert/update/delete` de todas las tablas
--      de sync. Las políticas de SELECT (`{t}_auth_select`, "Lectura
--      autenticada") NO se tocan: la lectura no cambia en esta migración.
--   2. Se agregan políticas angostas para el técnico y el comercial donde
--      hoy solo existía "Escritura admin" (ver cada bloque), y una regla de
--      escritura propia para conv_equipo_valores_base y
--      equipo_identificaciones.
--   3. DELETE físico: solo coordinador activo (`is_coordinador()`), en
--      todas las tablas de sync. Se hace con una política RESTRICTIVE
--      (se combina con AND), que además le quita el DELETE que las "FOR
--      ALL" existentes le daban al técnico de la visita y al programador.
--      El service role ignora RLS, así que las APIs no cambian.
--   4. Ninguna política existente se relaja.
--
--  Idempotente (DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION).
--  Antes de correr en producción, inventariar las políticas reales —
--  cualquier otra política permisiva con otro nombre seguiría sumando
--  permisos:
--
--    SELECT tablename, policyname, permissive, cmd, roles, qual, with_check
--    FROM pg_policies WHERE schemaname = 'public'
--    ORDER BY tablename, cmd;
-- ============================================================

-- ─── 1. Helpers ─────────────────────────────────────────────
--  SECURITY DEFINER para no depender de la RLS de las tablas que consultan
--  (si mañana se restringe la lectura, las políticas de escritura siguen
--  igual). Solo responden sobre el usuario actual (auth.uid()) y exigen
--  usuario activo.

-- Cargo del usuario actual si está activo; NULL si no existe o está inactivo.
CREATE OR REPLACE FUNCTION public.cargo_actual()
RETURNS TEXT AS $$
  SELECT cargo FROM public.usuarios
  WHERE auth_uid = auth.uid() AND activo
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.tiene_cargo(p_cargos TEXT[])
RETURNS BOOLEAN AS $$
  SELECT COALESCE(public.cargo_actual() = ANY (p_cargos), false)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Técnico activo con una visita asignada sobre la entidad indicada. Cubren
-- lo que el técnico edita desde Información General de su visita.
CREATE OR REPLACE FUNCTION public.tecnico_asignado_ubicacion(p_ubicacion UUID)
RETURNS BOOLEAN AS $$
  SELECT public.tiene_cargo(ARRAY['tecnico']) AND EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.ubicacion_id = p_ubicacion
      AND v.tecnico_id = public.get_usuario_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.tecnico_asignado_sede(p_sede UUID)
RETURNS BOOLEAN AS $$
  SELECT public.tiene_cargo(ARRAY['tecnico']) AND EXISTS (
    SELECT 1 FROM public.visitas v
    JOIN public.ubicaciones_rx u ON u.id = v.ubicacion_id
    WHERE u.sede_id = p_sede
      AND v.tecnico_id = public.get_usuario_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- El cliente de la visita sale de su solicitud (igual que info-modulo).
CREATE OR REPLACE FUNCTION public.tecnico_asignado_cliente(p_cliente UUID)
RETURNS BOOLEAN AS $$
  SELECT public.tiene_cargo(ARRAY['tecnico']) AND EXISTS (
    SELECT 1 FROM public.visitas v
    JOIN public.solicitudes s ON s.id = v.solicitud_id
    WHERE s.cliente_id = p_cliente
      AND v.tecnico_id = public.get_usuario_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.tecnico_asignado_equipo(p_equipo UUID)
RETURNS BOOLEAN AS $$
  SELECT public.tiene_cargo(ARRAY['tecnico']) AND EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.equipo_id = p_equipo
      AND v.tecnico_id = public.get_usuario_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.tecnico_asignado_solicitud(p_solicitud UUID)
RETURNS BOOLEAN AS $$
  SELECT public.tiene_cargo(ARRAY['tecnico']) AND EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.solicitud_id = p_solicitud
      AND v.tecnico_id = public.get_usuario_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- El técnico edita equipos existentes pero no los crea (módulo equipos =
-- ver + editar). Como el upsert del sync pasa por el WITH CHECK de INSERT
-- aunque la fila exista, se acepta el INSERT solo si el id ya existe:
-- un INSERT de un equipo nuevo queda denegado y el upsert-edición pasa.
CREATE OR REPLACE FUNCTION public.equipo_existe(p_equipo UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.equipos WHERE id = p_equipo)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.cargo_actual() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tiene_cargo(TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnico_asignado_ubicacion(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnico_asignado_sede(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnico_asignado_cliente(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnico_asignado_equipo(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnico_asignado_solicitud(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipo_existe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tiene_cargo(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_asignado_ubicacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_asignado_sede(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_asignado_cliente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_asignado_equipo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_asignado_solicitud(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipo_existe(UUID) TO authenticated;

-- ─── 2. Quitar las permisivas de escritura (017 / 021 / 034) ───
--  y dejar el DELETE físico solo al coordinador en todas las tablas de sync.
DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'clientes','contactos','sedes','ubicaciones_rx','equipos','equipo_movimientos',
    'tubos','colimadores','gantry','equipo_identificaciones','solicitudes',
    'visitas','informes','informe_versiones',
    'grupo_resultados','prueba_resultados','mediciones_radiometricas','evidencias',
    'conv_levantamiento_setup','conv_mediciones','conv_inspeccion_items','conv_elementos_proteccion',
    'conv_raysafe_setup','conv_raysafe_mediciones','conv_cae_setup','conv_cae_mediciones',
    'conv_ddi_mediciones','conv_cassette_inspeccion','conv_uniformidad_cr','conv_colimacion',
    'conv_uniformidad_detector','conv_resolucion','conv_bajo_contraste','conv_mtf',
    'conv_equipo_valores_base','conv_informe_secciones','conv_resultados_prueba','conv_evidencias'
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

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_delete', t);

    -- Camino permisivo de DELETE para el coordinador (visitas y las tablas
    -- sin "FOR ALL" de admin no lo tenían).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_coordinador_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_coordinador())',
      t || '_coordinador_delete', t
    );

    -- RESTRICTIVE: se combina con AND con cualquier permisiva (incluidas
    -- las "FOR ALL" de admin / técnico de la visita). Nadie más que el
    -- coordinador borra físicamente; la app usa soft-delete.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_solo_coordinador', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      'USING (public.is_coordinador())',
      t || '_delete_solo_coordinador', t
    );
  END LOOP;
END $$;

-- ─── 3. Escrituras angostas por rol ─────────────────────────
--  Datos de visita (conv_*, evidencias, resultados, informes, visitas):
--  sin políticas nuevas. "Escritura propio o admin" / "Insertar visitas" /
--  "Actualizar visitas" ya cubren al técnico de la visita y a los admin.

-- clientes: comercial (módulo clientes) y técnico con visita sobre el
-- cliente (Información General). El técnico solo llega por el UPDATE: un
-- cliente nuevo no puede tener visitas, así que el INSERT queda denegado.
DROP POLICY IF EXISTS "clientes_escritura_rol_insert" ON public.clientes;
CREATE POLICY "clientes_escritura_rol_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(id));

DROP POLICY IF EXISTS "clientes_escritura_rol_update" ON public.clientes;
CREATE POLICY "clientes_escritura_rol_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(id))
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(id));

-- contactos: comercial, y técnico sobre contactos del cliente de su visita
-- (los agrega y edita desde Información General — caso de #59).
DROP POLICY IF EXISTS "contactos_escritura_rol_insert" ON public.contactos;
CREATE POLICY "contactos_escritura_rol_insert" ON public.contactos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(cliente_id)
  );

DROP POLICY IF EXISTS "contactos_escritura_rol_update" ON public.contactos;
CREATE POLICY "contactos_escritura_rol_update" ON public.contactos
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(cliente_id))
  WITH CHECK (
    public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_cliente(cliente_id)
  );

-- sedes: comercial, y técnico sobre la sede de la ubicación de su visita.
DROP POLICY IF EXISTS "sedes_escritura_rol_insert" ON public.sedes;
CREATE POLICY "sedes_escritura_rol_insert" ON public.sedes
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_sede(id));

DROP POLICY IF EXISTS "sedes_escritura_rol_update" ON public.sedes;
CREATE POLICY "sedes_escritura_rol_update" ON public.sedes
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_sede(id))
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_sede(id));

-- ubicaciones_rx: comercial, y técnico sobre la ubicación de su visita.
DROP POLICY IF EXISTS "ubicaciones_rx_escritura_rol_insert" ON public.ubicaciones_rx;
CREATE POLICY "ubicaciones_rx_escritura_rol_insert" ON public.ubicaciones_rx
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_ubicacion(id));

DROP POLICY IF EXISTS "ubicaciones_rx_escritura_rol_update" ON public.ubicaciones_rx;
CREATE POLICY "ubicaciones_rx_escritura_rol_update" ON public.ubicaciones_rx
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_ubicacion(id))
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_ubicacion(id));

-- solicitudes: comercial (módulo solicitudes: crear/editar). El técnico ya
-- tiene "Escritura solicitudes tecnico asignado" (UPDATE por
-- tecnico_asignado_id), pero el upsert del sync también exige INSERT, y
-- una solicitud con varios equipos puede tener visitas de técnicos
-- distintos (`tecnico_asignado_id` guarda el último). Se le permite al
-- técnico con una visita en la solicitud (cambio de `pipeline_estado` en
-- la máquina de estados); una solicitud nueva no tiene visitas → sin INSERT.
DROP POLICY IF EXISTS "solicitudes_escritura_rol_insert" ON public.solicitudes;
CREATE POLICY "solicitudes_escritura_rol_insert" ON public.solicitudes
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_solicitud(id));

DROP POLICY IF EXISTS "solicitudes_escritura_rol_update" ON public.solicitudes;
CREATE POLICY "solicitudes_escritura_rol_update" ON public.solicitudes
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_solicitud(id))
  WITH CHECK (public.tiene_cargo(ARRAY['comercial']) OR public.tecnico_asignado_solicitud(id));

-- equipos: el técnico edita cualquier equipo desde Equipos (no solo los de
-- sus visitas), pero no crea equipos → INSERT solo sobre un id existente.
-- Comercial no tiene el módulo equipos.
DROP POLICY IF EXISTS "equipos_escritura_tecnico_insert" ON public.equipos;
CREATE POLICY "equipos_escritura_tecnico_insert" ON public.equipos
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_cargo(ARRAY['tecnico']) AND public.equipo_existe(id));

DROP POLICY IF EXISTS "equipos_escritura_tecnico_update" ON public.equipos;
CREATE POLICY "equipos_escritura_tecnico_update" ON public.equipos
  FOR UPDATE TO authenticated
  USING (public.tiene_cargo(ARRAY['tecnico']))
  WITH CHECK (public.tiene_cargo(ARRAY['tecnico']));

-- Hijos del equipo y traslados: el formulario de equipo y la Información
-- General crean tubo / colimador / gantry / identificaciones cuando el
-- equipo no los tenía, y "Trasladar" crea el movimiento. Mismo alcance que
-- el UPDATE de equipos: técnico activo, a nivel de rol.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tubos','colimadores','gantry','equipo_identificaciones','equipo_movimientos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_escritura_tecnico_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (public.tiene_cargo(ARRAY[''tecnico'']))',
      t || '_escritura_tecnico_insert', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_escritura_tecnico_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
      'USING (public.tiene_cargo(ARRAY[''tecnico''])) '
      'WITH CHECK (public.tiene_cargo(ARRAY[''tecnico'']))',
      t || '_escritura_tecnico_update', t
    );
  END LOOP;
END $$;

-- equipo_identificaciones: no tenía política estricta (solo la 021).
-- Admin como el resto de las tablas del equipo; técnico arriba.
DROP POLICY IF EXISTS "Escritura admin" ON public.equipo_identificaciones;
CREATE POLICY "Escritura admin" ON public.equipo_identificaciones
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- conv_equipo_valores_base: no tenía política estricta (solo la 034). Se
-- escribe solo desde las pruebas de la visita (grupos B–E), así que el
-- técnico queda atado a un equipo con visita suya; admin como siempre.
DROP POLICY IF EXISTS "Escritura admin" ON public.conv_equipo_valores_base;
CREATE POLICY "Escritura admin" ON public.conv_equipo_valores_base
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "conv_equipo_valores_base_escritura_tecnico_insert"
  ON public.conv_equipo_valores_base;
CREATE POLICY "conv_equipo_valores_base_escritura_tecnico_insert"
  ON public.conv_equipo_valores_base
  FOR INSERT TO authenticated
  WITH CHECK (public.tecnico_asignado_equipo(equipo_id));

DROP POLICY IF EXISTS "conv_equipo_valores_base_escritura_tecnico_update"
  ON public.conv_equipo_valores_base;
CREATE POLICY "conv_equipo_valores_base_escritura_tecnico_update"
  ON public.conv_equipo_valores_base
  FOR UPDATE TO authenticated
  USING (public.tecnico_asignado_equipo(equipo_id))
  WITH CHECK (public.tecnico_asignado_equipo(equipo_id));
