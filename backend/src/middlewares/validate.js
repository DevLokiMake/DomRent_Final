import { z } from 'zod';
import logger from '../config/logger.js';

/**
 * Schemas для валидации данных
 */

// Требования к паролю едины для регистрации и сброса пароля
const passwordSchema = z.string()
  .min(8, 'Пароль должен быть минимум 8 символов')
  .regex(/[A-Za-zА-Яа-яЁё]/, 'Пароль должен содержать хотя бы одну букву')
  .regex(/[0-9]/, 'Пароль должен содержать хотя бы одну цифру');

// Регистрация пользователя
export const registerSchema = z.object({
  email: z.string().email('Email должен быть валидным'),
  password: passwordSchema,
  name: z.string().transform(v => v.trim() || undefined).optional(),
  phone: z.string().transform(v => v.trim() || undefined).optional()
    .refine(v => !v || /^\+?[0-9\s\-()]{7,20}$/.test(v), 'Введите корректный номер телефона'),
  // Разрешаем только USER/LANDLORD при регистрации — ADMIN назначается только через admin-панель
  role: z.enum(['USER', 'LANDLORD']).optional().default('USER'),
  // Honeypot: скрытое поле формы. Реальные пользователи его не видят и не заполняют.
  website: z.string().optional(),
});

// Вход пользователя
export const loginSchema = z.object({
  email: z.string().email('Email должен быть валидным'),
  password: z.string().min(1, 'Пароль обязателен')
});

// Создание объекта недвижимости
export const propertySchema = z.object({
  title: z.string().min(1, 'Название объекта обязательно'),
  description: z.string().min(1, 'Описание обязательно'),
  price: z.number().positive('Цена должна быть положительной'),
  type: z.enum(['квартира', 'дом', 'комната'], {
    errorMap: () => ({ message: 'Тип должен быть: квартира, дом или комната' })
  }),
  contractType: z.enum(['RENT', 'SALE'], {
    errorMap: () => ({ message: 'Тип сделки должен быть RENT (Аренда) или SALE (Продажа)' })
  }),
  city: z.string().min(1, 'Город обязателен'),
  images: z.array(z.string()).optional().default([]),
  coverImage: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  // Новые поля
  rooms: z.number().int().min(1).max(20).nullable().optional(),
  hasWifi: z.boolean().optional().default(false),
  hasParking: z.boolean().optional().default(false),
  petsAllowed: z.boolean().optional().default(false),
});

// Обновление объекта недвижимости
export const updatePropertySchema = propertySchema.partial();

// Бронирование (with future date validation)
export const bookingSchema = z.object({
  propertyId: z.number().int().positive('ID объекта должен быть положительным числом'),
  startDate: z.string().datetime('Начальная дата должна быть в формате ISO 8601').or(z.date()),
  endDate: z.string().datetime('Конечная дата должна быть в формате ISO 8601').or(z.date())
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  },
  { message: 'Конечная дата должна быть позже начальной даты' }
).refine(
  (data) => {
    const start = new Date(data.startDate);
    const now = new Date();
    // Даты не должны быть в прошлом (позволяем текущий день)
    return start >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  },
  { message: 'Дата начала не может быть в прошлом' }
);

// Обновление профиля
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Имя не может быть пустым').optional(),
  phone: z.string().optional()
});

// Запрос сброса пароля
export const forgotPasswordSchema = z.object({
  email: z.string().email('Введите корректный email')
});

// Сброс пароля
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token обязателен'),
  password: passwordSchema
});

// Подтверждение email
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token обязателен')
});

// Повторная отправка письма подтверждения
export const resendVerificationSchema = z.object({
  email: z.string().email('Введите корректный email')
});

// Admin: бан/разбан пользователя
export const banUserSchema = z.object({
  banned: z.boolean({ errorMap: () => ({ message: 'Поле banned должно быть boolean' }) })
});

// Admin: смена роли пользователя
export const changeRoleSchema = z.object({
  role: z.enum(['USER', 'LANDLORD', 'ADMIN'], {
    errorMap: () => ({ message: 'Допустимые роли: USER, LANDLORD, ADMIN' })
  })
});

// Ручная блокировка/разблокировка дат объекта
export const blockedDatesSchema = z.object({
  dates: z.array(z.string().min(1)).min(1, 'Передайте массив дат'),
  reason: z.string().optional().default('manual'),
});

export const unblockDatesSchema = z.object({
  dates: z.array(z.string().min(1)).min(1, 'Передайте массив дат'),
});

// Отправка сообщения в чате бронирования
export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Сообщение не может быть пустым').max(2000, 'Сообщение слишком длинное (максимум 2000 символов)')
});

// Query-параметры истории ценового индекса
export const priceHistoryQuerySchema = z.object({
  cityId: z.coerce.number().int().positive().optional(),
  contractType: z.enum(['RENT', 'SALE']).optional(),
});

/**
 * Middleware фабрика для валидации запроса
 * @param {ZodSchema} schema - Zod schema для валидации
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const parsed = schema.safeParse(req.body);

      // В некоторых роутингах body может приходить undefined.
      // safeParse для Zod вернет success=false, но путь (err.path) будет пустым,
      // из-за чего клиенту сложнее понять ошибку.
      if (!parsed.success) {
        const issues = parsed.error?.issues ?? parsed.error?.errors ?? [];
        const errors = issues.map(err => ({
          path: Array.isArray(err.path) ? err.path.join('.') : String(err.path),
          message: err.message
        }));

        return res.status(400).json({
          error: 'Ошибка валидации',
          details: errors
        });
      }

      // Заменяем body на валидированные данные
      req.body = parsed.data;
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  };
};

/**
 * Middleware для валидации query параметров
 * @param {ZodSchema} schema - Zod schema для валидации
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const parsed = schema.safeParse(req.query);
      
      if (!parsed.success) {
        const issues = parsed.error?.issues ?? parsed.error?.errors ?? [];
        const errors = issues.map(err => ({
          path: Array.isArray(err.path) ? err.path.join('.') : String(err.path),
          message: err.message
        }));

        return res.status(400).json({
          error: 'Ошибка валидации параметров',
          details: errors
        });
      }

      // Заменяем query на валидированные данные
      req.query = parsed.data;
      next();
    } catch (error) {
      logger.error('Query validation error:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  };
};

export default validate;
