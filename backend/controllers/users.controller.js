import { UsersService } from '../services/users.service.js';
import { supabase } from '../config/supabase.service.js'; 

export const UsersController = {
  getUsers: async (req, res) => {
    try {
      const users = await UsersService.getAll();
      return res.status(200).json({ success: true, data: users });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  createUser: async (req, res) => {
    try {
      const { id, nombre_completo, curp, telefono, rol, dependencia_id } = req.body;
      if (!id || !nombre_completo) {
        return res.status(400).json({ success: false, message: "id y nombre_completo son requeridos" });
      }
      const newUser = await UsersService.create({ id, nombre_completo, curp, telefono, rol, dependencia_id });
      return res.status(201).json({ success: true, data: newUser });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedUser = await UsersService.update(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }
      return res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedUser = await UsersService.delete(id);
      if (!deletedUser) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }
      return res.status(200).json({ success: true, message: "Usuario eliminado", data: deletedUser });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  loginByCurp: async (req, res) => {
    try {
      const { curp, email } = req.body;
      if (!curp) return res.status(400).json({ success: false, message: 'CURP requerido' });
      const user = await UsersService.getByCurp(curp);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  registerCitizen: async (req, res) => {
    try {
      const { curp, email, nombre_completo, password } = req.body;
      
      if (!curp || !nombre_completo || !email) {
        return res.status(400).json({ success: false, message: 'curp, email y nombre_completo son requeridos' });
      }

      const existing = await UsersService.getByCurp(curp);
      if (existing) return res.status(200).json({ success: true, data: existing });

      // Hackathon: Insertar directo en tabla perfiles sin Supabase Auth
      const newUser = await UsersService.create({
        nombre_completo,
        curp,
        email,
        password: password || curp,
        rol: 'ciudadano'
      });

      return res.status(201).json({ success: true, data: newUser });
    } catch (error) {
      console.error("\n🔴 ERROR ATRAPADO EN EL CONTROLADOR:");
      console.error(error.message || error);
      return res.status(500).json({ success: false, message: error.message || 'Error interno' });
    }
  },

  recuperarAcceso: async (req, res) => {
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