import { Router } from 'express';
import * as MiscController from '../controllers/misc.controller';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/specialties', MiscController.getSpecialties);
router.get('/timezones', MiscController.getTimezones);

router.get('/health-check', MiscController.getHealthCheck);
router.get('/configuration', MiscController.getConfiguration);
router.post('/upload-file', requireAuth, MiscController.uploadFile);
router.post('/send-notification', requireAuth, requireAdmin, MiscController.sendNotification);

export default router;