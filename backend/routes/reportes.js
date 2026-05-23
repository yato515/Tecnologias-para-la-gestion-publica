import { Router } from 'express';
import { ReportController } from '../controllers/reportController.js';

const router = Router();

router.get('/resumen',        ReportController.getResumen);
router.get('/vencidas',       ReportController.getVencidas);
router.get('/calificaciones', ReportController.getCalificaciones);

export default router;
