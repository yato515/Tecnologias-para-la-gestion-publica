import { Router } from 'express';
import { SolicitudesController } from '../controllers/solicitudes.controller.js';

const router = Router();

// ==========================================
// RUTAS PARA CIUDADANOS (Creación y consulta)
// ==========================================
// Se monta sobre /api/tramites/solicitudes
router.post('/', SolicitudesController.crear);
router.get('/folio/:folio', SolicitudesController.obtenerPorFolio);

// ==========================================
// RUTAS PARA GESTORES (Revisión y actualización)
// ==========================================
// Se monta sobre /api/gestores/solicitudes
router.patch('/:id/estado', SolicitudesController.actualizarEstado);

export default router;
