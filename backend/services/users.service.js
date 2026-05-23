import { supabase } from '../config/supabase.service.js';

export const UsersService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // id debe ser el UUID del usuario ya registrado en auth.users
  create: async ({ id, nombre_completo, curp, telefono, rol, dependencia_id }) => {
    const { data, error } = await supabase
      .from('perfiles')
      .insert([{ id, nombre_completo, curp, telefono, rol, dependencia_id }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('perfiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('perfiles')
      .delete()
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getByCurp: async (curp) => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('curp', curp)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};
