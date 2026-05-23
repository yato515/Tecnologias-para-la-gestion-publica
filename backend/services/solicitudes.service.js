import { supabase, supabaseAdmin } from '../config/supabase.service.js';

export const SolicitudesService = {
  crearSolicitud: async (data) => {
    const { ciudadano_id, tramite_id, dependencia_id, campos_respuesta } = data;

    if (!ciudadano_id) {
      const error = new Error('ciudadano_id es requerido');
      error.status = 400;
      throw error;
    }

    const client = supabaseAdmin || supabase;
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const random = Math.floor(1000 + Math.random() * 9000);
      const folio = `TRM-${year}-${random}`;

      const { data: nuevaSolicitud, error } = await client
        .from('solicitudes')
        .insert([{
          folio,
          ciudadano_id,
          tramite_id: tramite_id || null,
          dependencia_id: dependencia_id || null,
          campos_respuesta: campos_respuesta || {},
          estado: 'recibido'
        }])
        .select()
        .single();

      if (!error) return nuevaSolicitud;

      if (error.code !== '23505' || attempt === 4) {
        const err = new Error(error.message);
        err.status = 500;
        throw err;
      }
    }

    const err = new Error('No se pudo generar un folio unico para la solicitud');
    err.status = 500;
    throw err;
  },

  obtenerPorFolio: async (folio) => {
    const identifier = decodeURIComponent(folio || '').trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const client = supabaseAdmin || supabase;
    let query = client
      .from('solicitudes')
      .select('*, tramite:tramites_catalogo(nombre), dependencia:dependencias(nombre), ciudadano:perfiles!ciudadano_id(nombre_completo)');

    query = isUUID ? query.eq('id', identifier) : query.eq('folio', identifier);

    const { data, error } = await query.maybeSingle();

    if (error) {
      const err = new Error(error.message);
      err.status = 500;
      throw err;
    }

    if (!data) {
      const err = new Error('Solicitud no encontrada');
      err.status = 404;
      throw err;
    }

    return data;
  },

  obtenerPorCiudadano: async (ciudadano_id) => {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*, tramite:tramites_catalogo(nombre), dependencia:dependencias(nombre)')
      .eq('ciudadano_id', ciudadano_id)
      .order('created_at', { ascending: false });

    if (error) {
      const err = new Error(error.message);
      err.status = 500;
      throw err;
    }

    return data || [];
  },

  actualizarEstado: async (id, datosActualizacion) => {
    const { estado_nuevo } = datosActualizacion;

    if (!estado_nuevo) {
      const err = new Error('estado_nuevo es requerido');
      err.status = 400;
      throw err;
    }

    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('solicitudes')
      .update({ estado: estado_nuevo })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = 500;
      throw err;
    }

    return data;
  }
};
