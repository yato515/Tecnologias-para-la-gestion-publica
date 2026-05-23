import { supabase } from '../config/supabase.service.js';

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
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // PATCH /api/gestores/solicitudes/:id/estado
  cambiarEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const { estado_nuevo, notas, usuario_id, ip } = req.body;

      if (!estado_nuevo || !usuario_id) {
        return res.status(400).json({ success: false, message: 'estado_nuevo y usuario_id son requeridos' });
      }

      // Obtener estado actual
      const { data: solicitud, error: errGet } = await supabase
        .from('solicitudes')
        .select('estado')
        .eq('id', id)
        .single();
      if (errGet) throw errGet;

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
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Insertar en audit_log (service_role requerido en producción)
      await supabase.from('audit_log').insert([{
        solicitud_id: id,
        usuario_id,
        estado_anterior: solicitud.estado,
        estado_nuevo,
        ip: ip || null,
        notas: notas || null
      }]);

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
  }
};
