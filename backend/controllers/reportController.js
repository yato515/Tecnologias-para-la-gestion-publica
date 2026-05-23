import { supabase } from '../config/supabase.service.js';

export const ReportController = {

  // GET /api/reportes/resumen
  getResumen: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .select('estado');
      if (error) throw error;

      const resumen = data.reduce((acc, s) => {
        acc[s.estado] = (acc[s.estado] || 0) + 1;
        return acc;
      }, {});

      return res.status(200).json({ success: true, data: resumen });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/reportes/vencidas
  getVencidas: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          *,
          tramite:tramites_catalogo(nombre, plazo_dias_habiles),
          ciudadano:perfiles!ciudadano_id(nombre_completo)
        `)
        .not('estado', 'in', '("aprobado","rechazado")')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const hoy = new Date();
      const vencidas = data.filter(s => {
        const plazo = s.tramite?.plazo_dias_habiles || 5;
        const creado = new Date(s.created_at);
        const diff = Math.floor((hoy - creado) / (1000 * 60 * 60 * 24));
        return diff > plazo;
      });

      return res.status(200).json({ success: true, data: vencidas });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/reportes/calificaciones
  getCalificaciones: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('calificaciones')
        .select(`
          estrellas,
          comentario,
          created_at,
          solicitud:solicitudes(folio, tramite:tramites_catalogo(nombre))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const promedio = data.length
        ? (data.reduce((sum, c) => sum + c.estrellas, 0) / data.length).toFixed(2)
        : null;

      return res.status(200).json({ success: true, promedio, total: data.length, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
