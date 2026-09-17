-- ============================================================
--  040 — RLS de escritura en informes/informe_versiones: técnico
--  de la visita o admin (no solo admin)
--
--  Contexto: al convertir estas dos tablas a sync bidireccional (#154),
--  el push del cliente empezó a fallar con:
--    code 42501 — "new row violates row-level security policy for
--    table \"informes\""
--
--  Causa real: `crearInformeDesdeVisita`/`publicarVersionOficial` se
--  disparan automáticamente al aprobar una visita (`visit-state-machine.ts`,
--  acción "aprobar") -- y esa acción la ejecuta el TÉCNICO asignado, no
--  necesariamente un coordinador/programador. La migración 009 solo les
--  daba escritura a "Escritura admin" (`public.is_admin()`, coordinador/
--  programador) -- el técnico, dueño legítimo de esa visita, nunca pudo
--  escribir su propio informe.
--
--  Fix: mismo patrón "Escritura propio o admin" que ya usan `visitas`,
--  `conv_informe_secciones` y el resto de tablas de campo (009, líneas
--  952-1001) -- técnico de la visita (vía visita_id) O admin.
--  `informe_versiones` no tiene `visita_id` directo: se llega a la
--  visita a través de `informe_id -> informes.visita_id`.
--
--  Idempotente (DROP POLICY IF EXISTS).
-- ============================================================

ALTER TABLE public.informes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_versiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada" ON public.informes;
CREATE POLICY "Lectura autenticada" ON public.informes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escritura admin" ON public.informes;
DROP POLICY IF EXISTS "Escritura propio o admin" ON public.informes;
CREATE POLICY "Escritura propio o admin" ON public.informes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM visitas
      WHERE visitas.id = informes.visita_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM visitas
      WHERE visitas.id = informes.visita_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada" ON public.informe_versiones;
CREATE POLICY "Lectura autenticada" ON public.informe_versiones
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escritura admin" ON public.informe_versiones;
DROP POLICY IF EXISTS "Escritura propio o admin" ON public.informe_versiones;
CREATE POLICY "Escritura propio o admin" ON public.informe_versiones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM informes
      JOIN visitas ON visitas.id = informes.visita_id
      WHERE informes.id = informe_versiones.informe_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM informes
      JOIN visitas ON visitas.id = informes.visita_id
      WHERE informes.id = informe_versiones.informe_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  );
