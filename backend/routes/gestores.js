import { Router } from 'express';
import { GestorController } from '../controllers/gestorController.js';

const router = Router();

router.get('/solicitudes',                       GestorController.getSolicitudes);
router.get('/dependencias',                      GestorController.getDependencias);
router.patch('/solicitudes/:id/estado',          GestorController.cambiarEstado);
router.patch('/solicitudes/:id/asignar',         GestorController.asignar);
router.get('/solicitudes/:id/mensajes',          GestorController.getMensajes);
router.post('/solicitudes/:id/mensajes',         GestorController.enviarMensaje);
router.get('/personal',                          GestorController.getPersonal);
router.put('/personal/:id',                      GestorController.updatePersonal);
router.get('/ciudadano/:ciudadano_id/historial', GestorController.getHistorialCiudadano);

export default router;
