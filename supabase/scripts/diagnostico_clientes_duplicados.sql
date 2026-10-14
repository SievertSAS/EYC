-- ============================================================
--  Diagnóstico de clientes duplicados (SOLO LECTURA)
--  Ejecutar en el SQL Editor de Supabase y compartir el resultado.
--  Devuelve una fila por cliente que comparte NIT (solo dígitos) o
--  nombre normalizado con otro, junto con cuántos registros cuelgan de él
--  en cada tabla que referencia a `clientes` (detectadas dinámicamente).
-- ============================================================

DO $$
DECLARE
  fk RECORD;
  conteos TEXT := '';
BEGIN
  FOR fk IN
    SELECT c.conrelid::regclass::text AS tabla, a.attname AS columna
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.clientes'::regclass
  LOOP
    conteos := conteos || format(
      ', (SELECT count(*) FROM %s t WHERE t.%I = d.id) AS %I',
      fk.tabla, fk.columna, 'n_' || replace(fk.tabla, 'public.', '')
    );
  END LOOP;

  EXECUTE format($q$
    CREATE OR REPLACE TEMP VIEW _clientes_duplicados AS
    WITH base AS (
      SELECT id, nombre_cliente, nit, digito_verificacion, creado_en,
             regexp_replace(coalesce(nit, ''), '\D', '', 'g') AS nit_norm,
             lower(regexp_replace(trim(nombre_cliente), '\s+', ' ', 'g')) AS nombre_norm
      FROM clientes
    ),
    d AS (
      SELECT b.*,
             count(*) FILTER (WHERE b.nit_norm <> '') OVER (PARTITION BY b.nit_norm) AS rep_nit,
             count(*) OVER (PARTITION BY b.nombre_norm) AS rep_nombre
      FROM base b
    )
    SELECT CASE WHEN d.rep_nit > 1 THEN 'nit' ELSE 'nombre' END AS criterio,
           CASE WHEN d.rep_nit > 1 THEN d.nit_norm ELSE d.nombre_norm END AS clave,
           d.id, d.nombre_cliente, d.nit, d.digito_verificacion, d.creado_en %s
    FROM d
    WHERE d.rep_nit > 1 OR d.rep_nombre > 1
  $q$, conteos);
END $$;

SELECT * FROM _clientes_duplicados ORDER BY criterio, clave, creado_en;
