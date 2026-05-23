import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.service.js';

// Stub: cuando se integre la IA/PLN, reemplazar con la validación real de documentos
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

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !userProfile) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      }

      // Para el JWT token interno, podemos usar el ID y email
      const token = generarToken({ id: userProfile.id, email: authData.user.email });
      return res.status(200).json({ 
        success: true, 
        token, 
        user: { 
          id: userProfile.id, 
          email: authData.user.email, 
          nombre: userProfile.nombre_completo,
          rol: userProfile.rol 
        } 
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  renovarToken: async (req, res) => {
    try {
      const { id, email } = req.user; // viene del middleware verifyToken

      const documentosVigentes = await verificarDocumentosVigentes(id);
      if (!documentosVigentes) {
        return res.status(403).json({ success: false, message: 'No se puede renovar el token: documentos no vigentes' });
      }

      const { data: user, error } = await supabase
        .from('usuarios')
        .select('id, email, nombre')
        .eq('id', id)
        .single();

      if (error || !user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      const token = generarToken(user);
      return res.status(200).json({ success: true, token });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
