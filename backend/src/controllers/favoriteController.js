import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

const propertyIdSchema = z.object({
  propertyId: z.coerce.number().int().positive('ID объекта должен быть положительным числом')
});

/**
 * Переключение добавления/удаления объекта из избранного
 * Если объект уже в избранном — удаляет его
 * Если объект не в избранном — добавляет его
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const toggleFavorite = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Валидация
    const parsed = propertyIdSchema.safeParse({ propertyId });
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors[0].message
      });
    }

    const propertyIdInt = parsed.data.propertyId;

    // Проверка существования объекта
    const property = await prisma.property.findUnique({
      where: { id: propertyIdInt }
    });

    if (!property) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    // Проверка наличия в избранном через составной ключ
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: propertyIdInt
        }
      }
    });

    if (existingFavorite) {
      // Удаление из избранного
      await prisma.favorite.delete({
        where: {
          userId_propertyId: {
            userId: req.user.id,
            propertyId: propertyIdInt
          }
        }
      });

      return res.json({
        message: 'Объект удален из избранного',
        action: 'removed',
        propertyId: propertyIdInt
      });
    } else {
      // Добавление в избранное
      const favorite = await prisma.favorite.create({
        data: {
          userId: req.user.id,
          propertyId: propertyIdInt
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              price: true,
              type: true,
              images: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      });

      return res.status(201).json({
        message: 'Объект добавлен в избранное',
        action: 'added',
        favorite
      });
    }
  } catch (error) {
    logger.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении избранного' });
  }
};

/**
 * Получение всех избранных объектов пользователя
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const getMyFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            city: true,
            price: true,
            type: true,
            images: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            _count: {
              select: {
                bookings: true,
                favorites: true
              }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    // Трансформация результата для удобства
    const properties = favorites.map(fav => ({
      ...fav.property,
      isFavorited: true
    }));

    res.json({
      count: properties.length,
      favorites: properties
    });
  } catch (error) {
    logger.error('Get my favorites error:', error);
    res.status(500).json({ error: 'Ошибка при получении избранного' });
  }
};

/**
 * Проверка, добавлен ли объект в избранное (вспомогательный метод)
 * @param {Object} req - Express request объект
 * @param {Object} res - Express response объект
 */
export const isFavorited = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const parsed = propertyIdSchema.safeParse({ propertyId });
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.errors[0].message
      });
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: parsed.data.propertyId
        }
      }
    });

    res.json({
      propertyId: parsed.data.propertyId,
      isFavorited: !!favorite
    });
  } catch (error) {
    logger.error('Is favorited error:', error);
    res.status(500).json({ error: 'Ошибка при проверке избранного' });
  }
};