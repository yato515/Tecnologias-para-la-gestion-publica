-- ============================================================
-- PASO 1: ENUMs
-- ============================================================
CREATE TYPE rol_usuario AS ENUM ('ciudadano', 'revisor', 'aprobador');
CREATE TYPE estado_solicitud AS ENUM (
  'recibido',
  'en_revision',
  'documentacion_incompleta',
  'aprobado',
  'rechazado'
);

-- ============================================================
-- PASO 2: dependencias (raíz, sin FK)
-- ============================================================
CREATE TABLE dependencias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  clave      TEXT UNIQUE NOT NULL,
  activa     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 3: perfiles (extiende auth.users)
-- perfiles.id = auth.users.id — mismo UUID
-- ============================================================
CREATE TABLE perfiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dependencia_id UUID REFERENCES dependencias(id),
  rol            rol_usuario NOT NULL DEFAULT 'ciudadano',
  curp           TEXT,
  nombre_completo TEXT,
  telefono       TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 4: tramites_catalogo
-- JSONB para formulario dinámico sin migraciones futuras
-- ============================================================
CREATE TABLE tramites_catalogo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependencia_id    UUID NOT NULL REFERENCES dependencias(id),
  nombre            TEXT NOT NULL,
  descripcion       TEXT,
  requisitos        JSONB DEFAULT '[]',
  campos_formulario JSONB DEFAULT '[]',
  plazo_dias_habiles INT DEFAULT 5,
  activo            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 5: plantillas_rechazo
-- ============================================================
CREATE TABLE plantillas_rechazo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependencia_id UUID NOT NULL REFERENCES dependencias(id),
  titulo         TEXT NOT NULL,
  cuerpo         TEXT NOT NULL,
  activa         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 6: solicitudes
