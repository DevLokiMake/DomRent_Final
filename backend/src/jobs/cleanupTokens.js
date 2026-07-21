import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Удаляет просроченные токены сброса пароля и подтверждения email.
 * Вынесено из authController.js в отдельную job — раньше это был setInterval
 * прямо внутри контроллера, что дублировалось бы при нескольких инстансах/процессах.
 */
const cleanupExpiredTokens = async () => {
  try {
    const [passwordResetResult, emailVerificationResult, revokedTokenResult] = await Promise.all([
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      // Запись в денилисте больше не нужна после истечения — jwt.verify и так отклонит токен по exp
      prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);
    logger.debug(
      `[cleanupTokens] removed ${passwordResetResult.count} password-reset + ${emailVerificationResult.count} email-verification + ${revokedTokenResult.count} revoked-token entries`
    );
  } catch (error) {
    logger.error('[cleanupTokens] failed:', error);
  }
};

/**
 * Регистрирует cron-расписание (раз в 10 минут). Вызывать один раз из server.js.
 */
export const scheduleTokenCleanup = () => {
  cron.schedule('*/10 * * * *', cleanupExpiredTokens);
  logger.info('[cleanupTokens] scheduled every 10 minutes');
};

export default scheduleTokenCleanup;
