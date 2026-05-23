import { TramitesService } from '../services/tramites.service.js';

export const TramitesController = {
  obtenerCatalogo: async (req, res) => {
    try {
      const catalogo = await TramitesService.obtenerCatalogo();
      return res.status(200).json({ success: true, data: catalogo });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }
};
