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

<<<<<<< HEAD
      // ============================================================
      // 🚀 ESCUDO DE SÚPERVIVENCIA PARA EL HACKATÓN
      // Si Supabase se pone estricto con el RLS o caché de red, el backend
      // deduce el rol mediante el correo para que la demo no se rompa.
      // ============================================================
      let rolFinal = userProfile ? userProfile.rol : 'ciudadano';
      let nombreFinal = userProfile ? userProfile.nombre_completo : 'Usuario';

      if (profileError || !userProfile) {
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
=======
      let profile = userProfile;
      if (profileError || !userProfile) {
        // Auto-create profile if missing
        let rolToAssign = 'revisor';
        let nameToAssign = 'Servidor Público';
        if (authData.user.email === 'director@yucatan.gob.mx' || authData.user.email === 'admin_director@yucatan.gob.mx') {
          rolToAssign = 'aprobador';
          nameToAssign = 'Director General';
        } else if (authData.user.email === 'revisor@yucatan.gob.mx') {
          rolToAssign = 'revisor';
          nameToAssign = 'Revisor Operativo';
        }

        const { data: newProfile, error: insErr } = await supabase.from('perfiles').insert([{
          id: authData.user.id,
          nombre_completo: nameToAssign,
          rol: rolToAssign,
          dependencia_id: null
        }]).select().single();

        if (insErr) {
          return res.status(500).json({ success: false, message: 'Error al auto-crear perfil: ' + insErr.message });
        }
        profile = newProfile;
>>>>>>> f02364ec11e3236f39429ffa33b48e0143c3a4a8
      }

      // Respetamos la estructura exacta que configuró tu equipo (sin token para gestores)
      return res.status(200).json({ 
        success: true, 
        user: { 
<<<<<<< HEAD
          id: userProfile ? userProfile.id : authData.user.id, 
          email: authData.user.email, 
          nombre: nombreFinal,
          rol: rolFinal 
=======
          id: profile.id, 
          email: authData.user.email, 
          nombre: profile.nombre_completo,
          rol: profile.rol 
>>>>>>> f02364ec11e3236f39429ffa33b48e0143c3a4a8
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
      const { email, password, rol, nombre_completo, director_email } = req.body;
      
<<<<<<< HEAD
      if (director_email !== 'director@yucatan.gob.mx') {
=======
      // Control de acceso súper simplificado (ya que no hay token)
      if (director_email !== 'director@yucatan.gob.mx' && director_email !== 'admin_director@yucatan.gob.mx') {
>>>>>>> f02364ec11e3236f39429ffa33b48e0143c3a4a8
        return res.status(403).json({ success: false, message: 'Acceso denegado. Solo el Director puede registrar cuentas.' });
      }

      if (!email || !password || !rol || !nombre_completo) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError || !authData.user) {
        return res.status(400).json({ success: false, message: authError?.message || 'Error al registrar credenciales.' });
      }

<<<<<<< HEAD
      const { error: profileError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        nombre_completo,
        rol,
        dependencia_id: 1 
=======
      // Mapear el rol a minúscula para cumplir con el enum de la base de datos
      const rolMapeado = rol.toLowerCase();

      // 2. Insertar perfil
      const { error: profileError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        nombre_completo,
        rol: rolMapeado,
        dependencia_id: null
>>>>>>> f02364ec11e3236f39429ffa33b48e0143c3a4a8
      }]);

      if (profileError) {
        return res.status(500).json({ success: false, message: 'Error al asignar rol: ' + profileError.message });
      }

      return res.status(201).json({ success: true, message: 'Cuenta creada exitosamente.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};