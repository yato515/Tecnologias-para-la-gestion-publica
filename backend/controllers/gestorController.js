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
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          *,
          ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp),
          tramite:tramites_catalogo(nombre, plazo_dias_habiles),
          dependencia:dependencias(nombre)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      let mappedData = data;
      if (supabaseAdmin) {
        try {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
          if (!userError && userData && userData.users) {
            const usersMap = {};
            userData.users.forEach(u => {
              usersMap[u.id] = u.email;
            });
            mappedData = data.map(s => {
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

      return res.status(200).json({ success: true, data: mappedData });
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
        ciudadano:perfiles!ciudadano_id(nombre_completo)
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
        let recipientEmail = correo_destinatario;
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
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // PUT /api/gestores/personal/:id
  updatePersonal: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre_completo, rol, director_email } = req.body;

      // Basic auth check
      if (director_email !== 'director@yucatan.gob.mx' && director_email !== 'admin_director@yucatan.gob.mx') {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      if (!nombre_completo || !rol) {
        return res.status(400).json({ success: false, message: 'Faltan campos' });
      }

      const rolMapeado = rol.toLowerCase();

      const { data, error } = await supabase
        .from('perfiles')
        .update({ nombre_completo, rol: rolMapeado })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return res.status(200).json({ success: true, data });
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
