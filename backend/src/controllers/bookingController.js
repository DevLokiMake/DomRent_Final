import { PrismaClient } from '@prisma/client';
import { sendBookingNotification } from '../services/telegramService.js';
import { createNotification } from './notificationController.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Вычисляет реальный статус бронирования по датам
 * Используется для синхронизации статуса в БД
 */
const computeStatus = (startDate, endDate, currentStatus) => {
  if (currentStatus === 'CANCELLED') return 'CANCELLED';
  if (currentStatus === 'PENDING') return 'PENDING'; // ждёт подтверждения
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return 'UPCOMING';
  if (now >= start && now <= end) return 'ACTIVE';
  return 'COMPLETED';
};

/**
 * Вспомогательная функция: проверка пересечения дат
 * @param {Date} newStart - начало нового бронирования
 * @param {Date} newEnd - конец нового бронирования
 * @param {Array} existingBookings - существующие бронирования
 * @returns {boolean} - true если есть пересечение
 */
const hasDateConflict = (newStart, newEnd, existingBookings) => {
  return existingBookings.some((booking) => {
    return (newStart < booking.endDate) && (newEnd > booking.startDate);
  });
};

/**
 * Вычисление стоимости бронирования
 * @param {Date} startDate - начало бронирования
 * @param {Date} endDate - конец бронирования
 * @param {number} pricePerDay - цена за день
 * @returns {number} - общая стоимость
 */
const calculateTotalPrice = (startDate, endDate, pricePerDay) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return daysCount * pricePerDay;
};

/**
 * Создание нового бронирования
 * Проверяет наличие объекта и пересечения дат
 * Вычисляет totalPrice
 * @param {Object} req - Express request объект (body уже валидирован middleware)
 * @param {Object} res - Express response объект
 */
export const createBooking = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    // Проверка существования объекта
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Проверка: объект одобрен модерацией
    if (property.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Этот объект ещё не прошёл модерацию и недоступен для бронирования'
      });
    }

    // Проверка на пересечение дат с существующими бронированиями
    const existingBookings = await prisma.booking.findMany({
      where: { propertyId, status: { in: ['PENDING', 'UPCOMING', 'ACTIVE'] } }
    });

    if (hasDateConflict(startDate, endDate, existingBookings)) {
      return res.status(409).json({
        error: 'На выбранные даты уже есть бронирование. Выберите другие даты.'
      });
    }

    // Проверка на ручные блокировки владельца
    const newDates = [];
    const cur = new Date(startDate);
    cur.setUTCHours(0, 0, 0, 0);
    const endNorm = new Date(endDate);
    endNorm.setUTCHours(0, 0, 0, 0);
    while (cur <= endNorm) {
      newDates.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const manualBlocked = await prisma.blockedDate.findFirst({
      where: { propertyId, date: { in: newDates }, reason: 'manual' }
    });
    if (manualBlocked) {
      return res.status(409).json({
        error: 'Некоторые даты заблокированы владельцем. Выберите другие даты.'
      });
    }

    // Вычисление стоимости
    const totalPrice = calculateTotalPrice(startDate, endDate, property.price);

    // Создание бронирования — статус PENDING до подтверждения арендодателем
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        propertyId,
        startDate,
        endDate,
        totalPrice,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            type: true,
            images: true,
            city: {
              select: { id: true, name: true }
            },
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                telegramId: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        }
      }
    });

    // Отправка уведомления владельцу объекта в отдельном try/catch
    // Чтобы если Telegram временно недоступен, бронирование все равно сохранилось
    try {
      if (booking.property.owner.telegramId) {
        await sendBookingNotification(booking.property.owner.id, {
          propertyTitle: booking.property.title,
          startDate: booking.startDate,
          endDate: booking.endDate,
          totalPrice: booking.totalPrice,
          guestName: booking.user.name || 'Не указано',
          guestEmail: booking.user.email,
          guestPhone: booking.user.phone || 'Не указано'
        });
      }
    } catch (telegramError) {
      logger.error('Ошибка при отправке Telegram-уведомления:', telegramError.message);
    }

    // In-app уведомления (не блокируем ответ)
    Promise.allSettled([
      // Арендодателю — новое бронирование
      createNotification(
        booking.property.owner.id,
        'BOOKING_NEW',
        'Новое бронирование',
        `${booking.user.name || booking.user.email} забронировал «${booking.property.title}»`,
        booking.id
      ),
      // Арендатору — ожидание подтверждения
      createNotification(
        req.user.id,
        'BOOKING_NEW',
        'Бронирование ожидает подтверждения',
        `Ваша заявка на «${booking.property.title}» отправлена арендодателю`,
        booking.id
      ),
    ]);

    // Отправка ответа клиенту
    res.status(201).json({
      message: 'Бронирование успешно создано',
      booking
    });
  } catch (error) {
    logger.error('Create booking error:', error);
    res.status(500).json({ error: 'Ошибка при создании бронирования' });
  }
};

