import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Создание нового объекта недвижимости (только для LANDLORD)
 * @param {Object} req - Express request объект (body уже валидирован middleware)
 * @param {Object} res - Express response объект
 */
export const createProperty = async (req, res) => {
  try {
    // Проверка роли пользователя
    if (req.user.role !== 'LANDLORD') {
      return res.status(403).json({ 
        error: 'Только арендодатели могут добавлять объекты' 
      });
    }

    const {
      title, description, price, type, contractType, city, images, coverImage,
      latitude, longitude, rooms, hasWifi, hasParking, petsAllowed
    } = req.body;

    // Логика: если города нет, создать его
    let cityRecord = await prisma.city.findUnique({
      where: { name: city }
    });

    if (!cityRecord) {
      cityRecord = await prisma.city.create({
        data: { name: city }
      });
    }

    // Создание объекта (статус PENDING — ждёт модерации)
    const property = await prisma.property.create({
      data: {
        title,
        description,
        price,
        type,
        contractType,
        cityId: cityRecord.id,
        images: images || [],
        coverImage: coverImage ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        rooms: rooms ? parseInt(rooms) : null,
        hasWifi: hasWifi ?? false,
        hasParking: hasParking ?? false,
        petsAllowed: petsAllowed ?? false,
        status: 'PENDING',
        ownerId: req.user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        },
        city: true
      }
    });

    res.status(201).json({
      message: 'Объект успешно создан',
      property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Ошибка при создании объекта' });
  }
};

/**
 * Получение всех объектов с поддержкой фильтрации
 * Query параметры: city, minPrice, maxPrice, type
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getAllProperties = async (req, res) => {
  try {
    const {
      cityId, city, minPrice, maxPrice, type, contractType,
      rooms, hasWifi, hasParking, petsAllowed
    } = req.query;

    // В публичном поиске показываем только APPROVED объекты
    const where = { status: 'APPROVED' };

    // Фильтрация по городу
    if (cityId) {
      where.cityId = parseInt(cityId);
    } else if (city) {
      const cityRecord = await prisma.city.findUnique({ where: { name: city } });
      if (cityRecord) {
        where.cityId = cityRecord.id;
      } else {
        return res.json({ count: 0, properties: [] });
      }
    }

    if (type) where.type = type;
    if (contractType) where.contractType = contractType;

    // Диапазон цен
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Количество комнат
    if (rooms) where.rooms = parseInt(rooms);

    // Булевы фильтры (удобства)
    if (hasWifi === 'true') where.hasWifi = true;
    if (hasParking === 'true') where.hasParking = true;
    if (petsAllowed === 'true') where.petsAllowed = true;

    const properties = await prisma.property.findMany({
      where,
      include: {
        owner: { select: { id: true, email: true, name: true, phone: true } },
        city: true,
        _count: { select: { bookings: true, favorites: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ count: properties.length, properties });
  } catch (error) {
    console.error('Get all properties error:', error);
    res.status(500).json({ error: 'Ошибка при получении объектов' });
  }
};

/**
 * Получение объекта по ID
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    // Валидация ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID объекта' });
    }

    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        },
        city: true,
        bookings: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            userId: true
          }
        },
        favorites: {
          select: {
            userId: true
          }
        },
        _count: {
          select: {
            bookings: true,
            favorites: true
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Не показывать PENDING/REJECTED чужим пользователям
    const requestUserId = req.user?.id;
    const isOwner = property.ownerId === requestUserId;
    const isAdmin = req.user?.role === 'ADMIN';
    if (property.status !== 'APPROVED' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Считаем просмотры (только для APPROVED, не от владельца)
    if (property.status === 'APPROVED' && !isOwner) {
      prisma.property.update({
        where: { id: parseInt(id) },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});
    }

    res.json({ property });
  } catch (error) {
    console.error('Get property by ID error:', error);
    res.status(500).json({ error: 'Ошибка при получении объекта' });
  }
};

/**
 * Удаление объекта (только владелец)
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Валидация ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID объекта' });
    }

    const propertyId = parseInt(id);

    // Проверка существования объекта
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Проверка прав владельца
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Вы можете удалить только собственные объекты' 
      });
    }

    // Удаление связанных данных (бронирования и избранное)
    await prisma.booking.deleteMany({
      where: { propertyId }
    });

    await prisma.favorite.deleteMany({
      where: { propertyId }
    });

    // Удаление объекта
    await prisma.property.delete({
      where: { id: propertyId }
    });

    res.json({ message: 'Объект успешно удален' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Ошибка при удалении объекта' });
  }
};

/**
 * Обновление объекта (только владелец)
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Валидация ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID объекта' });
    }

    const propertyId = parseInt(id);

    // Валидация данных
    const updateSchema = propertySchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: parsed.error.errors[0].message 
      });
    }

    // Проверка существования объекта
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Проверка прав владельца
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Вы можете редактировать только собственные объекты' 
      });
    }

    // Если есть город в запросе, обработаем его
    let updateData = { ...parsed.data };
    if (parsed.data.city) {
      let cityRecord = await prisma.city.findUnique({
        where: { name: parsed.data.city }
      });

      if (!cityRecord) {
        cityRecord = await prisma.city.create({
          data: { name: parsed.data.city }
        });
      }

      updateData.cityId = cityRecord.id;
      delete updateData.city; // Удалим город из обновления, так как используем cityId
    }

    // Обновление объекта
    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        },
        city: true
      }
    });

    res.json({
      message: 'Объект успешно обновлен',
      property: updatedProperty
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении объекта' });
  }
};

/**
 * GET /api/properties/popular?limit=6
 * Популярные объекты по количеству бронирований
 */
export const getPopularProperties = async (req, res) => {
  try {
    const { limit = '6' } = req.query;
    const properties = await prisma.property.findMany({
      where: { status: 'APPROVED' },
      include: {
        city: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { bookings: true, favorites: true } }
      },
      orderBy: { bookings: { _count: 'desc' } },
      take: Math.min(parseInt(limit) || 6, 20),
    });
    res.json({ properties });
  } catch (error) {
    console.error('getPopularProperties error:', error);
    res.status(500).json({ error: 'Ошибка' });
  }
};

