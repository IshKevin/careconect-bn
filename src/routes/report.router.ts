import { Router } from 'express';
import * as ReportController from '../controllers/report.controller';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();
const adminOnly = [requireAuth, requireRole(['admin'])];

router.get('/admin/metrics/overview', adminOnly, ReportController.getOverviewMetrics);
router.get('/admin/activity/logs', adminOnly, ReportController.getActivityLogs);
router.get('/admin/reports/appointments', adminOnly, ReportController.getAppointmentTrends);
router.get('/admin/reports/invoices', adminOnly, ReportController.getInvoiceSummaries);

router.get('/admin/reports/financial', adminOnly, ReportController.getFinancialReports);
router.get('/admin/reports/clinical', adminOnly, ReportController.getClinicalReports);
router.get('/admin/reports/user-activity', adminOnly, ReportController.getUserActivityReports);
router.get('/admin/reports/system-performance', adminOnly, ReportController.getSystemPerformanceReports);
router.post('/admin/reports/custom/generate', adminOnly, ReportController.generateCustomReport);
router.get('/admin/reports/:reportId/export', adminOnly, ReportController.exportReport);

export default router;