import express from 'express';
import { getPriceIndex, getPriceHistory, getMyStats } from '../controllers/statsController.js';
import { validateQuery, priceHistoryQuerySchema } from '../middlewares/validate.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Публичные — ценовой индекс полезен и незалогиненным пользователям при выборе города
router.get('/price-index', getPriceIndex);
router.get('/price-history', validateQuery(priceHistoryQuerySchema), getPriceHistory);

// Личная статистика — требует авторизации
router.get('/my', authenticateToken, getMyStats);

export default router;
