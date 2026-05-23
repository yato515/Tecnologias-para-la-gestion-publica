import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';

const router = Router();

router.get('/', UsersController.getUsers);
router.post('/', UsersController.createUser);
router.put('/:id', UsersController.updateUser);
router.delete('/:id', UsersController.deleteUser);

export default router;