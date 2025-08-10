import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();
const adminOnly = [requireAuth, requireRole(['admin'])];

router.get('/users', adminOnly, AdminController.listUsers);
router.get('/users/:user_id', adminOnly, AdminController.getUser);
router.patch('/users/:user_id', adminOnly, AdminController.updateUser);
router.patch('/users/:user_id/status', adminOnly, AdminController.updateUserStatus);
router.delete('/users/:user_id', adminOnly, AdminController.deleteUser);

router.get('/metrics/overview', adminOnly, AdminController.getSystemMetrics);
router.patch('/settings', adminOnly, AdminController.updateSystemSettings);
router.get('/audit-logs', adminOnly, AdminController.getAuditLogs);
router.post('/reports/generate', adminOnly, AdminController.triggerReportGeneration);

export default router;