/**
 * GET /api/properties/:id/similar
 * Похожие объекты (тот же город, затем тот же тип)
 */
export const getSimilarProperties = async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) return res.status(400).json({ error: 'Некорректный ID' });

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { type: true, cityId: true }
    });
    if (!property) return res.status(404).json({ error: 'Не найден' });

    // Сначала тот же город
    let similar = await prisma.property.findMany({
      where: { status: 'APPROVED', id: { not: propertyId }, cityId: property.cityId },
      include: {
        city: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { bookings: true, favorites: true } }
      },
      orderBy: { bookings: { _count: 'desc' } },
      take: 4,
    });

    // Если меньше 4 — дополняем тем же типом из других городов
    if (similar.length < 4) {
      const ids = [propertyId, ...similar.map(p => p.id)];
      const more = await prisma.property.findMany({
        where: { status: 'APPROVED', id: { notIn: ids }, type: property.type },
        include: {
          city: true,
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { bookings: true, favorites: true } }
        },
        orderBy: { bookings: { _count: 'desc' } },
        take: 4 - similar.length,
      });
      similar = [...similar, ...more];
    }

    res.json({ properties: similar });
  } catch (error) {
    console.error('getSimilarProperties error:', error);
    res.status(500).json({ error: 'Ошибка' });
  }
};

/**
 * GET /api/properties/my
 * Все объекты текущего пользователя (landlord)
 */
export const getMyProperties = async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      select: {
        id: true, title: true, type: true, status: true,
        images: true, coverImage: true, price: true,
        city: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ properties });
  } catch (error) {
    console.error('getMyProperties error:', error);
    res.status(500).json({ error: 'Ошибка' });
  }
};

/**
 * Формула Haversine — расстояние между двумя точками на сфере (км)
 */
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * GET /api/properties/nearby?lat=...&lng=...&radius=10
 * Возвращает объекты в радиусе (км) от точки, отсортированные по расстоянию
 */
export const getNearbyProperties = async (req, res) => {
  try {
    const { lat, lng, radius = '10' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Параметры lat и lng обязательны' });
    }

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if ([centerLat, centerLng, radiusKm].some(isNaN)) {
      return res.status(400).json({ error: 'Некорректные числовые параметры' });
    }

    const allProperties = await prisma.property.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null }
      },
      include: {
        owner: { select: { id: true, email: true, name: true, phone: true } },
        city: true,
        _count: { select: { bookings: true, favorites: true } }
      }
    });

    const nearby = allProperties
      .map(p => ({
        ...p,
        distance: Math.round(haversineKm(centerLat, centerLng, p.latitude, p.longitude) * 10) / 10
      }))
      .filter(p => p.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    res.json({ count: nearby.length, properties: nearby });
  } catch (error) {
    console.error('Get nearby properties error:', error);
    res.status(500).json({ error: 'Ошибка при поиске объектов рядом' });
  }
};
