import { Router } from 'express';
import { ExpedientesController } from '../controllers/expedientes.controller.js';

const router = Router();

// Endpoint para obtener el expediente de un ciudadano
router.get('/:ciudadano_id', ExpedientesController.getExpediente);

// Endpoint para crear o actualizar campos del expediente (fecha, lugar, archivos)
router.put('/:ciudadano_id', ExpedientesController.updateExpediente);

export default router;
