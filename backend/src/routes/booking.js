import express from 'express';
import {
  createBooking,
  getUserBookings,
  getOwnerBookings,
  cancelBooking,
  getBookingById,
  confirmBooking,
  rejectBooking,
} from '../controllers/bookingController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { validate, bookingSchema } from '../middlewares/validate.js';

const router = express.Router();

/**
 * POST /api/bookings
 * Создание нового бронирования (требует аутентификацию)
 * Body: { propertyId, startDate, endDate }
 */
router.post('/', authenticateToken, validate(bookingSchema), createBooking);

/**
 * GET /api/bookings/my
 * Получение всех бронирований текущего пользователя (требует аутентификацию)
 */
router.get('/my', authenticateToken, getUserBookings);

/**
 * GET /api/bookings/owner
 * Получение всех бронирований объектов текущего пользователя (требует аутентификацию)
 */
router.get('/owner', authenticateToken, getOwnerBookings);

/**
 * GET /api/bookings/:id
 * Получение одного бронирования по ID (для чата)
 */
router.get('/:id', authenticateToken, getBookingById);

/**
 * DELETE /api/bookings/:id
 * Отмена бронирования (требует аутентификацию и принадлежность бронирования)
 */
router.delete('/:id', authenticateToken, cancelBooking);

// PATCH /api/bookings/:id/confirm — арендодатель подтверждает бронирование
router.patch('/:id/confirm', authenticateToken, confirmBooking);

// PATCH /api/bookings/:id/reject — арендодатель отклоняет бронирование
router.patch('/:id/reject', authenticateToken, rejectBooking);

export default router;