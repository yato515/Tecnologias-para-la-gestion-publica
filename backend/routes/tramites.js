import { Router } from 'express';
import { TramiteController } from '../controllers/tramiteController.js';

const router = Router();

router.get('/catalogo',                              TramiteController.getCatalogo);
router.get('/solicitudes/folio/:folio',              TramiteController.getSolicitudByFolio);
router.get('/solicitudes/:ciudadano_id',             TramiteController.getMisSolicitudes);
router.post('/solicitudes',                          TramiteController.crearSolicitud);
router.get('/solicitudes/:id/documentos',            TramiteController.getDocumentos);
router.post('/solicitudes/:id/documentos',           TramiteController.subirDocumento);
router.post('/solicitudes/:id/calificar',            TramiteController.calificar);

export default router;
