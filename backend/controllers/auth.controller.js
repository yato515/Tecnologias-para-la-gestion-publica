import { supabase, supabaseAdmin } from '../config/supabase.service.js';

const verificarDocumentosVigentes = async (userId) => {
  const { data, error } = await supabase
    .from('documentos')
    .select('vigente')
    .eq('usuario_id', userId)
    .eq('vigente', true);

  if (error) throw new Error('Error al verificar documentos');
  return data && data.length > 0;
};

const generarToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

export const AuthController = {
  // ==========================================
  // LOGIN BLINDADO (CON MODO CONTINGENCIA)
  // ==========================================
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
      }

      // 1. Autenticar con el sistema nativo de Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      // 2. Intentar traer los datos extras desde tu tabla 'perfiles'
      const { data: userProfile, error: profileError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      // ============================================================
      // 🚀 ESCUDO DE SÚPERVIVENCIA PARA EL HACKATÓN
      // Si Supabase se pone estricto con el RLS o caché de red, el backend
      // deduce el rol mediante el correo para que la demo no se rompa.
      // ============================================================
      let rolFinal = userProfile ? userProfile.rol : 'ciudadano';
      let nombreFinal = userProfile ? userProfile.nombre_completo : 'Usuario';

      // ============================================================
      // FORZAR ROL PARA EL DIRECTOR POR SI SE SOBREESCRIBIÓ EN BD
      // ============================================================
      if (email === 'director@yucatan.gob.mx') {
        rolFinal = 'aprobador';
        nombreFinal = 'Director General';
      } else if (profileError || !userProfile) {
        console.log("-> [CONTINGENCIA] Perfil oculto en BD. Deduciendo por correo institucional...");
        
        if (email.includes('revisor')) {
          rolFinal = 'revisor';
          nombreFinal = 'Revisor Catastro';
        } else if (email.includes('director')) {
          rolFinal = 'aprobador';
          nombreFinal = 'Director General';
        } else if (!email.includes('yucatan.gob')) {
          // Si es un ciudadano común y corriente y de verdad no existe, dejamos el 404
          return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
        }
      }

      // Recuperar tipo_solicitud y municipio de user_metadata (por si las columnas no existen en perfiles)
      const tipo_solicitud = userProfile?.tipo_solicitud || authData.user.user_metadata?.tipo_solicitud || null;
      const municipio = userProfile?.municipio || authData.user.user_metadata?.municipio || null;

      // Retornar todos los datos de sesión del gestor
      return res.status(200).json({ 
        success: true, 
        user: { 
          id: userProfile ? userProfile.id : authData.user.id, 
          email: authData.user.email, 
          nombre: nombreFinal,
          rol: rolFinal,
          dependencia_id: userProfile ? userProfile.dependencia_id : null,
          tipo_solicitud,
          municipio
        } 
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  renovarToken: async (req, res) => {
    try {
      const { id, email } = req.user; 

      const documentosVigentes = await verificarDocumentosVigentes(id);
      if (!documentosVigentes) {
        return res.status(403).json({ success: false, message: 'No se puede renovar el token: documentos no vigentes' });
      }

      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('id, nombre_completo')
        .eq('id', id)
        .single();

      if (error || !perfil) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      const userPayload = { id, email, nombre: perfil.nombre_completo };
      const token = generarToken(userPayload);
      return res.status(200).json({ success: true, token });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  recuperarPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email requerido' });
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(200).json({ success: true, message: 'Correo enviado' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  resetManualPassword: async (req, res) => {
    try {
      const { email, new_password } = req.body;
      if (!email || !new_password) {
        return res.status(400).json({ success: false, message: 'Email y nueva contraseña son requeridos' });
      }

      if (!supabaseAdmin) {
        return res.status(403).json({ success: false, message: 'Falta la llave de servicio de Supabase (SUPABASE_SERVICE_KEY) en el .env. Es obligatorio para cambiar contraseñas directamente sin correo electrónico.' });
      }

      // 1. Encontrar el usuario por email usando admin auth
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) return res.status(500).json({ success: false, message: 'Error buscando usuario: ' + listError.message });
      
      const userToUpdate = listData.users.find(u => u.email === email);
      if (!userToUpdate) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado en la plataforma de autenticación' });
      }

      // 2. Actualizar contraseña directamente
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userToUpdate.id, {
        password: new_password
      });

      if (updateError) {
        return res.status(500).json({ success: false, message: 'Error al actualizar contraseña: ' + updateError.message });
      }

      return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  registrarGestor: async (req, res) => {
    try {
      const { email, password, rol, nombre_completo, director_email, dependencia_id, tipo_solicitud, municipio } = req.body;
      
      if (director_email !== 'director@yucatan.gob.mx') {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Solo el Director puede registrar cuentas.' });
      }

      if (!email || !password || !rol || !nombre_completo) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
      }

      // Normalizar el rol a minúsculas para que coincida con los valores de la BD
      const rolNormalizado = String(rol).toLowerCase();

      // 1. Crear usuario en Supabase Auth (guarda municipio/tramite en metadata)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre_completo,
            rol: rolNormalizado,
            tipo_solicitud: tipo_solicitud || null,
            municipio: municipio || null
          }
        }
      });

      if (authError) {
        return res.status(400).json({ success: false, message: authError.message });
      }
      if (!authData.user) {
        return res.status(400).json({ success: false, message: 'No se pudo crear el usuario.' });
      }

      // Detectar email duplicado (Supabase devuelve identities vacío en ese caso)
      if (authData.user.identities && authData.user.identities.length === 0) {
        return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado.' });
      }

      // 2. Insertar en la tabla perfiles (solo columnas que SÍ existen en la BD)
      const { error: profileError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        nombre_completo,
        rol: rolNormalizado,
        dependencia_id: (dependencia_id && dependencia_id !== 'null' && dependencia_id !== 'undefined') ? dependencia_id : null
      }]);

      if (profileError) {
        console.error('[registrarGestor] Error al insertar perfil:', profileError.message);
        // El usuario ya existe en Auth, así que avisamos pero NO bloqueamos
        return res.status(201).json({
          success: true,
          message: 'Usuario creado en el sistema de autenticación. Perfil pendiente de sincronización.',
          warning: profileError.message
        });
      }

      return res.status(201).json({ success: true, message: `Cuenta de ${rolNormalizado} creada exitosamente.` });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};