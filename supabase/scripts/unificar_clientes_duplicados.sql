-- ============================================================
--  Unificación de clientes duplicados por NIT (ESCRIBE EN LA BASE)
--
--  Para cada grupo de clientes activos con el mismo NIT (solo dígitos):
--    1. Conserva el que más registros relacionados tiene (empate: el más
--       antiguo).
--    2. Reasigna al conservado todas las filas que apuntan a los demás,
--       en cada tabla con FK a `clientes` (detectadas dinámicamente), y
--       actualiza `last_modified` para que el sync las baje a los
--       dispositivos.
--    3. Marca los duplicados con `deleted_at` (soft-delete). NO usa DELETE:
--       las FKs son ON DELETE CASCADE y además el borrado físico no viaja
--       por el sync, dejaría el cliente fantasma en los dispositivos.
--
--  Un bloque DO es atómico: si algo falla, no se aplica nada.
--  Correr primero diagnostico_clientes_duplicados.sql.
-- ============================================================

DO $$
DECLARE
  fk RECORD;
  grupo RECORD;
  v_keep uuid;
  v_drop uuid;
  v_conteo bigint;
  v_movidas bigint;
  v_tiene_lm boolean;
  v_expr_conteo text := '0';
BEGIN
  -- Expresión que cuenta los registros relacionados de un cliente `c.id`
  FOR fk IN
    SELECT c.conrelid::regclass::text AS tabla, a.attname AS columna
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.clientes'::regclass
  LOOP
    v_expr_conteo := v_expr_conteo
      || format(' + (SELECT count(*) FROM %s t WHERE t.%I = c.id)', fk.tabla, fk.columna);
  END LOOP;

  FOR grupo IN
    SELECT regexp_replace(nit, '\D', '', 'g') AS nit_norm
    FROM clientes
    WHERE deleted_at IS NULL AND regexp_replace(coalesce(nit, ''), '\D', '', 'g') <> ''
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    EXECUTE format($q$
      SELECT c.id FROM clientes c
      WHERE c.deleted_at IS NULL AND regexp_replace(c.nit, '\D', '', 'g') = %L
      ORDER BY (%s) DESC, c.creado_en ASC
      LIMIT 1
    $q$, grupo.nit_norm, v_expr_conteo) INTO v_keep;

    RAISE NOTICE 'NIT %: se conserva el cliente %', grupo.nit_norm, v_keep;

    FOR v_drop IN
      SELECT id FROM clientes
      WHERE deleted_at IS NULL
        AND regexp_replace(nit, '\D', '', 'g') = grupo.nit_norm
        AND id <> v_keep
    LOOP
      FOR fk IN
        SELECT c.conrelid AS rel, c.conrelid::regclass::text AS tabla, a.attname AS columna
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.clientes'::regclass
      LOOP
        SELECT EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = fk.rel AND attname = 'last_modified' AND NOT attisdropped
        ) INTO v_tiene_lm;

        EXECUTE format(
          'UPDATE %s SET %I = $1%s WHERE %I = $2',
          fk.tabla, fk.columna,
          CASE WHEN v_tiene_lm THEN ', last_modified = now()' ELSE '' END,
          fk.columna
        ) USING v_keep, v_drop;
        GET DIAGNOSTICS v_movidas = ROW_COUNT;
        IF v_movidas > 0 THEN
          RAISE NOTICE '  % fila(s) de % movidas de % a %', v_movidas, fk.tabla, v_drop, v_keep;
        END IF;
      END LOOP;

      UPDATE clientes SET deleted_at = now(), last_modified = now() WHERE id = v_drop;
      RAISE NOTICE '  cliente % marcado como eliminado', v_drop;
    END LOOP;
  END LOOP;

  -- Verificación final: no deben quedar NITs repetidos entre clientes activos
  SELECT count(*) INTO v_conteo FROM (
    SELECT 1 FROM clientes
    WHERE deleted_at IS NULL AND regexp_replace(coalesce(nit, ''), '\D', '', 'g') <> ''
    GROUP BY regexp_replace(nit, '\D', '', 'g')
    HAVING count(*) > 1
  ) s;
  IF v_conteo > 0 THEN
    RAISE EXCEPTION 'Quedan % NIT(s) repetidos; se revierte todo', v_conteo;
  END IF;
END $$;

-- Resultado: clientes que comparten NIT, incluidos los ya marcados
SELECT id, nombre_cliente, nit, deleted_at, creado_en
FROM clientes
WHERE regexp_replace(coalesce(nit, ''), '\D', '', 'g') IN (
  SELECT regexp_replace(nit, '\D', '', 'g') FROM clientes
  WHERE regexp_replace(coalesce(nit, ''), '\D', '', 'g') <> ''
  GROUP BY 1 HAVING count(*) > 1
)
ORDER BY nit, deleted_at NULLS FIRST;
