import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { signAuthToken } from '../helpers/jwt.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// In-memory store: code → { userId, expiresAt }
const linkCodes = new Map();

// Cleanup expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of linkCodes) {
    if (data.expiresAt < now) linkCodes.delete(code);
  }
}, 5 * 60 * 1000);

// GET /api/telegram/generate-code  — requires auth
export const generateCode = async (req, res) => {
  try {
    const code = String(crypto.randomInt(100000, 999999));
    linkCodes.set(code, {
      userId: req.user.id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    });
    res.json({ code });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/telegram/link  — called by bot (no user auth)
// Body: { code, telegramId }
export const linkAccount = async (req, res) => {
  try {
    const { code, telegramId } = req.body;

    if (!code || !telegramId) {
      return res.status(400).json({ error: 'code and telegramId are required' });
    }

    const entry = linkCodes.get(String(code));

    if (!entry) return res.status(400).json({ error: 'Неверный или просроченный код' });
    if (entry.expiresAt < Date.now()) {
      linkCodes.delete(String(code));
      return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    }

    linkCodes.delete(String(code));

    const user = await prisma.user.update({
      where: { id: entry.userId },
      data: { telegramId: String(telegramId) },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = signAuthToken(
      { id: user.id, email: user.email },
      { expiresIn: '30d' }
    );

    res.json({ token, userId: user.id, name: user.name, role: user.role });
  } catch (err) {
    logger.error('[telegram/link]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/telegram/profile  — requires auth, returns profile with counts
export const getTelegramProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        telegramId: true,
        _count: {
          select: { bookings: true, properties: true },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
