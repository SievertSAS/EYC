-- ============================================================
--  054 — Backfill de `equipos.parametros_consola` (#189, paso 2)
--
--  Desde este paso el informe del CONVENCIONAL (fijo y portátil) muestra
--  solo los parámetros nominales que la consola deja ver (kV, mA, Tiempo,
--  mAs). Los cálculos internos no cambian: siguen usando todos los valores.
--
--  Decisión del usuario: los equipos CONVENCIONAL existentes (sin definir,
--  NULL) quedan con los cuatro parámetros, porque así se genera el informe
--  hoy; el técnico desmarca los que su consola no muestra. El código también
--  trata NULL como "los cuatro", así que esto solo deja el dato explícito en
--  el checklist.
--
--  El trigger BEFORE UPDATE de `last_modified` (016) avanza la marca de agua
--  de cada fila actualizada, de modo que los dispositivos traen el valor en
--  el próximo pull incremental. Solo filas vivas (deleted_at IS NULL).
--  Idempotente: una segunda corrida no encuentra filas con NULL.
-- ============================================================

UPDATE public.equipos
SET parametros_consola = ARRAY['kv', 'ma', 'tiempo', 'mas']::text[]
WHERE tipo_equipo = 'CONVENCIONAL'
  AND parametros_consola IS NULL
  AND deleted_at IS NULL;
