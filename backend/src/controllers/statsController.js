import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * GET /api/stats/price-index
 * Текущая средняя цена по городу+типу сделки (живой агрегат по APPROVED объектам).
 */
export const getPriceIndex = async (req, res) => {
  try {
    const groups = await prisma.property.groupBy({
      by: ['cityId', 'contractType'],
      where: { status: 'APPROVED' },
      _avg: { price: true },
      _count: { _all: true },
    });

    const cityIds = [...new Set(groups.map(g => g.cityId))];
    const cities = await prisma.city.findMany({ where: { id: { in: cityIds } } });
    const cityNameById = new Map(cities.map(c => [c.id, c.name]));

    const index = groups
      .filter(g => g._count._all > 0 && g._avg.price != null)
      .map(g => ({
        cityId: g.cityId,
        city: cityNameById.get(g.cityId) || 'Неизвестно',
        contractType: g.contractType,
        avgPrice: Math.round(g._avg.price),
        count: g._count._all,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice);

    res.json({ index });
  } catch (error) {
    logger.error('getPriceIndex error:', error);
    res.status(500).json({ error: 'Ошибка получения ценового индекса' });
  }
};

/**
 * GET /api/stats/price-history?cityId=&contractType=
 * История снимков цен (см. src/jobs/priceSnapshot.js). Данные копятся с момента
 * появления этой функции в проекте — если снимков ещё мало, график будет коротким,
 * это ожидаемо (никакая история не подделывается).
 */
export const getPriceHistory = async (req, res) => {
  try {
    const { cityId, contractType } = req.query;
    const where = {};
    if (cityId) where.cityId = cityId;
    if (contractType) where.contractType = contractType;

    const snapshots = await prisma.priceSnapshot.findMany({
      where,
      include: { city: { select: { name: true } } },
      orderBy: { capturedAt: 'asc' },
      take: 365,
    });

    res.json({
      snapshots: snapshots.map(s => ({
        date: s.capturedAt,
        cityId: s.cityId,
        city: s.city.name,
        contractType: s.contractType,
        avgPrice: Math.round(s.avgPrice),
        sampleSize: s.sampleSize,
      })),
    });
  } catch (error) {
    logger.error('getPriceHistory error:', error);
    res.status(500).json({ error: 'Ошибка получения истории цен' });
  }
};

/**
 * GET /api/stats/my
 * Личная статистика арендатора — только реальные данные из его бронирований/отзывов/избранного.
 */
export const getMyStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [bookings, reviewsWritten, favoritesCount] = await Promise.all([
      prisma.booking.findMany({
        where: { userId, status: { in: ['UPCOMING', 'ACTIVE', 'COMPLETED'] } },
        include: { property: { include: { city: true } } },
      }),
      prisma.review.count({ where: { authorId: userId } }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalNights = bookings.reduce((sum, b) => {
      const nights = Math.max(1, Math.round((new Date(b.endDate) - new Date(b.startDate)) / 86400000));
      return sum + nights;
    }, 0);

    const cityCounts = new Map();
    bookings.forEach(b => {
      const city = b.property?.city?.name;
      if (!city) return;
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    });
    let favoriteCity = null;
    let maxCount = 0;
    for (const [city, count] of cityCounts) {
      if (count > maxCount) { favoriteCity = city; maxCount = count; }
    }

    res.json({
      totalBookings,
      totalNights,
      totalSpent,
      favoriteCity,
      reviewsWritten,
      favoritesCount,
      memberSince: req.user.createdAt,
    });
  } catch (error) {
    logger.error('getMyStats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};
