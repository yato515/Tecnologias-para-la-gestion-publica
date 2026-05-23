import { supabase } from '../config/supabase.service.js';

export const TramiteController = {

  // GET /api/tramites/catalogo
  getCatalogo: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('tramites_catalogo')
        .select('*, dependencia:dependencias(nombre)')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/tramites/solicitudes/:ciudadano_id
  getMisSolicitudes: async (req, res) => {
    try {
      const { ciudadano_id } = req.params;
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          *,
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
  },

  // POST /api/tramites/solicitudes
  crearSolicitud: async (req, res) => {
    try {
      const { ciudadano_id, tramite_id, dependencia_id, campos_respuesta } = req.body;

      if (!ciudadano_id || !tramite_id || !dependencia_id) {
        return res.status(400).json({
          success: false,
          message: 'ciudadano_id, tramite_id y dependencia_id son requeridos'
        });
      }

      const { data, error } = await supabase
        .from('solicitudes')
        .insert([{ ciudadano_id, tramite_id, dependencia_id, campos_respuesta: campos_respuesta || {} }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // POST /api/tramites/solicitudes/:id/documentos
  subirDocumento: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, storage_path, subido_por } = req.body;

      if (!nombre || !storage_path || !subido_por) {
        return res.status(400).json({
          success: false,
          message: 'nombre, storage_path y subido_por son requeridos'
        });
      }

      const { data, error } = await supabase
        .from('documentos')
        .insert([{ solicitud_id: id, nombre, storage_path, subido_por }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/tramites/solicitudes/:id/documentos
  getDocumentos: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('solicitud_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/tramites/solicitudes/folio/:folio
  getSolicitudByFolio: async (req, res) => {
    try {
      const { folio } = req.params;
      const { data, error } = await supabase
        .from('solicitudes')
        .select('*, tramite:tramites_catalogo(nombre), dependencia:dependencias(nombre), ciudadano:perfiles!ciudadano_id(nombre_completo, curp)')
        .eq('folio', folio)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // POST /api/tramites/solicitudes/:id/calificar
  calificar: async (req, res) => {
    try {
      const { id } = req.params;
      const { ciudadano_id, estrellas, comentario } = req.body;

      if (!ciudadano_id || !estrellas) {
        return res.status(400).json({ success: false, message: 'ciudadano_id y estrellas son requeridos' });
      }

      const { data, error } = await supabase
        .from('calificaciones')
        .insert([{ solicitud_id: id, ciudadano_id, estrellas, comentario }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
