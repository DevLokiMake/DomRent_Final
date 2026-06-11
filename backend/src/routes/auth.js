import express from 'express';
import { register, login, updateMe, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../middlewares/validate.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// Профиль текущего пользователя
router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, updateMe);

router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
