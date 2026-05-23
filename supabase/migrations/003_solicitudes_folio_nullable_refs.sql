-- Align solicitudes with the backend creation path.
-- The backend may send a generated folio; the DB only generates one when it is missing.
-- tramite_id/dependencia_id are nullable to support draft/demo requests, but normal
-- citizen flows should continue sending both values for filtering and assignment.

ALTER TABLE solicitudes
  ALTER COLUMN tramite_id DROP NOT NULL,
  ALTER COLUMN dependencia_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION generar_folio()
RETURNS TRIGGER AS $$
DECLARE
  anio TEXT;
  secuencia INT;
BEGIN
  IF NEW.folio IS NOT NULL AND btrim(NEW.folio) <> '' THEN
    RETURN NEW;
  END IF;

  anio := TO_CHAR(COALESCE(NEW.created_at, NOW()), 'YYYY');

  PERFORM pg_advisory_xact_lock(hashtext('solicitudes_folio_' || anio));

  SELECT COALESCE(MAX((SUBSTRING(folio FROM '^TRM-[0-9]{4}-([0-9]+)$'))::INT), 0) + 1
  INTO secuencia
  FROM solicitudes
  WHERE folio ~ ('^TRM-' || anio || '-[0-9]+$');

  NEW.folio := 'TRM-' || anio || '-' || LPAD(secuencia::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
