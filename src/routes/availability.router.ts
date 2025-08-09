import { Router } from 'express';
import * as AvailabilityController from '../controllers/availability.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/doctors/:doctor_id/availability', AvailabilityController.getDoctorAvailability);
router.post('/doctors/:doctor_id/availability', requireAuth, AvailabilityController.addAvailability);
router.patch('/availability/:availability_id', requireAuth, AvailabilityController.updateAvailability);
router.patch('/availability/:availability_id/status', requireAuth, AvailabilityController.updateAvailabilityStatus);
router.delete('/availability/:availability_id', requireAuth, AvailabilityController.deleteAvailability);

router.get('/slots/:doctorId/:date', AvailabilityController.getAvailableSlots);
router.post('/bulk-update', requireAuth, AvailabilityController.bulkUpdateAvailability);

export default router;