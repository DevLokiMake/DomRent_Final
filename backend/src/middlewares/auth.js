import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Middleware для проверки JWT токена
 * Извлекает токен из заголовка Authorization (Bearer <token>)
 * При успешной проверке добавляет user объект в req.user
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: 'Доступ запрещен. Токен не предоставлен.' 
      });
    }

    // Проверка и декодирование токена
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Токен мог быть отозван через /auth/logout — проверяем денилист по jti
    if (decoded.jti) {
      const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
      if (revoked) {
        return res.status(401).json({ error: 'Токен отозван. Войдите заново.' });
      }
    }

    // Проверка существования пользователя в БД
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({ error: 'Недействительный токен.' });
    }

    // Проверка: заблокирован ли аккаунт
    if (user.isBanned) {
      return res.status(403).json({
        error: 'Ваш аккаунт заблокирован администратором. Обратитесь в поддержку.'
      });
    }

    // Добавление пользователя и payload токена (jti/exp нужны, например, для /auth/logout)
    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк. Войдите заново.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Недействительный токен.' });
    }
    logger.error('Auth middleware unexpected error:', error.message);
    res.status(401).json({ error: 'Ошибка аутентификации.' });
  }
};

export default authenticateToken;