-- folio se genera con trigger — evita race conditions
-- ============================================================
CREATE TABLE solicitudes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio          TEXT UNIQUE,
  ciudadano_id   UUID NOT NULL REFERENCES perfiles(id),
  tramite_id     UUID NOT NULL REFERENCES tramites_catalogo(id),
  dependencia_id UUID NOT NULL REFERENCES dependencias(id),
  estado         estado_solicitud NOT NULL DEFAULT 'recibido',
  campos_respuesta JSONB DEFAULT '{}',
  asignado_a     UUID REFERENCES perfiles(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 7a: documentos
-- Solo guarda storage_path — el archivo vive en Supabase Storage
-- ============================================================
CREATE TABLE documentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  subido_por   UUID NOT NULL REFERENCES perfiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 7b: audit_log (append-only — nunca UPDATE ni DELETE)
-- ============================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id    UUID NOT NULL REFERENCES solicitudes(id),
  usuario_id      UUID NOT NULL REFERENCES perfiles(id),
  estado_anterior estado_solicitud,
  estado_nuevo    estado_solicitud,
  ip              TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 7c: mensajes (hilo por trámite)
-- ============================================================
CREATE TABLE mensajes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  autor_id     UUID NOT NULL REFERENCES perfiles(id),
  cuerpo       TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 7d: calificaciones (1:1 con solicitud)
-- ============================================================
CREATE TABLE calificaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL UNIQUE REFERENCES solicitudes(id) ON DELETE CASCADE,
  ciudadano_id UUID NOT NULL REFERENCES perfiles(id),
  estrellas    SMALLINT NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 9: Función para folio TRM-YYYY-NNNNN
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio()
RETURNS TRIGGER AS $$
DECLARE
  anio       TEXT;
  secuencia  INT;
BEGIN
  anio := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO secuencia
  FROM solicitudes
  WHERE TO_CHAR(created_at, 'YYYY') = anio;
  NEW.folio := 'TRM-' || anio || '-' || LPAD(secuencia::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PASO 10: Trigger auto-folio en INSERT
-- ============================================================
CREATE TRIGGER trigger_generar_folio
  BEFORE INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION generar_folio();

-- ============================================================
-- PASO 11: Índices
-- ============================================================
CREATE INDEX idx_solicitudes_folio      ON solicitudes(folio);
CREATE INDEX idx_solicitudes_estado     ON solicitudes(estado);
CREATE INDEX idx_solicitudes_dependencia ON solicitudes(dependencia_id);
CREATE INDEX idx_solicitudes_ciudadano  ON solicitudes(ciudadano_id);
CREATE INDEX idx_audit_log_solicitud    ON audit_log(solicitud_id);
CREATE INDEX idx_mensajes_solicitud     ON mensajes(solicitud_id);

-- ============================================================
-- PASO 12: Habilitar Realtime en solicitudes
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE solicitudes;

-- ============================================================
-- PASO 8: Row Level Security
-- ============================================================

ALTER TABLE dependencias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tramites_catalogo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_rechazo ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones     ENABLE ROW LEVEL SECURITY;

-- Helpers (SECURITY DEFINER para evitar recursión RLS)
CREATE OR REPLACE FUNCTION get_mi_rol()
RETURNS rol_usuario AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_mi_dependencia()
RETURNS UUID AS $$
  SELECT dependencia_id FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- DEPENDENCIAS: lectura para todos los autenticados
CREATE POLICY "dep_read" ON dependencias
  FOR SELECT TO authenticated USING (true);

-- PERFILES: cada usuario gestiona solo el suyo
CREATE POLICY "per_select" ON perfiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "per_insert" ON perfiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "per_update" ON perfiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- TRAMITES_CATALOGO: lectura pública, escritura solo aprobador
CREATE POLICY "cat_read" ON tramites_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_write" ON tramites_catalogo
  FOR ALL TO authenticated USING (get_mi_rol() = 'aprobador');

-- PLANTILLAS_RECHAZO: gestores de la misma dependencia
CREATE POLICY "plant_read" ON plantillas_rechazo
  FOR SELECT TO authenticated
  USING (dependencia_id = get_mi_dependencia());
CREATE POLICY "plant_write" ON plantillas_rechazo
  FOR ALL TO authenticated
  USING (get_mi_rol() = 'aprobador');

-- SOLICITUDES: ciudadano ve las suyas; gestor ve las de su dependencia
CREATE POLICY "sol_ciudadano_select" ON solicitudes
  FOR SELECT TO authenticated
  USING (ciudadano_id = auth.uid());

CREATE POLICY "sol_gestor_select" ON solicitudes
  FOR SELECT TO authenticated
  USING (
    get_mi_rol() IN ('revisor', 'aprobador')
    AND dependencia_id = get_mi_dependencia()
  );

CREATE POLICY "sol_insert" ON solicitudes
  FOR INSERT TO authenticated
  WITH CHECK (ciudadano_id = auth.uid() AND get_mi_rol() = 'ciudadano');

CREATE POLICY "sol_update_gestor" ON solicitudes
  FOR UPDATE TO authenticated
  USING (
    get_mi_rol() IN ('revisor', 'aprobador')
    AND dependencia_id = get_mi_dependencia()
  );

-- DOCUMENTOS: participantes de la solicitud
CREATE POLICY "doc_select" ON documentos
  FOR SELECT TO authenticated
  USING (
    solicitud_id IN (
      SELECT id FROM solicitudes
      WHERE ciudadano_id = auth.uid()
         OR (dependencia_id = get_mi_dependencia()
             AND get_mi_rol() IN ('revisor', 'aprobador'))
    )
  );

CREATE POLICY "doc_insert" ON documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    subido_por = auth.uid()
    AND solicitud_id IN (
      SELECT id FROM solicitudes
      WHERE ciudadano_id = auth.uid()
         OR (dependencia_id = get_mi_dependencia()
             AND get_mi_rol() IN ('revisor', 'aprobador'))
    )
  );

-- AUDIT_LOG: inserta el backend (service_role); lectura solo aprobador
CREATE POLICY "audit_read" ON audit_log
  FOR SELECT TO authenticated
  USING (get_mi_rol() = 'aprobador');

-- MENSAJES: participantes de la solicitud
CREATE POLICY "msg_select" ON mensajes
  FOR SELECT TO authenticated
  USING (
    solicitud_id IN (
      SELECT id FROM solicitudes
      WHERE ciudadano_id = auth.uid()
         OR (dependencia_id = get_mi_dependencia()
             AND get_mi_rol() IN ('revisor', 'aprobador'))
    )
  );

CREATE POLICY "msg_insert" ON mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND solicitud_id IN (
      SELECT id FROM solicitudes
      WHERE ciudadano_id = auth.uid()
         OR (dependencia_id = get_mi_dependencia()
             AND get_mi_rol() IN ('revisor', 'aprobador'))
    )
  );

-- CALIFICACIONES: ciudadano inserta la suya; gestores leen
CREATE POLICY "cal_insert" ON calificaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    ciudadano_id = auth.uid()
    AND solicitud_id IN (
      SELECT id FROM solicitudes WHERE ciudadano_id = auth.uid()
    )
  );

CREATE POLICY "cal_select" ON calificaciones
  FOR SELECT TO authenticated
  USING (
    ciudadano_id = auth.uid()
    OR solicitud_id IN (
      SELECT id FROM solicitudes
      WHERE dependencia_id = get_mi_dependencia()
        AND get_mi_rol() IN ('revisor', 'aprobador')
    )
  );
