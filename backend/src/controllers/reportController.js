import { PrismaClient } from '@prisma/client';
import {
  generateUsersReport,
  generateBookingsReport,
  generatePropertiesReport,
  generateRevenueReport,
  generateLandlordReport,
} from '../services/reportService.js';

const prisma = new PrismaClient();

const pipeDoc = (doc, res, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
};

// ─── Admin Reports ────────────────────────────────────────────────────────────

/** GET /api/reports/admin/users */
export const adminUsersReport = async (req, res) => {
  try {
    const [users, statsRes] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, email: true, name: true, role: true,
          isBanned: true, createdAt: true,
          _count: { select: { bookings: true, properties: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'LANDLORD' } }),
        prisma.user.count({ where: { isBanned: true } }),
        prisma.user.count({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }
        }),
      ]),
    ]);

    const [totalUsers, landlords, bannedUsers, newUsers7d] = statsRes;
    const doc = generateUsersReport(users, { totalUsers, landlords, bannedUsers, newUsers7d });
    pipeDoc(doc, res, `domrent-users-${Date.now()}.pdf`);
  } catch (error) {
    console.error('adminUsersReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};

/** GET /api/reports/admin/bookings */
export const adminBookingsReport = async (req, res) => {
  try {
    const [bookings, aggr, completedCount] = await Promise.all([
      prisma.booking.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.booking.aggregate({ _sum: { totalPrice: true }, _avg: { totalPrice: true } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
    ]);

    const doc = generateBookingsReport(bookings, {
      total: bookings.length,
      completed: completedCount,
      totalRevenue: aggr._sum.totalPrice || 0,
      avgPrice: aggr._avg.totalPrice || 0,
    });
    pipeDoc(doc, res, `domrent-bookings-${Date.now()}.pdf`);
  } catch (error) {
    console.error('adminBookingsReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};

/** GET /api/reports/admin/properties */
export const adminPropertiesReport = async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      include: {
        city: { select: { name: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const doc = generatePropertiesReport(properties);
    pipeDoc(doc, res, `domrent-properties-${Date.now()}.pdf`);
  } catch (error) {
    console.error('adminPropertiesReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};

/** GET /api/reports/admin/revenue */
export const adminRevenueReport = async (req, res) => {
  try {
    const since12mo = new Date();
    since12mo.setMonth(since12mo.getMonth() - 11);
    since12mo.setDate(1);

    const [bookings, aggr] = await Promise.all([
      prisma.booking.findMany({
        where: { createdAt: { gte: since12mo }, status: { not: 'CANCELLED' } },
        select: { createdAt: true, totalPrice: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.booking.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalPrice: true },
      }),
    ]);

    const monthlyMap = {};
    bookings.forEach(b => {
      const key = b.createdAt.toISOString().slice(0, 7);
      if (!monthlyMap[key]) monthlyMap[key] = { bookings: 0, revenue: 0 };
      monthlyMap[key].bookings++;
      monthlyMap[key].revenue += b.totalPrice;
    });

    const monthlyData = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({ month, bookings: d.bookings, revenue: Math.round(d.revenue) }));

    const doc = generateRevenueReport(monthlyData, aggr._sum.totalPrice || 0);
    pipeDoc(doc, res, `domrent-revenue-${Date.now()}.pdf`);
  } catch (error) {
    console.error('adminRevenueReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};

// ─── Landlord Reports ─────────────────────────────────────────────────────────

/** GET /api/reports/landlord/properties */
export const landlordPropertiesReport = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const properties = await prisma.property.findMany({
      where: { ownerId },
      include: {
        city: { select: { name: true } },
        bookings: { select: { totalPrice: true, status: true } },
        reviews: { select: { rating: true } },
        _count: { select: { favorites: true, bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const propertiesStats = properties.map(p => {
      const revenue = p.bookings
        .filter(b => b.status !== 'CANCELLED')
        .reduce((s, b) => s + b.totalPrice, 0);
      const ratings = p.reviews.map(r => r.rating);
      const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
      return {
        ...p,
        city: p.city.name,
        viewCount: p.viewCount,
        revenue,
        bookingsCount: p._count.bookings,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      };
    });

    const summary = {
      totalProperties: properties.length,
      totalRevenue: propertiesStats.reduce((s, p) => s + p.revenue, 0),
      totalBookings: propertiesStats.reduce((s, p) => s + p.bookingsCount, 0),
      totalViews: propertiesStats.reduce((s, p) => s + (p.viewCount || 0), 0),
    };

    const doc = generateLandlordReport(propertiesStats, summary);
    pipeDoc(doc, res, `domrent-my-properties-${Date.now()}.pdf`);
  } catch (error) {
    console.error('landlordPropertiesReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};

/** GET /api/reports/landlord/bookings */
export const landlordBookingsReport = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { property: { ownerId: req.user.id } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const aggr = await prisma.booking.aggregate({
      where: { property: { ownerId: req.user.id }, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
      _avg: { totalPrice: true },
    });

    const doc = generateBookingsReport(bookings, {
      total: bookings.length,
      completed: bookings.filter(b => b.status === 'COMPLETED').length,
      totalRevenue: aggr._sum.totalPrice || 0,
      avgPrice: aggr._avg.totalPrice || 0,
    });
    pipeDoc(doc, res, `domrent-my-bookings-${Date.now()}.pdf`);
  } catch (error) {
    console.error('landlordBookingsReport error:', error);
    res.status(500).json({ error: 'Ошибка генерации отчёта' });
  }
};
