import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import propertyRoutes from './src/routes/property.js';
import bookingRoutes from './src/routes/booking.js';
import favoriteRoutes from './src/routes/favorite.js';
import cityRoutes from './src/routes/city.js';
import reviewRoutes from './src/routes/review.js';
import messageRoutes from './src/routes/message.js';
import notificationRoutes from './src/routes/notification.js';
import uploadRoutes from './src/routes/upload.js';
import adminRoutes from './src/routes/admin.js';
import telegramRoutes from './src/routes/telegram.js';
import landlordRoutes from './src/routes/landlord.js';
import reportRoutes from './src/routes/report.js';

dotenv.config();

console.log(`[boot] PORT=${process.env.PORT} NODE_ENV=${process.env.NODE_ENV} FRONTEND_URL=${process.env.FRONTEND_URL}`);

const app = express();
const prisma = new PrismaClient();

app.set('trust proxy', 1);
app.use(helmet());

// Rate limiting: auth endpoints — 10 попыток / 15 мин
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Повторите через 15 минут.' },
});

// Общий лимит для всего API — 200 запросов / 15 мин
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Допустимые origins: localhost + все URL из FRONTEND_URL (через запятую)
// Пример .env: FRONTEND_URL=https://domrent.vercel.app,https://www.domrent.kz
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim()).filter(Boolean)
    : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (мобильные приложения, Postman, SSR)
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/landlord', landlordRoutes);
app.use('/api/reports', reportRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

const start = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    prisma.$connect()
      .then(() => console.log('Connected to database'))
      .catch((e) => console.error('DB connect warning:', e.message));
  });
};

start();
