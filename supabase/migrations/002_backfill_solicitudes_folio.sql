-- Backfill folios for solicitudes created before the folio trigger/service path was stable.
-- Keeps existing folios untouched and only fills NULL/empty values.

WITH solicitudes_sin_folio AS (
  SELECT
    id,
    COALESCE(created_at, now()) AS fecha,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(COALESCE(created_at, now()), 'YYYY')
      ORDER BY COALESCE(created_at, now()), id
    ) AS rn
  FROM solicitudes
  WHERE folio IS NULL OR btrim(folio) = ''
),
maximo_existente AS (
  SELECT
    SUBSTRING(folio FROM '^TRM-([0-9]{4})-[0-9]+$') AS anio,
    MAX((SUBSTRING(folio FROM '^TRM-[0-9]{4}-([0-9]+)$'))::INT) AS max_seq
  FROM solicitudes
  WHERE folio ~ '^TRM-[0-9]{4}-[0-9]+$'
  GROUP BY SUBSTRING(folio FROM '^TRM-([0-9]{4})-[0-9]+$')
)
UPDATE solicitudes s
SET folio = 'TRM-' ||
  TO_CHAR(ssf.fecha, 'YYYY') ||
  '-' ||
  LPAD((COALESCE(me.max_seq, 0) + ssf.rn)::TEXT, 5, '0')
FROM solicitudes_sin_folio ssf
LEFT JOIN maximo_existente me
  ON me.anio = TO_CHAR(ssf.fecha, 'YYYY')
WHERE s.id = ssf.id;

ALTER TABLE solicitudes
  ALTER COLUMN folio SET NOT NULL;
