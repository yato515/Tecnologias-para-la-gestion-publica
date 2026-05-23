import { supabase } from '../config/supabase.service.js';

export const TramitesService = {
  obtenerCatalogo: async () => {
    const { data, error } = await supabase
      .from('tramites_catalogo')
      .select('*, dependencia:dependencias(nombre)')
      .eq('activo', true)
      .order('nombre');
      
    if (error) {
      const err = new Error(error.message);
      err.status = 500;
      throw err;
    }
    
    return data;
  }
};
