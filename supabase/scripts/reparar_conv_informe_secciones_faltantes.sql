-- ============================================================
--  Script: Repara conv_informe_secciones incompletas
--
--  Bug (ver fix en src/components/visita-modulos/pre-informe-modulo.tsx):
--  el catálogo de 21 pruebas se creaba localmente sin sync_status="pending",
--  así que nunca se subía a Supabase salvo que alguien editara cada fila a
--  mano. Resultado: visitas CONVENCIONAL con menos de 21 filas en
--  conv_informe_secciones (a veces solo las que alguien llegó a tocar).
--
--  Este script rellena, por visita, los `prueba_codigo` (2.1..2.21) que
--  falten -- nunca toca ni borra los que ya existen.
--
--  Idempotente: usa ON CONFLICT (visita_id, prueba_codigo) DO NOTHING,
--  se puede correr las veces que haga falta sin duplicar filas.
--
--  Ejecutar en SQL Editor de Supabase.
-- ============================================================

-- ─── 1. Diagnóstico: visitas CONVENCIONAL con menos de 21 filas ───
-- Corré esto primero para ver el alcance antes de aplicar el fix.

SELECT
  v.id AS visita_id,
  v.estado_visita,
  count(cis.id) AS filas_actuales,
  21 - count(cis.id) AS filas_faltantes
FROM visitas v
JOIN equipos e ON e.id = v.equipo_id
LEFT JOIN conv_informe_secciones cis ON cis.visita_id = v.id
WHERE e.tipo_equipo = 'CONVENCIONAL'
  AND v.deleted_at IS NULL
GROUP BY v.id, v.estado_visita
HAVING count(cis.id) < 21
ORDER BY filas_faltantes DESC;

-- ─── 2. Reparación: inserta solo lo que falta ───

WITH catalogo (prueba_codigo, orden) AS (
  VALUES
    ('2.1', 1), ('2.2', 2), ('2.3', 3), ('2.4', 4), ('2.5', 5),
    ('2.6', 6), ('2.7', 7), ('2.8', 8), ('2.9', 9), ('2.10', 10),
    ('2.11', 11), ('2.12', 12), ('2.13', 13), ('2.14', 14), ('2.15', 15),
    ('2.16', 16), ('2.17', 17), ('2.18', 18), ('2.19', 19), ('2.20', 20),
    ('2.21', 21)
),
visitas_convencional AS (
  SELECT v.id AS visita_id
  FROM visitas v
  JOIN equipos e ON e.id = v.equipo_id
  WHERE e.tipo_equipo = 'CONVENCIONAL'
    AND v.deleted_at IS NULL
)
INSERT INTO conv_informe_secciones
  (visita_id, prueba_codigo, orden, incluida, sync_status, creado_en, last_modified)
SELECT
  vc.visita_id, cat.prueba_codigo, cat.orden, TRUE, 'synced', NOW(), NOW()
FROM visitas_convencional vc
CROSS JOIN catalogo cat
ON CONFLICT (visita_id, prueba_codigo) DO NOTHING;

-- ─── 3. Verificación: no debería quedar ninguna con menos de 21 ───

SELECT
  v.id AS visita_id,
  count(cis.id) AS filas_actuales
FROM visitas v
JOIN equipos e ON e.id = v.equipo_id
LEFT JOIN conv_informe_secciones cis ON cis.visita_id = v.id
WHERE e.tipo_equipo = 'CONVENCIONAL'
  AND v.deleted_at IS NULL
GROUP BY v.id
HAVING count(cis.id) < 21;
