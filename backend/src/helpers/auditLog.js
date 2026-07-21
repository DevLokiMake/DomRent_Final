import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';
const prisma = new PrismaClient();

/**
 * Записывает действие администратора в журнал.
 * @param {number} adminId
 * @param {string} action  - 'BAN_USER' | 'UNBAN_USER' | 'APPROVE_PROPERTY' | 'REJECT_PROPERTY' | 'CHANGE_ROLE'
 * @param {number|null} targetId
 * @param {string|null} targetType - 'USER' | 'PROPERTY'
 * @param {object|null} details    - любые дополнительные данные (причина, роль и т.д.)
 */
export async function logAdminAction(adminId, action, targetId = null, targetType = null, details = null) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetId,
        targetType,
        details: details ?? undefined,
      },
    });
  } catch (err) {
    // Не прерываем основной поток при ошибке логирования
    logger.error('[AuditLog] Failed to write:', err.message);
  }
}
