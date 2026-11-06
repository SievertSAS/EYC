-- ============================================================
--  046 — Storage: escrituras acotadas por visita y por prefijo (#207)
--
--  Problema: las políticas de 018 sobre `storage.objects` solo miraban el
--  bucket. Cualquier `authenticated` (incluido `comercial` o un técnico no
--  asignado) podía sobrescribir o borrar CUALQUIER objeto de `evidencias`:
--  fotos de visitas ajenas, la firma de otro usuario o la del Director
--  Técnico, que sale en todos los informes.
--
--  Rutas del bucket `evidencias` (ver `src/lib/supabase/storage.ts`):
--    {visita_id}/{prueba}/{slot}.jpg   conv_evidencias       (cliente, sync)
--    {visita_id}/{tipo|id}.jpg         evidencias            (cliente, sync)
--    equipos/{equipo_id}/{id}.jpg      equipo_identificaciones (cliente, sync)
--    usuarios/{id}/firma.jpg           /api/usuarios/[id]    (service role)
--    configuracion/director-firma-*    /api/configuracion-informe (service role)
--
--  Reglas nuevas (el service role ignora RLS, así que las APIs no cambian):
--   - COORDINADOR (activo): acceso total a ambos buckets — SELECT, INSERT,
--     UPDATE y DELETE en cualquier ruta, incluidas `usuarios/` y
--     `configuracion/`. Se usa `is_coordinador()` y NO `is_admin()`, que
--     también incluye a `programador` (sin escritura directa de firmas).
--     Todo lo que sigue aplica al resto de roles.
--   - SELECT: igual que hoy (cualquier `authenticated`). Restringir la
--     lectura queda fuera de este cambio.
--   - INSERT/UPDATE de evidencia de visita: solo quien puede escribir esa
--     visita — técnico asignado o admin (`is_admin()`: coordinador /
--     programador), la misma regla "Escritura propio o admin" de 009/040.
--     El UPDATE hace falta porque `subirEvidencia` sube con `upsert: true`
--     (reemplazo de foto → mismo path).
--   - INSERT/UPDATE en `equipos/…`: cargos que operan equipos en la app
--     (coordinador, programador, técnico). `comercial` no tiene el módulo
--     equipos y nunca sube estas fotos.
--   - `usuarios/…`, `configuracion/…` y cualquier otro prefijo: sin
--     escritura para `authenticated` (no coinciden con ninguna visita).
--   - DELETE: solo coordinador (y service role). El cliente nunca borra
--     objetos (no hay `.remove()`/`.move()`; el borrado de filas es
--     soft-delete), así que ningún otro rol lo necesita.
--
--  Bucket `informes` (PDF oficial, `{informe_id}/v{n}.pdf`, subido desde el
--  navegador en `publicar-informe.ts`): no estaba en ninguna migración (se
--  creó a mano). Se crea si falta (sin tocar su configuración si ya existe)
--  y se acotan sus escrituras:
--   - INSERT: técnico asignado a la visita del informe, o admin (mismos
--     roles que la acción "aprobar" y que la RLS de `informes`). Si la fila
--     `informes` todavía no llegó al servidor (el push corre en paralelo a
--     la publicación), se permite a un técnico: el id es un UUID generado
--     en el cliente y, al no haber UPDATE, no se puede pisar después.
--   - Sin UPDATE ni DELETE salvo coordinador: un PDF publicado es
--     inmutable; cada versión usa un path nuevo (v{n}).
--   - SELECT para `authenticated` (lo exige el `RETURNING` de la subida).
--     La página pública /verificar/[token] usa service role: no cambia.
--
--  Idempotente (DROP POLICY IF EXISTS). Antes de correr en producción,
--  inventariar las políticas reales (018 se aplicó a mano y `informes`
--  puede tener políticas con otros nombres, que seguirían sumando permisos):
--
--    SELECT policyname, cmd, roles, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects'
--    ORDER BY policyname;
-- ============================================================

-- 1. Helpers. SECURITY DEFINER para no depender de la RLS de las tablas que
--    consultan; solo responden sobre el usuario actual (auth.uid()).
--    El segmento de la ruta se compara como TEXTO: un prefijo que no es
--    UUID (`equipos`, `usuarios`, `sin-visita`…) da false, nunca error.
CREATE OR REPLACE FUNCTION public.is_coordinador()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_uid = auth.uid()
      AND activo
      AND cargo = 'coordinador'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.storage_puede_escribir_visita(p_visita TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.id::text = p_visita
      AND (v.tecnico_id = public.get_usuario_id() OR public.is_admin())
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.storage_puede_escribir_equipos()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_uid = auth.uid()
      AND u.activo
      AND u.cargo IN ('coordinador', 'programador', 'tecnico')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.storage_puede_publicar_informe(p_informe TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.informes i WHERE i.id::text = p_informe) THEN
      EXISTS (
        SELECT 1 FROM public.informes i
        JOIN public.visitas v ON v.id = i.visita_id
        WHERE i.id::text = p_informe
          AND (v.tecnico_id = public.get_usuario_id() OR public.is_admin())
      )
    ELSE
      -- La fila aún no está en el servidor (push en curso): admin o técnico.
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_uid = auth.uid() AND u.activo AND u.cargo = 'tecnico'
      )
  END
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_coordinador() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_puede_escribir_visita(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_puede_escribir_equipos() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_puede_publicar_informe(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coordinador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_puede_escribir_visita(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_puede_escribir_equipos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_puede_publicar_informe(TEXT) TO authenticated;

-- 2. Bucket `evidencias`.
--    SELECT (`evidencias_auth_select`, 018) se deja tal cual.

DROP POLICY IF EXISTS "evidencias_auth_insert" ON storage.objects;
CREATE POLICY "evidencias_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencias'
    AND (
      public.storage_puede_escribir_visita((storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'equipos'
        AND public.storage_puede_escribir_equipos()
      )
    )
  );

DROP POLICY IF EXISTS "evidencias_auth_update" ON storage.objects;
CREATE POLICY "evidencias_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (
      public.storage_puede_escribir_visita((storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'equipos'
        AND public.storage_puede_escribir_equipos()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'evidencias'
    AND (
      public.storage_puede_escribir_visita((storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'equipos'
        AND public.storage_puede_escribir_equipos()
      )
    )
  );

-- Sin borrado para el resto de `authenticated` (el cliente nunca borra objetos).
DROP POLICY IF EXISTS "evidencias_auth_delete" ON storage.objects;

-- Coordinador: acceso total al bucket (cualquier ruta, cualquier comando).
DROP POLICY IF EXISTS "evidencias_coordinador_all" ON storage.objects;
CREATE POLICY "evidencias_coordinador_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'evidencias' AND public.is_coordinador())
  WITH CHECK (bucket_id = 'evidencias' AND public.is_coordinador());

-- 3. Bucket `informes`. En producción ya existía (creado a mano: privado,
--    sin límite de tamaño ni de tipo). Se crea si falta y se le fijan los
--    límites: solo PDF (la app sube con contentType application/pdf), 50 MB.
--    `public` se fuerza a false: el PDF oficial se lee con URL firmada.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('informes', 'informes', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas creadas a mano desde el dashboard en producción (INSERT/UPDATE/
-- SELECT para cualquier autenticado). Las políticas se SUMAN: si quedan,
-- cualquier usuario podría seguir sobrescribiendo PDF oficiales.
DROP POLICY IF EXISTS "pdfs 2yh3h3_0" ON storage.objects;
DROP POLICY IF EXISTS "pdfs 2yh3h3_1" ON storage.objects;
DROP POLICY IF EXISTS "pdfs 2yh3h3_2" ON storage.objects;

DROP POLICY IF EXISTS "informes_auth_select" ON storage.objects;
CREATE POLICY "informes_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'informes');

DROP POLICY IF EXISTS "informes_auth_insert" ON storage.objects;
CREATE POLICY "informes_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'informes'
    AND public.storage_puede_publicar_informe((storage.foldername(name))[1])
  );

-- Inmutabilidad del PDF publicado: sin UPDATE ni DELETE para el resto de
-- `authenticated`.
DROP POLICY IF EXISTS "informes_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "informes_auth_delete" ON storage.objects;

-- Coordinador: acceso total al bucket (incluye corregir o retirar un PDF).
DROP POLICY IF EXISTS "informes_coordinador_all" ON storage.objects;
CREATE POLICY "informes_coordinador_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'informes' AND public.is_coordinador())
  WITH CHECK (bucket_id = 'informes' AND public.is_coordinador());
