import express from 'express';
import {
  adminUsersReport,
  adminBookingsReport,
  adminPropertiesReport,
  adminRevenueReport,
  landlordPropertiesReport,
  landlordBookingsReport,
} from '../controllers/reportController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireAdmin, requireLandlord } from '../middlewares/requireRole.js';

const router = express.Router();

// ─── Admin Reports ────────────────────────────────────────────────────────────
router.get('/admin/users',      authenticateToken, requireAdmin, adminUsersReport);
router.get('/admin/bookings',   authenticateToken, requireAdmin, adminBookingsReport);
router.get('/admin/properties', authenticateToken, requireAdmin, adminPropertiesReport);
router.get('/admin/revenue',    authenticateToken, requireAdmin, adminRevenueReport);

// ─── Landlord Reports ─────────────────────────────────────────────────────────
router.get('/landlord/properties', authenticateToken, requireLandlord, landlordPropertiesReport);
router.get('/landlord/bookings',   authenticateToken, requireLandlord, landlordBookingsReport);

export default router;
