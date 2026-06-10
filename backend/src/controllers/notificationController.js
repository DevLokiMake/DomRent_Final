import { PrismaClient } from '@prisma/client';
import { sendPushNotification } from '../services/pushNotificationService.js';

const prisma = new PrismaClient();

/**
 * Утилита: создать in-app уведомление + отправить push если есть токен
 */
export const createNotification = async (userId, type, title, body, entityId = null) => {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, entityId }
    });
    // Попробуем отправить push если у пользователя есть токен
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true }
    });
    if (user?.expoPushToken) {
      await sendPushNotification(user.expoPushToken, title, body, { type, entityId });
    }
    return notification;
  } catch (err) {
    console.error('createNotification error:', err);
  }
};

/**
 * POST /api/notifications/push-token
 * Сохранить Expo push token текущего пользователя
 */
export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token обязателен' });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { expoPushToken: token },
    });
    res.json({ message: 'Push token сохранён' });
  } catch (error) {
    console.error('savePushToken error:', error);
    res.status(500).json({ error: 'Ошибка сохранения токена' });
  }
};

/**
 * GET /api/notifications
 * Все уведомления текущего пользователя (последние 50)
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({ unreadCount, notifications });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ error: 'Ошибка при получении уведомлений' });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Отметить все уведомления пользователя как прочитанные
 */
export const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: 'Все уведомления прочитаны' });
  } catch (error) {
    console.error('markAllRead error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении уведомлений' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Прочитать одно уведомление
 */
export const markOneRead = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true }
    });
    res.json({ message: 'Уведомление прочитано' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при обновлении уведомления' });
  }
};
