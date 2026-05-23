import { Router } from 'express';
import { TramiteController } from '../controllers/tramiteController.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get('/catalogo',                              TramiteController.getCatalogo);
router.get('/solicitudes/folio/:folio',              TramiteController.getSolicitudByFolio);
router.get('/solicitudes/:ciudadano_id',             TramiteController.getMisSolicitudes);
router.post('/solicitudes',                          TramiteController.crearSolicitud);
router.get('/solicitudes/:id/documentos',            TramiteController.getDocumentos);
router.post('/solicitudes/:id/documentos',           TramiteController.subirDocumento);
router.post('/solicitudes/:id/calificar',            TramiteController.calificar);

// Rutas de almacenamiento físico (Supabase Storage) - Comentadas para evitar crash por métodos faltantes
// router.post('/documentos/upload',                    upload.single('archivo'), TramiteController.uploadFisico);
// router.get('/documentos/ver',                       TramiteController.verDocumento);

export default router;
