import { supabase, supabaseAdmin } from '../config/supabase.service.js';
import { EmailService } from '../services/email.service.js';

const TRANSICIONES_VALIDAS = {
  recibido:                  ['en_revision'],
  en_revision:               ['documentacion_incompleta', 'aprobado', 'rechazado'],
  documentacion_incompleta:  ['en_revision'],
  aprobado:                  [],
  rechazado:                 []
};

export const GestorController = {

  // GET /api/gestores/solicitudes
  getSolicitudes: async (req, res) => {
    try {
      const { dependencia_id, tipo_solicitud, municipio } = req.query;
      const listClient = supabaseAdmin || supabase;
      let query = listClient
        .from('solicitudes')
        .select(`
          *,
          ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp),
          tramite:tramites_catalogo(nombre),
          dependencia:dependencias(nombre)
        `);

      if (dependencia_id && dependencia_id !== 'null' && dependencia_id !== 'undefined') {
        // Include solicitudes for this dependencia OR unassigned (dependencia_id IS NULL)
        query = query.or(`dependencia_id.eq.${dependencia_id},dependencia_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let mappedData = data;

      // Enriquecer emails desde auth si está disponible el admin client
      if (supabaseAdmin) {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
          if (userData?.users) {
            const usersMap = {};
            userData.users.forEach(u => { usersMap[u.id] = u.email; });
            mappedData = mappedData.map(s => ({
              ...s,
              ciudadano: s.ciudadano
                ? { ...s.ciudadano, email: usersMap[s.ciudadano.id] || null }
                : s.ciudadano
            }));
          }
        } catch (e) {}
      }

      // Filtro por tipo_solicitud: incluye solicitudes sin tramite asignado (tramite_id null)
      if (tipo_solicitud && tipo_solicitud !== 'null' && tipo_solicitud !== 'undefined') {
        const tipoLower = tipo_solicitud.toLowerCase();
        mappedData = mappedData.filter(s => {
          if (!s.tramite_id) return true; // sin tramite asignado, siempre mostrar
          const nombre = (s.tramite?.nombre || '').toLowerCase();
          const fallback = (s.campos_respuesta?.tramite_nombre_fallback || '').toLowerCase();
          return nombre.includes(tipoLower) || fallback.includes(tipoLower);
        });
      }

      // Filtro por municipio
      if (municipio && municipio !== 'null' && municipio !== 'undefined') {
        const muniLower = municipio.toLowerCase();
        mappedData = mappedData.filter(s => {
          const campos = s.campos_respuesta || {};
          return (campos.municipio || '').toLowerCase().includes(muniLower) ||
                 (campos.lugar || '').toLowerCase().includes(muniLower) ||
                 (campos.direccion || '').toLowerCase().includes(muniLower);
        });
      }

      return res.status(200).json({ success: true, data: mappedData });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/gestores/solicitudes/:id
  getSolicitud: async (req, res) => {
    try {
      const { id } = req.params;
      const identifier = decodeURIComponent(id || '').trim();

      if (!identifier || identifier === 'null' || identifier === 'undefined') {
        return res.status(400).json({ success: false, message: 'Folio o id de solicitud requerido' });
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      const selectFields = `
        *,
        ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp),
        tramite:tramites_catalogo(nombre),
        dependencia:dependencias(nombre)
      `;

      // Helper: run the query and return the first match
      const runQuery = async (client) => {
        let q = client.from('solicitudes').select(selectFields);
        q = isUUID ? q.eq('id', identifier) : q.eq('folio', identifier);
        q = q.limit(1);
        const { data: rows, error: err } = await q;
        return { data: rows && rows.length > 0 ? rows[0] : null, error: err };
      };

      // Try with regular client first (matches how getSolicitudes works)
      let { data, error } = await runQuery(supabase);

      // Retry with admin client if the regular client returned nothing
      if ((!data || error) && supabaseAdmin) {
        const adminResult = await runQuery(supabaseAdmin);
        if (!adminResult.error && adminResult.data) {
          data = adminResult.data;
          error = null;
        }
      }

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      }

      // Enrich with citizen email from auth
      if (supabaseAdmin && data.ciudadano_id) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.ciudadano_id);
          if (authUser?.user?.email) {
            data = {
              ...data,
              ciudadano: data.ciudadano
                ? { ...data.ciudadano, email: authUser.user.email }
                : { email: authUser.user.email }
            };
          }
        } catch (_) {}
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/gestores/dependencias
  getDependencias: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('dependencias')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // PATCH /api/gestores/solicitudes/:id/estado
  cambiarEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const { estado_nuevo, notas, usuario_id, ip, correo_destinatario, nombre_destinatario } = req.body;

      if (!estado_nuevo || !usuario_id) {
        return res.status(400).json({ success: false, message: 'estado_nuevo y usuario_id son requeridos' });
      }

      // Obtener estado actual (y ciudadano_id, tramite y dependencia para el correo)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const client = supabaseAdmin || supabase;
      let query = client.from('solicitudes').select(`
        *,
        tramite:tramites_catalogo(nombre),
        ciudadano:perfiles!ciudadano_id(nombre_completo, email)
      `);
      query = isUUID ? query.eq('id', id) : query.eq('folio', id);
      query = query.limit(1);

      const { data: rows, error: errGet } = await query;
      if (errGet) throw errGet;
      const solicitud = rows && rows.length > 0 ? rows[0] : null;
      if (!solicitud) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      }

      const transiciones = TRANSICIONES_VALIDAS[solicitud.estado] || [];
      if (!transiciones.includes(estado_nuevo)) {
        return res.status(400).json({
          success: false,
          message: `Transición inválida: ${solicitud.estado} → ${estado_nuevo}`
        });
      }

      // Actualizar estado
      const { data, error } = await client
        .from('solicitudes')
        .update({ estado: estado_nuevo, updated_at: new Date().toISOString() })
        .eq('id', solicitud.id)
        .select()
        .single();
      if (error) throw error;

      // Insertar en audit_log
      await supabase.from('audit_log').insert([{
        solicitud_id: solicitud.id,
        usuario_id,
        estado_anterior: solicitud.estado,
        estado_nuevo,
        ip: ip || null,
        notas: notas || null
      }]);

      // Enviar correo de confirmación de aprobación con Mailjet
      if (estado_nuevo === 'aprobado') {
        let recipientEmail = correo_destinatario || solicitud.ciudadano?.email;
        let recipientName = nombre_destinatario || solicitud.ciudadano?.nombre_completo || 'Ciudadano';

        // Intentar obtener email si no se envió en el body y supabaseAdmin está configurado
        if (!recipientEmail && supabaseAdmin) {
          try {
            const { data: authUser, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(solicitud.ciudadano_id);
            if (!authUserErr && authUser?.user) {
              recipientEmail = authUser.user.email;
            }
          } catch (e) {
            console.error("Error al obtener email del ciudadano en Auth:", e);
          }
        }

        // --- FALLBACK PARA PRUEBAS LOCALES ---
        // Si no se encuentra un correo en Supabase (ej. datos de prueba), usamos uno temporal de prueba.
        if (!recipientEmail && process.env.MAILJET_TEST_EMAIL) {
          recipientEmail = process.env.MAILJET_TEST_EMAIL;
        }

        // Si tenemos un correo válido, enviamos la notificación
        if (recipientEmail) {
          EmailService.sendApprovalEmail(
            recipientEmail,
            recipientName,
            solicitud.folio || solicitud.id,
            solicitud.tramite?.nombre || 'Trámite Solicitado'
          ).catch(err => console.error("Error asíncrono al enviar correo:", err));
        } else {
          console.warn("⚠️ No se pudo enviar correo de aprobación: no se especificó correo electrónico del destinatario.");
        }
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // POST /api/gestores/solicitudes/:id/mensajes
  enviarMensaje: async (req, res) => {
    try {
      const { id } = req.params;
      const { autor_id, cuerpo } = req.body;

      if (!autor_id || !cuerpo) {
        return res.status(400).json({ success: false, message: 'autor_id y cuerpo son requeridos' });
      }

      const { data, error } = await supabase
        .from('mensajes')
        .insert([{ solicitud_id: id, autor_id, cuerpo }])
        .select()
        .single();
      if (error) throw error;

      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/gestores/solicitudes/:id/mensajes
  getMensajes: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('mensajes')
        .select('*, autor:perfiles(nombre_completo, rol)')
        .eq('solicitud_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // PATCH /api/gestores/solicitudes/:id/asignar
  asignar: async (req, res) => {
    try {
      const { id } = req.params;
      const { asignado_a } = req.body;

      const { data, error } = await supabase
        .from('solicitudes')
        .update({ asignado_a, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/gestores/personal
  getPersonal: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .in('rol', ['revisor', 'aprobador']);
      if (error) throw error;

      let enrichedData = data;
      // Enrich with auth metadata (tipo_solicitud, municipio) when admin client is available
      if (supabaseAdmin && data && data.length > 0) {
        try {
          const { data: usersAuth } = await supabaseAdmin.auth.admin.listUsers();
          if (usersAuth && usersAuth.users) {
            const metaMap = {};
            usersAuth.users.forEach(u => {
              metaMap[u.id] = u.user_metadata || {};
            });
            enrichedData = data.map(p => ({
              ...p,
              tipo_solicitud: metaMap[p.id]?.tipo_solicitud || null,
              municipio: metaMap[p.id]?.municipio || null
            }));
          }
        } catch (e) {
          console.warn('[getPersonal] No se pudo obtener metadata de auth:', e.message);
        }
      }

      return res.status(200).json({ success: true, data: enrichedData });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // PUT /api/gestores/personal/:id
  updatePersonal: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre_completo, rol, director_email, dependencia_id, tipo_solicitud, municipio } = req.body;

      // Basic auth check
      if (director_email !== 'director@yucatan.gob.mx' && director_email !== 'admin_director@yucatan.gob.mx') {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      if (!nombre_completo || !rol) {
        return res.status(400).json({ success: false, message: 'Faltan campos' });
      }

      const rolMapeado = rol.toLowerCase();

      // Build perfiles update payload
      const perfilUpdate = { nombre_completo, rol: rolMapeado, updated_at: new Date().toISOString() };

      const { data, error } = await supabase
        .from('perfiles')
        .update(perfilUpdate)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;

      // Update tipo_solicitud and municipio in Supabase Auth user_metadata (requires service role)
      if (supabaseAdmin && (tipo_solicitud !== undefined || municipio !== undefined)) {
        try {
          const metaUpdate = {};
          if (tipo_solicitud !== undefined) metaUpdate.tipo_solicitud = tipo_solicitud || null;
          if (municipio !== undefined) metaUpdate.municipio = municipio || null;
          await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: metaUpdate });
        } catch (metaErr) {
          console.warn('[updatePersonal] No se pudo actualizar metadata de auth:', metaErr.message);
        }
      }

      return res.status(200).json({ success: true, data: { ...data, tipo_solicitud: tipo_solicitud || null, municipio: municipio || null } });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/gestores/ciudadano/:ciudadano_id/historial
  getHistorialCiudadano: async (req, res) => {
    try {
      const { ciudadano_id } = req.params;
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          id,
          folio,
          estado,
          created_at,
          tramite:tramites_catalogo(nombre),
          dependencia:dependencias(nombre)
        `)
        .eq('ciudadano_id', ciudadano_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
