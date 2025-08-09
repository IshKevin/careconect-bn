import { Router } from 'express';
import * as MiscController from '../controllers/misc.controller';

const router = Router();

router.get('/specialties', MiscController.getSpecialties);
router.get('/timezones', MiscController.getTimezones);

router.get('/health-check', MiscController.getHealthCheck);
router.get('/configuration', MiscController.getConfiguration);
router.post('/upload-file', MiscController.uploadFile);
router.post('/send-notification', MiscController.sendNotification);

export default router;