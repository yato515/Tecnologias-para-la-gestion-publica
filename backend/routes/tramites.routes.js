import { Router } from 'express';
import { TramitesController } from '../controllers/tramites.controller.js';

const router = Router();

// ==========================================
// RUTAS PARA TRÁMITES (Catálogo)
// ==========================================
// Se monta sobre /api/tramites/catalogo
router.get('/', TramitesController.obtenerCatalogo);

export default router;
