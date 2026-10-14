-- ============================================================
--  042 — NIT único entre clientes activos
--
--  Garantiza en el servidor lo que la app valida localmente: dos clientes
--  activos no pueden compartir NIT. Se compara solo por dígitos
--  ("800.225.057" = "800225057"). Excluye NIT vacío (es opcional) y
--  clientes con soft-delete, para que los duplicados ya unificados (ver
--  supabase/scripts/unificar_clientes_duplicados.sql) no bloqueen el índice.
--
--  Prerrequisito: correr el script de unificación. Si quedan duplicados
--  activos, este CREATE INDEX falla y no se aplica nada.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS clientes_nit_normalizado_unico
  ON public.clientes ((regexp_replace(nit, '\D', '', 'g')))
  WHERE deleted_at IS NULL
    AND regexp_replace(coalesce(nit, ''), '\D', '', 'g') <> '';
