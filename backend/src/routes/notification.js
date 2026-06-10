import express from 'express';
import { getNotifications, markAllRead, markOneRead, savePushToken } from '../controllers/notificationController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// POST /api/notifications/push-token — сохранить Expo push token
router.post('/push-token', authenticateToken, savePushToken);

// GET  /api/notifications        — список уведомлений
router.get('/', authenticateToken, getNotifications);

// PATCH /api/notifications/read-all — прочитать все
router.patch('/read-all', authenticateToken, markAllRead);

// PATCH /api/notifications/:id/read — прочитать одно
router.patch('/:id/read', authenticateToken, markOneRead);

export default router;
