import { supabaseAdmin } from '../config/supabase.service.js';

export const ExpedientesService = {
  // Obtiene el expediente de un ciudadano
  getByCiudadanoId: async (ciudadano_id) => {
    const { data, error } = await supabaseAdmin
      .from('expedientes_ciudadanos')
      .select('*')
      .eq('ciudadano_id', ciudadano_id)
      .maybeSingle(); // maybeSingle para que no lance error si no existe aún
    
    if (error) throw error;
    return data;
  },

  // Inserta o actualiza (upsert) el expediente
  upsert: async (ciudadano_id, updates) => {
    // Primero, verificamos si existe
    const existente = await ExpedientesService.getByCiudadanoId(ciudadano_id);
    
    if (existente) {
      // Si existe, actualizamos
      const { data, error } = await supabaseAdmin
        .from('expedientes_ciudadanos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('ciudadano_id', ciudadano_id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Si no existe, lo creamos
      const { data, error } = await supabaseAdmin
        .from('expedientes_ciudadanos')
        .insert([{ ciudadano_id, ...updates }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};
