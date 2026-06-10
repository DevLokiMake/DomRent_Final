import { PrismaClient } from '@prisma/client';
import { createNotification } from './notificationController.js';
import { logAdminAction } from '../helpers/auditLog.js';
import { sendPropertyModerationNotification } from '../services/telegramService.js';

const prisma = new PrismaClient();

// ─── Статистика ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * Расширенная статистика + топ-5 объявлений + динамика по дням
 */
export const getStats = async (req, res) => {
  try {
    const since7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalProperties,
      totalBookings,
      pendingProperties,
      totalRevenue,
      bannedUsers,
      newUsers7d,
      newBookings7d,
      approvedProperties,
      completedBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.booking.count(),
      prisma.property.count({ where: { status: 'PENDING' } }),
      prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { createdAt: { gte: since7days } } }),
      prisma.booking.count({ where: { createdAt: { gte: since7days } } }),
      prisma.property.count({ where: { status: 'APPROVED' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
    ]);

    // Топ-5 объявлений по количеству бронирований
    const top5Properties = await prisma.property.findMany({
      where: { status: 'APPROVED' },
      include: {
        city: { select: { name: true } },
        owner: { select: { name: true, email: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
      orderBy: { bookings: { _count: 'desc' } },
      take: 5,
    });

    // Динамика бронирований за последние 30 дней (по дням)
    const bookingsRaw = await prisma.booking.findMany({
      where: { createdAt: { gte: since30days } },
      select: { createdAt: true, totalPrice: true },
      orderBy: { createdAt: 'asc' },
    });

    // Группировка по дате
    const bookingsByDay = {};
    bookingsRaw.forEach(b => {
      const day = b.createdAt.toISOString().split('T')[0];
      if (!bookingsByDay[day]) bookingsByDay[day] = { count: 0, revenue: 0 };
      bookingsByDay[day].count++;
      bookingsByDay[day].revenue += b.totalPrice;
    });

    const bookingsChart = Object.entries(bookingsByDay).map(([date, data]) => ({
      date,
      count: data.count,
      revenue: data.revenue,
    }));

    // Статистика по ролям
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    res.json({
      stats: {
        totalUsers,
        totalProperties,
        approvedProperties,
        totalBookings,
        completedBookings,
        pendingProperties,
        totalRevenue: totalRevenue._sum.totalPrice || 0,
        bannedUsers,
        newUsers7d,
        newBookings7d,
      },
      top5Properties: top5Properties.map(p => ({
        id: p.id,
        title: p.title,
        city: p.city.name,
        price: p.price,
        coverImage: p.coverImage,
        bookingsCount: p._count.bookings,
        reviewsCount: p._count.reviews,
        owner: p.owner.name || p.owner.email,
      })),
      bookingsChart,
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count.id })),
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// ─── Аналитика (12 месяцев) ──────────────────────────────────────────────────

/**
 * GET /api/admin/analytics
 * Данные для дашборда: помесячные графики за последние 12 месяцев
 */
export const getAnalytics = async (req, res) => {
  try {
    const since12mo = new Date();
    since12mo.setMonth(since12mo.getMonth() - 11);
    since12mo.setDate(1);
    since12mo.setHours(0, 0, 0, 0);

    const [usersRaw, bookingsRaw, top10Props, topCitiesRaw] = await Promise.all([
      // Пользователи по месяцам
      prisma.user.findMany({
        where: { createdAt: { gte: since12mo } },
        select: { createdAt: true },
      }),
      // Бронирования по месяцам
      prisma.booking.findMany({
        where: { createdAt: { gte: since12mo } },
        select: { createdAt: true, totalPrice: true, status: true },
      }),
      // Топ-10 объектов
      prisma.property.findMany({
        where: { status: 'APPROVED' },
        include: {
          city: { select: { name: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { bookings: { _count: 'desc' } },
        take: 10,
      }),
      // Топ городов
      prisma.booking.groupBy({
        by: ['propertyId'],
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
    ]);

    // Группировка по месяцам
    const buildMonthMap = () => {
      const map = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        map[key] = 0;
      }
      return map;
    };

    const usersPerMonth = buildMonthMap();
    usersRaw.forEach(u => {
      const k = u.createdAt.toISOString().slice(0, 7);
      if (k in usersPerMonth) usersPerMonth[k]++;
    });

    const bookingsPerMonth = { ...buildMonthMap() };
    const revenuePerMonth = { ...buildMonthMap() };
    bookingsRaw.forEach(b => {
      const k = b.createdAt.toISOString().slice(0, 7);
      if (k in bookingsPerMonth) {
        bookingsPerMonth[k]++;
        if (b.status !== 'CANCELLED') revenuePerMonth[k] += b.totalPrice;
      }
    });

    const months = Object.keys(usersPerMonth).sort();
    const monthlyUsers = months.map(m => ({ month: m, users: usersPerMonth[m] }));
    const monthlyBookings = months.map(m => ({
      month: m,
      bookings: bookingsPerMonth[m],
      revenue: Math.round(revenuePerMonth[m] || 0),
    }));

    // Топ-10 объектов
    const top10 = top10Props.map(p => ({
      id: p.id,
      title: p.title.length > 30 ? p.title.slice(0, 30) + '…' : p.title,
      city: p.city.name,
      bookings: p._count.bookings,
      viewCount: p.viewCount,
    }));

    // Топ городов — агрегируем через bookings → property → city
    const cityStats = await prisma.booking.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { property: { select: { city: { select: { name: true } } } }, totalPrice: true },
      take: 10000,
    });
    const cityMap = {};
    cityStats.forEach(b => {
      const city = b.property?.city?.name;
      if (!city) return;
      if (!cityMap[city]) cityMap[city] = { bookings: 0, revenue: 0 };
      cityMap[city].bookings++;
      cityMap[city].revenue += b.totalPrice;
    });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1].bookings - a[1].bookings)
      .slice(0, 8)
      .map(([city, d]) => ({ city, bookings: d.bookings, revenue: Math.round(d.revenue) }));

    res.json({ monthlyUsers, monthlyBookings, top10, topCities });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: 'Ошибка получения аналитики' });
  }
};

// ─── Управление пользователями ────────────────────────────────────────────────

export const getUsers = async (req, res) => {
  try {
    const { search, role, banned, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (banned === 'true') where.isBanned = true;
    if (banned === 'false') where.isBanned = false;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, phone: true, avatar: true,
          role: true, isBanned: true, createdAt: true,
          _count: { select: { bookings: true, properties: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
};

export const toggleUserBan = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Некорректный ID' });

    const { banned } = req.body;
    if (typeof banned !== 'boolean') {
      return res.status(400).json({ error: 'Поле banned должно быть boolean' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    if (target.role === 'ADMIN') return res.status(400).json({ error: 'Нельзя заблокировать другого администратора' });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: banned },
      select: { id: true, email: true, name: true, role: true, isBanned: true }
    });

    // Audit log
    await logAdminAction(
      req.user.id,
      banned ? 'BAN_USER' : 'UNBAN_USER',
      userId,
      'USER',
      { email: target.email, name: target.name }
    );

    res.json({ message: banned ? 'Пользователь заблокирован' : 'Пользователь разблокирован', user });
  } catch (error) {
    console.error('toggleUserBan error:', error);
    res.status(500).json({ error: 'Ошибка при изменении статуса пользователя' });
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    const validRoles = ['USER', 'LANDLORD', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Допустимые роли: ${validRoles.join(', ')}` });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    });

    await logAdminAction(req.user.id, 'CHANGE_ROLE', userId, 'USER', {
      oldRole: target.role,
      newRole: role,
      email: target.email,
    });

    res.json({ message: 'Роль обновлена', user });
  } catch (error) {
    console.error('changeUserRole error:', error);
    res.status(500).json({ error: 'Ошибка при изменении роли' });
  }
};

// ─── Модерация объявлений ─────────────────────────────────────────────────────

export const getPropertiesAdmin = async (req, res) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          city: { select: { id: true, name: true } },
          _count: { select: { bookings: true, reviews: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.property.count({ where }),
    ]);

    res.json({ properties, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getPropertiesAdmin error:', error);
    res.status(500).json({ error: 'Ошибка получения объявлений' });
  }
};

export const approveProperty = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ error: 'Некорректный ID' });

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { status: 'APPROVED', rejectionReason: null },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });

    await createNotification(
      property.ownerId,
      'PROPERTY_APPROVED',
      '✅ Объявление одобрено',
      `Ваше объявление «${property.title}» прошло модерацию и теперь видно в поиске`,
      propertyId
    );

    await logAdminAction(req.user.id, 'APPROVE_PROPERTY', propertyId, 'PROPERTY', {
      title: property.title,
      ownerEmail: property.owner.email,
    });

    sendPropertyModerationNotification(property.ownerId, { propertyTitle: property.title, approved: true }).catch(() => {});

    res.json({ message: 'Объявление одобрено', property });
  } catch (error) {
    console.error('approveProperty error:', error);
    res.status(500).json({ error: 'Ошибка при одобрении' });
  }
};

export const rejectProperty = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ error: 'Некорректный ID' });

    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Укажите причину отклонения' });

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { status: 'REJECTED', rejectionReason: reason.trim() },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });

    await createNotification(
      property.ownerId,
      'PROPERTY_REJECTED',
      '❌ Объявление отклонено',
      `Объявление «${property.title}» отклонено. Причина: ${reason.trim()}`,
      propertyId
    );

    await logAdminAction(req.user.id, 'REJECT_PROPERTY', propertyId, 'PROPERTY', {
      title: property.title,
      reason: reason.trim(),
      ownerEmail: property.owner.email,
    });

    sendPropertyModerationNotification(property.ownerId, { propertyTitle: property.title, approved: false, reason: reason.trim() }).catch(() => {});

    res.json({ message: 'Объявление отклонено', property });
  } catch (error) {
    console.error('rejectProperty error:', error);
    res.status(500).json({ error: 'Ошибка при отклонении' });
  }
};

// ─── Все бронирования (для admin) ────────────────────────────────────────────

export const getAdminBookings = async (req, res) => {
  try {
    const { status, page = '1', limit = '15' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          property: {
            select: { id: true, title: true, price: true, city: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getAdminBookings error:', error);
    res.status(500).json({ error: 'Ошибка получения бронирований' });
  }
};

// ─── Все отзывы (для admin) ───────────────────────────────────────────────────

export const getAdminReviews = async (req, res) => {
  try {
    const { page = '1', limit = '15' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: {
          author: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count(),
    ]);

    res.json({ reviews, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getAdminReviews error:', error);
    res.status(500).json({ error: 'Ошибка получения отзывов' });
  }
};

export const deleteAdminReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) return res.status(400).json({ error: 'Некорректный ID' });

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });

    await prisma.review.delete({ where: { id: reviewId } });

    await logAdminAction(req.user.id, 'DELETE_REVIEW', reviewId, 'REVIEW', {
      propertyId: review.propertyId, authorId: review.authorId,
    });

    res.json({ message: 'Отзыв удалён' });
  } catch (error) {
    console.error('deleteAdminReview error:', error);
    res.status(500).json({ error: 'Ошибка удаления отзыва' });
  }
};

// ─── Журнал действий ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit
 * Журнал всех действий администраторов
 */
export const getAuditLog = async (req, res) => {
  try {
    const { page = '1', limit = '20', action } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('getAuditLog error:', error);
    res.status(500).json({ error: 'Ошибка получения журнала' });
  }
};
