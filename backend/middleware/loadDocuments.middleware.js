import { supabase } from '../config/supabase.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const loadDocuments = async (req, res, next) => {
  try {
    if (!req.user?.id || !UUID_REGEX.test(req.user.id)) {
      req.documentos = [];
      return next();
    }

    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('subido_por', req.user.id);

    if (error) throw error;
    req.documentos = data || [];
    next();
  } catch (error) {
    console.error('loadDocuments error:', error.message);
    req.documentos = [];
    next();
  }
};
