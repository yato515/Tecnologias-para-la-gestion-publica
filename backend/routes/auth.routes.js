import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', AuthController.login);
router.post('/renovar', verifyToken, AuthController.renovarToken); // requiere token vigente + docs vigentes
router.post('/recuperar', AuthController.recuperarPassword);
router.post('/registrar-gestor', AuthController.registrarGestor);

export default router;
