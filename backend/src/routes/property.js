import express from 'express';
import {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getNearbyProperties,
  getPopularProperties,
  getSimilarProperties,
  getMyProperties,
} from '../controllers/propertyController.js';
import {
  getBlockedDates,
  addBlockedDates,
  removeBlockedDates,
  getOccupancyCalendar,
} from '../controllers/blockedDateController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireLandlord } from '../middlewares/requireRole.js';
import { validate, propertySchema, updatePropertySchema, blockedDatesSchema, unblockDatesSchema } from '../middlewares/validate.js';

const router = express.Router();

// Опциональная авторизация: прикрепляет req.user если токен есть, но не падает без него
const optionalAuth = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return next();
  try {
    await authenticateToken(req, res, next);
  } catch {
    next();
  }
};

// POST /api/properties — Создание (только LANDLORD/ADMIN)
router.post('/', authenticateToken, requireLandlord, validate(propertySchema), createProperty);

// GET /api/properties — Все объекты с фильтрацией (публичный)
router.get('/', getAllProperties);

// GET /api/properties/nearby — Поиск рядом (MUST be before /:id)
router.get('/nearby', getNearbyProperties);

// GET /api/properties/popular — Популярные (MUST be before /:id)
router.get('/popular', getPopularProperties);

// GET /api/properties/my — Объекты текущего пользователя (MUST be before /:id)
router.get('/my', authenticateToken, getMyProperties);

// GET /api/properties/:id — Объект по ID (опциональная авторизация для статуса модерации)
router.get('/:id', optionalAuth, getPropertyById);

// PUT /api/properties/:id — Обновление (владелец)
router.put('/:id', authenticateToken, validate(updatePropertySchema), updateProperty);

// DELETE /api/properties/:id — Удаление (владелец)
router.delete('/:id', authenticateToken, deleteProperty);

// GET /api/properties/:id/similar — Похожие объекты
router.get('/:id/similar', getSimilarProperties);

// ─── Календарь занятости ───────────────────────────────────────────────
// GET  /api/properties/:id/blocked-dates — публичный (для формы бронирования)
router.get('/:id/blocked-dates', getBlockedDates);

// GET  /api/properties/:id/occupancy — детальный календарь (только владелец/admin)
router.get('/:id/occupancy', authenticateToken, getOccupancyCalendar);
// POST /api/properties/:id/blocked-dates — ручная блокировка (владелец/admin)
router.post('/:id/blocked-dates', authenticateToken, validate(blockedDatesSchema), addBlockedDates);
// DELETE /api/properties/:id/blocked-dates — снять блокировку (владелец/admin)
router.delete('/:id/blocked-dates', authenticateToken, validate(unblockDatesSchema), removeBlockedDates);

export default router;
