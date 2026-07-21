import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Снимок средней цены по городу+типу сделки среди APPROVED объектов.
 * Реальные данные, накапливаются с момента первого запуска — никакой фабрикации истории.
 */
const captureSnapshot = async () => {
  try {
    const groups = await prisma.property.groupBy({
      by: ['cityId', 'contractType'],
      where: { status: 'APPROVED' },
      _avg: { price: true },
      _count: { _all: true },
    });

    const withData = groups.filter(g => g._count._all > 0 && g._avg.price != null);
    if (withData.length === 0) {
      logger.debug('[priceSnapshot] no approved properties yet — skipping');
      return;
    }

    await prisma.$transaction(
      withData.map(g => prisma.priceSnapshot.create({
        data: {
          cityId: g.cityId,
          contractType: g.contractType,
          avgPrice: g._avg.price,
          sampleSize: g._count._all,
        },
      }))
    );
    logger.info(`[priceSnapshot] captured ${withData.length} city/contract-type groups`);
  } catch (error) {
    logger.error('[priceSnapshot] failed:', error);
  }
};

/** Регистрирует ежедневный снимок в 03:00. Вызывать один раз из server.js. */
export const schedulePriceSnapshot = () => {
  cron.schedule('0 3 * * *', captureSnapshot);
  logger.info('[priceSnapshot] scheduled daily at 03:00');
};

/** Разовый вызов при старте — чтобы график истории не был пустым до первой ночи */
export const captureSnapshotNow = captureSnapshot;

export default schedulePriceSnapshot;
