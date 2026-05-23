import { supabase, supabaseAdmin } from '../config/supabase.service.js';
import { SolicitudesService } from '../services/solicitudes.service.js';

const ensureBucketExists = async () => {
  try {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn("Advertencia: SUPABASE_SERVICE_KEY no está definida en .env. Se intentará asegurar el bucket usando la clave pública, lo cual puede fallar por políticas RLS.");
    }
    const { data: buckets, error: getError } = await client.storage.listBuckets();
    if (getError) throw getError;
    const exists = buckets.some(b => b.name === 'documentos');
    if (!exists) {
      const { error: createError } = await client.storage.createBucket('documentos', {
        public: false,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) throw createError;
      console.log("Bucket 'documentos' creado exitosamente.");
    }
  } catch (err) {
    // Error ignorado silenciosamente para no confundir al usuario en la terminal
    // ya que el servidor puede seguir funcionando sin la clave de administrador.
  }
};

// Ejecutar al iniciar
ensureBucketExists();

export const TramiteController = {

  // GET /api/tramites/catalogo
  getCatalogo: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('tramites_catalogo')
        .select('*')
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

      if (!ciudadano_id) {
        return res.status(400).json({ success: false, message: 'ciudadano_id es requerido' });
      }

      const year = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000);
      const folio = `TRM-${year}-${random}`;

      const client = supabaseAdmin || supabase;
      const { data, error } = await client
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

      const targetSolicitudId = (id && id !== 'null' && id !== 'undefined') ? id : null;

      const { data, error } = await supabase
        .from('documentos')
        .insert([{ 
          solicitud_id: targetSolicitudId, 
          nombre, 
          storage_path, 
          subido_por,
          usuario_id: req.user ? req.user.id : subido_por,
          vigente: true
        }])
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
      const identifier = decodeURIComponent(folio || '').trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      const client = supabaseAdmin || supabase;

      let query = client
        .from('solicitudes')
        .select('*, tramite:tramites_catalogo(nombre), dependencia:dependencias(nombre), ciudadano:perfiles!ciudadano_id(id, nombre_completo, curp)');

      query = isUUID ? query.eq('id', identifier) : query.eq('folio', identifier);
      const { data: rows, error } = await query.limit(1);
      if (error) throw error;
      const data = rows && rows.length > 0 ? rows[0] : null;
      if (!data) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });

      // Enriquecer con email del ciudadano desde auth
      let enriched = data;
      if (supabaseAdmin && data.ciudadano_id) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.ciudadano_id);
          if (authUser?.user?.email) {
            enriched = { ...data, ciudadano: data.ciudadano ? { ...data.ciudadano, email: authUser.user.email } : { email: authUser.user.email } };
          }
        } catch (_) {}
      }

      // Adjuntar audit log de la solicitud
      const { data: auditRows } = await client
        .from('audit_log')
        .select('*')
        .eq('solicitud_id', data.id)
        .order('created_at', { ascending: false });

      return res.status(200).json({ success: true, data: { ...enriched, audit_log: auditRows || [] } });
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
