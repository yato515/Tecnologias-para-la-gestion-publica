import { ExpedientesService } from '../services/expedientes.service.js';

export const ExpedientesController = {
  getExpediente: async (req, res) => {
    try {
      const { ciudadano_id } = req.params;
      const expediente = await ExpedientesService.getByCiudadanoId(ciudadano_id);
      return res.status(200).json({ success: true, data: expediente });
    } catch (error) {
      console.error("\n🔴 ERROR AL OBTENER EXPEDIENTE:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  updateExpediente: async (req, res) => {
    try {
      const { ciudadano_id } = req.params;
      const updates = req.body;

      const updated = await ExpedientesService.upsert(ciudadano_id, updates);

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("\n🔴 ERROR AL ACTUALIZAR EXPEDIENTE:", error.message || error);
      return res.status(500).json({ success: false, message: error.message || 'Error interno' });
    }
  }
};