/**
 * Получение всех бронирований текущего пользователя
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getUserBookings = async (req, res) => {
  try {
    const { status } = req.query;

    const VALID_STATUSES = ['PENDING', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            type: true,
            contractType: true,
            images: true,
            city: {
              select: { id: true, name: true }
            },
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Синхронизируем статусы по датам (UPCOMING/ACTIVE/COMPLETED)
    const now = new Date();
    const toUpdate = bookings.filter(b => {
      if (b.status === 'CANCELLED') return false;
      const correct = computeStatus(b.startDate, b.endDate, b.status);
      return correct !== b.status;
    });

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(b =>
          prisma.booking.update({
            where: { id: b.id },
            data: { status: computeStatus(b.startDate, b.endDate, b.status) }
          })
        )
      );
      toUpdate.forEach(b => {
        b.status = computeStatus(b.startDate, b.endDate, b.status);
      });
    }

    res.json({
      count: bookings.length,
      bookings
    });
  } catch (error) {
    logger.error('Get user bookings error:', error);
    res.status(500).json({ error: 'Ошибка при получении бронирований' });
  }
};

/**
 * Отмена/удаление бронирования
 * Может удалить только владелец бронирования
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Валидация ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID бронирования' });
    }

    const bookingId = parseInt(id);

    // Поиск бронирования
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: { id: true, title: true, ownerId: true }
        },
        user: { select: { name: true, email: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    // Проверка прав: только арендатор или арендодатель могут отменить
    if (booking.userId !== req.user.id && booking.property.ownerId !== req.user.id) {
      return res.status(403).json({
        error: 'Нет прав для отмены этого бронирования'
      });
    }

    // Обновляем статус на CANCELLED вместо удаления
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' }
    });

    // Уведомляем обе стороны
    const guestName = booking.user.name || booking.user.email;
    Promise.allSettled([
      createNotification(
        booking.userId,
        'BOOKING_CANCELLED',
        '❌ Бронирование отменено',
        `Бронь «${booking.property.title}» была отменена`,
        bookingId
      ),
      booking.property.ownerId !== req.user.id && createNotification(
        booking.property.ownerId,
        'BOOKING_CANCELLED',
        '❌ Бронирование отменено',
        `${guestName} отменил бронь «${booking.property.title}»`,
        bookingId
      ),
    ]);

    res.json({
      message: 'Бронирование успешно отменено',
      propertyTitle: booking.property.title
    });
  } catch (error) {
    logger.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Ошибка при отмене бронирования' });
  }
};

/**
 * Получение одного бронирования по ID (для чата)
 */
export const getBookingById = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'Некорректный ID' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: {
            id: true, title: true, images: true, coverImage: true,
            city: { select: { id: true, name: true } },
            ownerId: true
          }
        },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });

    const isParticipant = booking.userId === req.user.id || booking.property.ownerId === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Нет доступа' });

    res.json({ booking });
  } catch (error) {
    logger.error('getBookingById error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

/**
 * Получение всех бронирований объектов владельца
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getOwnerBookings = async (req, res) => {
  try {
    // Получение всех объектов, которыми владеет пользователь
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      select: { id: true }
    });

    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return res.json({
        count: 0,
        bookings: []
      });
    }

    // Получение всех бронирований для этих объектов
    const bookings = await prisma.booking.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            type: true,
            images: true,
            city: {
              select: { id: true, name: true }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    res.json({
      count: bookings.length,
      bookings
    });
  } catch (error) {
    logger.error('Get owner bookings error:', error);
    res.status(500).json({ error: 'Ошибка при получении бронирований' });
  }
};

// ── Подтверждение бронирования арендодателем ──────────────────────────────────
export const confirmBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'Некорректный ID' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { id: true, title: true, ownerId: true } },
        user: { select: { id: true, name: true, email: true, telegramId: true } }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });
    if (booking.property.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет прав' });
    if (booking.status !== 'PENDING') return res.status(400).json({ error: 'Бронирование уже обработано' });

    const newStatus = computeStatus(booking.startDate, booking.endDate, 'UPCOMING');
    await prisma.booking.update({ where: { id: bookingId }, data: { status: newStatus } });

    Promise.allSettled([
      createNotification(booking.user.id, 'BOOKING_CONFIRMED', 'Бронирование подтверждено',
        `Арендодатель подтвердил вашу бронь «${booking.property.title}»`, bookingId),
    ]);

    // Telegram уведомление гостю
    const { sendBookingStatusNotification } = await import('../services/telegramService.js');
    sendBookingStatusNotification(booking.user.id, {
      propertyTitle: booking.property.title,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: booking.totalPrice,
      status: 'CONFIRMED'
    }).catch(() => {});

    res.json({ message: 'Бронирование подтверждено', status: newStatus });
  } catch (error) {
    logger.error('confirmBooking error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ── Отклонение бронирования арендодателем ────────────────────────────────────
export const rejectBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'Некорректный ID' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { id: true, title: true, ownerId: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });
    if (booking.property.ownerId !== req.user.id) return res.status(403).json({ error: 'Нет прав' });
    if (booking.status !== 'PENDING') return res.status(400).json({ error: 'Бронирование уже обработано' });

    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });

    Promise.allSettled([
      createNotification(booking.user.id, 'BOOKING_CANCELLED', 'Бронирование отклонено',
        `К сожалению, арендодатель отклонил вашу бронь «${booking.property.title}»`, bookingId),
    ]);

    const { sendBookingStatusNotification } = await import('../services/telegramService.js');
    sendBookingStatusNotification(booking.user.id, {
      propertyTitle: booking.property.title,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: 'CANCELLED'
    }).catch(() => {});

    res.json({ message: 'Бронирование отклонено' });
  } catch (error) {
    logger.error('rejectBooking error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};