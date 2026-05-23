import { SolicitudesService } from '../services/solicitudes.service.js';

export const SolicitudesController = {
  crear: async (req, res) => {
    try {
      const nuevaSolicitud = await SolicitudesService.crearSolicitud(req.body);
      return res.status(201).json({ success: true, data: nuevaSolicitud });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  obtenerPorFolio: async (req, res) => {
    try {
      const { folio } = req.params;
      const solicitud = await SolicitudesService.obtenerPorFolio(folio);
      return res.status(200).json({ success: true, data: solicitud });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  obtenerPorCiudadano: async (req, res) => {
    try {
      const { ciudadano_id } = req.params;
      const solicitudes = await SolicitudesService.obtenerPorCiudadano(ciudadano_id);
      return res.status(200).json({ success: true, data: solicitudes });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  },

  actualizarEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const solicitudActualizada = await SolicitudesService.actualizarEstado(id, req.body);
      return res.status(200).json({ success: true, data: solicitudActualizada });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }
};
