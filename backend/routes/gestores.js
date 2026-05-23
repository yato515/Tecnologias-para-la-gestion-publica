import { Router } from 'express';
import { GestorController } from '../controllers/gestorController.js';

const router = Router();

router.get('/solicitudes',                       GestorController.getSolicitudes);
router.patch('/solicitudes/:id/estado',          GestorController.cambiarEstado);
router.patch('/solicitudes/:id/asignar',         GestorController.asignar);
router.get('/solicitudes/:id/mensajes',          GestorController.getMensajes);
router.post('/solicitudes/:id/mensajes',         GestorController.enviarMensaje);

export default router;
