import { supabase, supabaseAdmin } from '../config/supabase.service.js';

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

  // Hackathon: ya no requiere id de auth.users, se autogenera por la BD
  create: async ({ id, nombre_completo, curp, email, password, rol, dependencia_id }) => {
    const insertData = { nombre_completo, curp, email, password, rol, dependencia_id };
    if (id) insertData.id = id; // Solo si se pasa un id explícito
    
    const { data, error } = await supabaseAdmin
      .from('perfiles')
      .insert([insertData])
      .select()
      .single();
    if (error) {
      console.error("\n🔴 ERROR NATIVO DE SUPABASE AL INSERTAR:");
      console.error(JSON.stringify(error, null, 2));
      throw error;
    }
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
