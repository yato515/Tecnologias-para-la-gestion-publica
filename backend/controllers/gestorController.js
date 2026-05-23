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
      let query = supabase
        .from('solicitudes')
        .select(`
          *,
          ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp),
          tramite:tramites_catalogo(nombre, plazo_dias_habiles),
          dependencia:dependencias(nombre)
        `);

      if (dependencia_id && dependencia_id !== 'null' && dependencia_id !== 'undefined') {
        query = query.eq('dependencia_id', dependencia_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let mappedData = data;

      // Filtrar en memoria por municipio y tipo_solicitud si están presentes
      if (tipo_solicitud && tipo_solicitud !== 'null' && tipo_solicitud !== 'undefined') {
        const tipoLower = tipo_solicitud.toLowerCase();
        mappedData = mappedData.filter(r => 
          r.tramite && r.tramite.nombre && r.tramite.nombre.toLowerCase().includes(tipoLower)
        );
      }

      if (municipio && municipio !== 'null' && municipio !== 'undefined') {
        const muniLower = municipio.toLowerCase();
        mappedData = mappedData.filter(r => {
          const resp = JSON.stringify(r.campos_respuesta || {}).toLowerCase();
          return resp.includes(muniLower);
        });
      }
      if (supabaseAdmin) {
        try {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
          if (!userError && userData && userData.users) {
            const usersMap = {};
            userData.users.forEach(u => {
              usersMap[u.id] = u.email;
            });
            mappedData = mappedData.map(s => {
              if (s.ciudadano) {
                return {
                  ...s,
                  ciudadano: {
                    ...s.ciudadano,
                    email: usersMap[s.ciudadano.id] || 'demo-citizen-id@yucatan.gob.mx'
                  }
                };
              }
              return s;
            });
          }
        } catch (e) {
          console.error("Error listing users from auth to map emails:", e);
        }
      }

      // Apply filters for tipo_solicitud and municipio in mappedData
      if (tipo_solicitud && tipo_solicitud !== 'null' && tipo_solicitud !== 'undefined' && tipo_solicitud !== '') {
        mappedData = mappedData.filter(s => {
          const name = s.tramite?.nombre || '';
          return name.toLowerCase().includes(tipo_solicitud.toLowerCase()) || s.tramite_id === tipo_solicitud;
        });
      }

      if (municipio && municipio !== 'null' && municipio !== 'undefined' && municipio !== '') {
        mappedData = mappedData.filter(s => {
          const campos = s.campos_respuesta || {};
          const cMuni = campos.municipio || campos.lugar || '';
          const cDir = campos.direccion || '';
          const citizenMuni = s.ciudadano?.municipio || '';
          return cMuni.toLowerCase().includes(municipio.toLowerCase()) ||
                 cDir.toLowerCase().includes(municipio.toLowerCase()) ||
                 citizenMuni.toLowerCase().includes(municipio.toLowerCase());
        });
      }

      return res.status(200).json({ success: true, data: mappedData });
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
      let query = supabase.from('solicitudes').select(`
        *,
        tramite:tramites_catalogo(nombre),
        ciudadano:perfiles!ciudadano_id(nombre_completo, email)
      `);
      if (isUUID) {
        query = query.eq('id', id);
      } else {
        query = query.eq('folio', id);
      }
      
      const { data: solicitud, error: errGet } = await query.maybeSingle();
      if (errGet) throw errGet;
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
      const { data, error } = await supabase
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
