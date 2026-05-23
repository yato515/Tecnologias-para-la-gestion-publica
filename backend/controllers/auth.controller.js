import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.service.js';

export const AuthController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
      }

      const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      return res.status(200).json({ success: true, token, user: { id: user.id, email: user.email, nombre: user.nombre } });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
