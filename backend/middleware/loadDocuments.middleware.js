import { supabase } from '../config/supabase.service.js';

export const loadDocuments = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('usuario_id', req.user.id);

    if (error) throw error;

    req.documentos = data || [];
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al cargar documentos del usuario' });
  }
};
