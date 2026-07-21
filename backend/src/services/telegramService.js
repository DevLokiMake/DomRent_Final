import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

const BOT_URL = process.env.BOT_NOTIFY_URL || 'http://localhost:4000';
const BOT_API_KEY = process.env.BOT_API_KEY || 'secret';

const notify = axios.create({
  baseURL: BOT_URL,
  timeout: 5000,
  headers: { 'x-bot-api-key': BOT_API_KEY },
});

const send = async (telegramId, type, data) => {
  try {
    await notify.post('/notify', { telegramId, type, data });
  } catch (err) {
    // Bot may not be running — log and continue
    logger.warn(`[telegram] notify failed for ${telegramId}:`, err.message);
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

export const sendBookingNotification = async (ownerId, details) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { telegramId: true, email: true },
  });

  if (!owner?.telegramId) return;

  const nights = Math.ceil(
    (new Date(details.endDate) - new Date(details.startDate)) / 86400000
  );

  await send(owner.telegramId, 'BOOKING_NEW', { ...details, nights });
};

export const sendBookingStatusNotification = async (userId, details) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true },
  });
  if (!user?.telegramId) return;
  await send(user.telegramId, 'BOOKING_STATUS', details);
};

export const sendPropertyModerationNotification = async (ownerId, details) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { telegramId: true },
  });
  if (!owner?.telegramId) return;
  const type = details.approved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED';
  await send(owner.telegramId, type, details);
};

export const sendReviewNotification = async (ownerId, details) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { telegramId: true },
  });
  if (!owner?.telegramId) return;
  await send(owner.telegramId, 'REVIEW_NEW', details);
};
