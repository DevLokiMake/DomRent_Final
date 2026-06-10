import express from 'express';
import { getLandlordStatistics } from '../controllers/landlordController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireLandlord } from '../middlewares/requireRole.js';

const router = express.Router();

// GET /api/landlord/statistics
router.get('/statistics', authenticateToken, requireLandlord, getLandlordStatistics);

export default router;
