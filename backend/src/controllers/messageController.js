import { PrismaClient } from '@prisma/client';
import { createNotification } from './notificationController.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/** Возвращает участников чата (арендатор + арендодатель) */
const getChatParticipants = (booking) => ({
  tenantId: booking.userId,
  landlordId: booking.property.ownerId
});

/**
 * GET /api/messages/:bookingId
 * Получить историю сообщений по бронированию
 */
export const getMessages = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: { select: { ownerId: true } } }
    });

    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });

    const { tenantId, landlordId } = getChatParticipants(booking);
    if (req.user.id !== tenantId && req.user.id !== landlordId) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }

    // Помечаем входящие сообщения как прочитанные
    await prisma.message.updateMany({
      where: { bookingId, isRead: false, senderId: { not: req.user.id } },
      data: { isRead: true }
    });

    const messages = await prisma.message.findMany({
      where: { bookingId },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ bookingId, messages });
  } catch (error) {
    logger.error('getMessages error:', error);
    res.status(500).json({ error: 'Ошибка при получении сообщений' });
  }
};

/**
 * POST /api/messages/:bookingId
 * Отправить сообщение
 */
export const sendMessage = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { ownerId: true, title: true } },
        user: { select: { name: true, email: true } }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });

    const { tenantId, landlordId } = getChatParticipants(booking);
    if (req.user.id !== tenantId && req.user.id !== landlordId) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Нельзя отправлять сообщения по отменённому бронированию' });
    }

    const message = await prisma.message.create({
      data: { text: text.trim(), senderId: req.user.id, bookingId },
      include: { sender: { select: { id: true, name: true, email: true } } }
    });

    // Уведомляем получателя
    const recipientId = req.user.id === tenantId ? landlordId : tenantId;
    const senderName = req.user.name || req.user.email;

    createNotification(
      recipientId,
      'MESSAGE_NEW',
      `💬 Новое сообщение`,
      `${senderName}: ${text.trim().slice(0, 60)}${text.length > 60 ? '…' : ''}`,
      bookingId
    );

    res.status(201).json({ message });
  } catch (error) {
    logger.error('sendMessage error:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения' });
  }
};

/**
 * GET /api/messages/chats
 * Список всех чатов пользователя (по его бронированиям)
 */
export const getChatList = async (req, res) => {
  try {
    // Находим бронирования, где есть хотя бы одно сообщение
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { property: { ownerId: req.user.id } }
        ],
        messages: { some: {} }
      },
      include: {
        property: { select: { id: true, title: true, images: true, coverImage: true } },
        user: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true } } }
        },
        _count: {
          select: {
            messages: { where: { isRead: false, senderId: { not: req.user.id } } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ count: bookings.length, chats: bookings });
  } catch (error) {
    logger.error('getChatList error:', error);
    res.status(500).json({ error: 'Ошибка при получении чатов' });
  }
};
