import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';
import { signAuthToken } from '../helpers/jwt.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

const createEmailVerificationToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });
  return token;
};

const dispatchVerificationEmail = async (user) => {
  try {
    const token = await createEmailVerificationToken(user.id);
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:5173';
    const verifyLink = `${frontendUrl}/verify-email?token=${token}`;
    await sendVerificationEmail(user.email, verifyLink);
  } catch (error) {
    // Не проваливаем регистрацию из-за сбоя почты — пользователь всегда может запросить письмо повторно
    logger.error('sendVerificationEmail failed:', error);
  }
};

/**
 * Регистрация пользователя
 * @param {Object} req - Express request объект (body уже валидирован middleware)
 * @param {Object} res - Express response объект
 */
export const register = async (req, res) => {
  try {
    const { email, password, name, phone, role = 'USER', website } = req.body;

    // Honeypot: скрытое поле формы, которое реальный пользователь никогда не заполняет.
    // Ботам отвечаем "успехом", ничего не создавая — чтобы не выдавать защиту.
    if (website) {
      return res.status(201).json({ message: 'Проверьте почту для подтверждения регистрации' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role,
          isEmailVerified: false,
        }
      });
    } catch (createError) {
      // P2002 = нарушение unique constraint (email). Ловим здесь, а не только через
      // предварительную проверку — та не защищает от гонки двух параллельных запросов.
      if (createError.code === 'P2002') {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
      throw createError;
    }

    await dispatchVerificationEmail(user);

    res.status(201).json({
      message: 'Аккаунт создан. Проверьте почту, чтобы подтвердить email и войти.',
      email: user.email,
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
};

/**
 * POST /api/auth/verify-email  { token }
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const entry = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!entry || entry.expiresAt < new Date()) {
      if (entry) await prisma.emailVerificationToken.delete({ where: { token } });
      return res.status(400).json({ error: 'Ссылка недействительна или истекла' });
    }

    const user = await prisma.user.update({
      where: { id: entry.userId },
      data: { isEmailVerified: true },
    });

    // Токен одноразовый — а заодно подчищаем остальные висящие токены этого пользователя
    await prisma.emailVerificationToken.deleteMany({ where: { userId: entry.userId } });

    const jwtToken = signAuthToken(
      { id: user.id, email: user.email },
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email подтверждён',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token: jwtToken,
    });
  } catch (error) {
    logger.error('verifyEmail error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

/**
 * POST /api/auth/resend-verification  { email }
 */
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Не раскрываем, существует ли аккаунт и подтверждён ли он
    const genericResponse = { message: 'Если аккаунт существует и не подтверждён, письмо отправлено' };
    if (!user || user.isEmailVerified) {
      return res.json(genericResponse);
    }

    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await dispatchVerificationEmail(user);

    res.json(genericResponse);
  } catch (error) {
    logger.error('resendVerification error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

/**
 * Вход пользователя
 * @param {Object} req - Express request объект (body уже валидирован middleware)
 * @param {Object} res - Express response объект
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Поиск пользователя по email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Неверные учетные данные' });
    }

    // Проверка: заблокирован ли аккаунт
    if (user.isBanned) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором. Обратитесь в поддержку.' });
    }

    // Проверка пароля
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Неверные учетные данные' });
    }

    // Требуем подтверждённый email (существующие пользователи получили isEmailVerified=true при миграции)
    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: 'Подтвердите email перед входом. Проверьте почту или запросите письмо повторно.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Генерация JWT токена
    const token = signAuthToken(
      { id: user.id, email: user.email },
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Успешный вход',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
};

/**
 * POST /api/auth/logout
 * Отзывает текущий JWT (добавляет jti в денилист) — иначе logout был бы чисто
 * клиентским действием, и украденный/скопированный токен продолжал бы работать
 * до истечения 7-дневного срока.
 */
export const logout = async (req, res) => {
  try {
    const { jti, exp } = req.tokenPayload || {};
    if (jti && exp) {
      await prisma.revokedToken.upsert({
        where: { jti },
        create: { jti, expiresAt: new Date(exp * 1000) },
        update: {},
      });
    }
    res.json({ message: 'Вы вышли из системы' });
  } catch (error) {
    logger.error('logout error:', error);
    res.status(500).json({ error: 'Ошибка при выходе' });
  }
};

/**
 * GET /api/auth/me
 * Получить профиль текущего пользователя
 */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, phone: true,
        avatar: true, role: true, isBanned: true, isEmailVerified: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user });
  } catch (error) {
    logger.error('getMe error:', error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
};

/**
 * PATCH /api/auth/me
 * Обновить профиль: name, phone, avatar
 */
export const updateMe = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const data = {};
    if (name !== undefined) data.name = name?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (avatar !== undefined) data.avatar = avatar?.trim() || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, email: true, name: true, phone: true,
        avatar: true, role: true, isBanned: true, isEmailVerified: true, createdAt: true,
      },
    });

    res.json({ message: 'Профиль обновлён', user });
  } catch (error) {
    logger.error('updateMe error:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

// Очистка просроченных токенов вынесена в src/jobs/cleanupTokens.js (cron, регистрируется в server.js)

// POST /api/auth/forgot-password  { email }
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Не раскрываем, существует ли email
    if (!user) return res.json({ message: 'Если аккаунт существует, ссылка отправлена' });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(email, resetLink);

    res.json({ message: 'Если аккаунт существует, ссылка отправлена' });
  } catch (error) {
    logger.error('forgotPassword error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// POST /api/auth/reset-password  { token, password }
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const entry = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!entry || entry.expiresAt < new Date()) {
      if (entry) await prisma.passwordResetToken.delete({ where: { token } });
      return res.status(400).json({ error: 'Ссылка недействительна или истекла' });
    }

    await prisma.passwordResetToken.delete({ where: { token } });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: entry.userId }, data: { password: hashed } });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    logger.error('resetPassword error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};
