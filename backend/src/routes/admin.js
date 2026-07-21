import express from 'express';
import {
  getStats,
  getUsers,
  toggleUserBan,
  changeUserRole,
  getPropertiesAdmin,
  approveProperty,
  rejectProperty,
  getAuditLog,
  getAdminBookings,
  getAdminReviews,
  deleteAdminReview,
  getAnalytics,
} from '../controllers/adminController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/requireRole.js';
import { validate, banUserSchema, changeRoleSchema } from '../middlewares/validate.js';

const router = express.Router();

// Все маршруты защищены: авторизация + роль ADMIN
router.use(authenticateToken, requireAdmin);

// Статистика
router.get('/stats', getStats);
router.get('/analytics', getAnalytics);

// Пользователи
router.get('/users', getUsers);
router.patch('/users/:id/ban', validate(banUserSchema), toggleUserBan);
router.patch('/users/:id/role', validate(changeRoleSchema), changeUserRole);

// Модерация объявлений
router.get('/properties', getPropertiesAdmin);
router.patch('/properties/:id/approve', approveProperty);
router.patch('/properties/:id/reject', rejectProperty);

// Журнал действий администраторов
router.get('/audit', getAuditLog);

// Бронирования (просмотр)
router.get('/bookings', getAdminBookings);

// Отзывы (просмотр + удаление)
router.get('/reviews', getAdminReviews);
router.delete('/reviews/:id', deleteAdminReview);

export default router;
