import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * GET /api/landlord/statistics
 * Статистика по всем объектам арендодателя
 */
export const getLandlordStatistics = async (req, res) => {
  try {
    if (req.user.role !== 'LANDLORD' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступ только для арендодателей' });
    }

    const ownerId = req.user.role === 'ADMIN' && req.query.ownerId
      ? parseInt(req.query.ownerId)
      : req.user.id;

    // Загружаем все объекты с агрегированными данными
    const properties = await prisma.property.findMany({
      where: { ownerId },
      include: {
        city: { select: { name: true } },
        bookings: {
          select: { totalPrice: true, status: true, createdAt: true },
        },
        reviews: { select: { rating: true } },
        _count: {
          select: { favorites: true, bookings: true, reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Формируем статистику по каждому объекту
    const propertyStats = properties.map(p => {
      const completedBookings = p.bookings.filter(b =>
        ['COMPLETED', 'ACTIVE', 'UPCOMING', 'PENDING'].includes(b.status)
      );
      const revenue = completedBookings
        .filter(b => b.status !== 'CANCELLED')
        .reduce((sum, b) => sum + b.totalPrice, 0);

      const ratings = p.reviews.map(r => r.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((s, r) => s + r, 0) / ratings.length
        : null;

      return {
        id: p.id,
        title: p.title,
        city: p.city.name,
        status: p.status,
        price: p.price,
        type: p.type,
        contractType: p.contractType,
        coverImage: p.coverImage,
        createdAt: p.createdAt,
        viewCount: p.viewCount,
        favoritesCount: p._count.favorites,
        bookingsCount: p._count.bookings,
        reviewsCount: p._count.reviews,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        revenue: Math.round(revenue),
      };
    });

    // Общая сводка
    const totalRevenue = propertyStats.reduce((s, p) => s + p.revenue, 0);
    const totalBookings = propertyStats.reduce((s, p) => s + p.bookingsCount, 0);
    const totalViews = propertyStats.reduce((s, p) => s + p.viewCount, 0);
    const totalFavorites = propertyStats.reduce((s, p) => s + p.favoritesCount, 0);
    const allRatings = propertyStats.filter(p => p.avgRating !== null);
    const overallRating = allRatings.length > 0
      ? allRatings.reduce((s, p) => s + (p.avgRating || 0), 0) / allRatings.length
      : null;

    // Лучший объект по доходу
    const bestProperty = [...propertyStats].sort((a, b) => b.revenue - a.revenue)[0] || null;

    // Топ город
    const cityRevenue = {};
    propertyStats.forEach(p => {
      cityRevenue[p.city] = (cityRevenue[p.city] || 0) + p.revenue;
    });
    const topCity = Object.entries(cityRevenue).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Динамика бронирований по месяцам (последние 12 мес.)
    const since12mo = new Date();
    since12mo.setMonth(since12mo.getMonth() - 11);
    since12mo.setDate(1);
    since12mo.setHours(0, 0, 0, 0);

    const allBookings = await prisma.booking.findMany({
      where: {
        property: { ownerId },
        createdAt: { gte: since12mo },
        status: { not: 'CANCELLED' },
      },
      select: { createdAt: true, totalPrice: true },
    });

    const monthlyMap = {};
    allBookings.forEach(b => {
      const key = b.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap[key]) monthlyMap[key] = { bookings: 0, revenue: 0 };
      monthlyMap[key].bookings++;
      monthlyMap[key].revenue += b.totalPrice;
    });
    const monthlyChart = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({ month, bookings: d.bookings, revenue: Math.round(d.revenue) }));

    res.json({
      properties: propertyStats,
      summary: {
        totalProperties: properties.length,
        totalRevenue: Math.round(totalRevenue),
        totalBookings,
        totalViews,
        totalFavorites,
        overallRating: overallRating ? Math.round(overallRating * 10) / 10 : null,
        bestProperty: bestProperty
          ? { id: bestProperty.id, title: bestProperty.title, revenue: bestProperty.revenue }
          : null,
        topCity,
      },
      monthlyChart,
    });
  } catch (error) {
    logger.error('getLandlordStatistics error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};
