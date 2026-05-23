import { supabase } from '../config/supabase.service.js';

export const UsersService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (userData) => {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([userData])
      .select();
    if (error) throw error;
    return data[0];
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  }
};