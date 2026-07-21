import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Получение всех городов с информацией о количестве свойств
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getAllCities = async (req, res) => {
  try {
    const cities = await prisma.city.findMany({
      include: {
        _count: {
          select: {
            properties: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      cities: cities.map(city => ({
        id: city.id,
        name: city.name,
        propertyCount: city._count.properties,
        createdAt: city.createdAt
      }))
    });
  } catch (error) {
    logger.error('Get all cities error:', error);
    res.status(500).json({ error: 'Ошибка при получении городов' });
  }
};
