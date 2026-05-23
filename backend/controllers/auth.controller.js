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
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
      }

      // 1. Autenticar con el sistema nativo de Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      // 2. Traer los datos extras desde tu tabla 'perfiles'
      const { data: userProfile, error: profileError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

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
      }

      // Se elimina la generación de token para gestores por instrucción explícita
      return res.status(200).json({ 
        success: true, 
        user: { 
          id: profile.id, 
          email: authData.user.email, 
          nombre: profile.nombre_completo,
          rol: profile.rol 
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
      
      // Control de acceso súper simplificado (ya que no hay token)
      if (director_email !== 'director@yucatan.gob.mx') {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Solo el Director puede registrar cuentas.' });
      }

      if (!email || !password || !rol || !nombre_completo) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
      }

      // 1. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError || !authData.user) {
        return res.status(400).json({ success: false, message: authError?.message || 'Error al registrar credenciales.' });
      }

      // Mapear el rol a minúscula para cumplir con el enum de la base de datos
      const rolMapeado = rol.toLowerCase();

      // 2. Insertar perfil
      const { error: profileError } = await supabase.from('perfiles').insert([{
        id: authData.user.id,
        nombre_completo,
        rol: rolMapeado,
        dependencia_id: null
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