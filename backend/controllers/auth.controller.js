import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.service.js';

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
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const userPayload = {
        id: authData.user.id,
        email: authData.user.email,
        nombre: perfil ? perfil.nombre_completo : 'Usuario'
      };

      const token = generarToken(userPayload);
      return res.status(200).json({ success: true, token, user: userPayload });
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
  }
};