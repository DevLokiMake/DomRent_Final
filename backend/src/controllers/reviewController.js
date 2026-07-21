import { PrismaClient } from '@prisma/client';
import { createNotification } from './notificationController.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * POST /api/reviews
 * Оставить отзыв на объект (bookingId необязателен).
 * Если anonymous=true — отображается как "Аноним".
 */
export const createReview = async (req, res) => {
  try {
    const { propertyId, rating, text, anonymous = false, bookingId } = req.body;

    if (!propertyId || !rating || !text?.trim()) {
      return res.status(400).json({ error: 'propertyId, rating и text обязательны' });
    }

    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
    }

    const property = await prisma.property.findUnique({
      where: { id: parseInt(propertyId) },
      select: { id: true, title: true, ownerId: true }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Если bookingId передан — проверяем его
    let resolvedBookingId = null;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: parseInt(bookingId) } });
      if (booking && booking.userId === req.user.id) {
        resolvedBookingId = booking.id;
      }
    }

    // Проверяем, не оставил ли уже отзыв на этот объект
    const existing = await prisma.review.findFirst({
      where: { authorId: req.user.id, propertyId: property.id }
    });

    if (existing) {
      return res.status(409).json({ error: 'Вы уже оставили отзыв на этот объект' });
    }

    const review = await prisma.review.create({
      data: {
        rating: ratingNum,
        text: text.trim(),
        anonymous: Boolean(anonymous),
        authorId: req.user.id,
        propertyId: property.id,
        bookingId: resolvedBookingId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    });

    // Уведомляем владельца (не себя)
    if (property.ownerId !== req.user.id) {
      const authorName = anonymous ? 'Аноним' : (review.author.name || review.author.email);
      createNotification(
        property.ownerId,
        'REVIEW_NEW',
        'Новый отзыв',
        `${authorName} оставил отзыв ${ratingNum} на «${property.title}»`,
        review.id
      );
    }

    const safeReview = {
      ...review,
      author: review.anonymous ? { name: 'Аноним', email: '' } : review.author
    };

    res.status(201).json({ message: 'Отзыв успешно добавлен', review: safeReview });
  } catch (error) {
    logger.error('createReview error:', error);
    res.status(500).json({ error: 'Ошибка при создании отзыва' });
  }
};

/**
 * GET /api/reviews/property/:propertyId
 * Все отзывы + средний рейтинг. Анонимные скрывают автора.
 */
export const getPropertyReviews = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Некорректный ID объекта' });
    }

    const reviews = await prisma.review.findMany({
      where: { propertyId },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const safeReviews = reviews.map(r => ({
      ...r,
      author: r.anonymous ? { name: 'Аноним', email: '' } : r.author
    }));

    const avgRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    res.json({ count: reviews.length, avgRating, reviews: safeReviews });
  } catch (error) {
    logger.error('getPropertyReviews error:', error);
    res.status(500).json({ error: 'Ошибка при получении отзывов' });
  }
};

/**
 * GET /api/reviews/can-review/:propertyId
 * Проверяет, может ли пользователь оставить отзыв на объект.
 */
export const canReview = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    if (!req.user) return res.json({ canReview: false });

    const existing = await prisma.review.findFirst({
      where: { authorId: req.user.id, propertyId }
    });

    res.json({ canReview: !existing });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка проверки' });
  }
};
