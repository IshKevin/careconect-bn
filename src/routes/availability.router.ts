import { Router } from 'express';
import * as AvailabilityController from '../controllers/availability.controller';
import { requireAuth, requireDoctor } from '../middleware/authMiddleware';

const router = Router();

router.get('/doctors/:doctor_id/availability', AvailabilityController.getDoctorAvailability);
router.post('/doctors/:doctor_id/availability', requireAuth, requireDoctor, AvailabilityController.addAvailability);
router.patch('/availability/:availability_id', requireAuth, requireDoctor, AvailabilityController.updateAvailability);
router.patch('/availability/:availability_id/status', requireAuth, requireDoctor, AvailabilityController.updateAvailabilityStatus);
router.delete('/availability/:availability_id', requireAuth, requireDoctor, AvailabilityController.deleteAvailability);

router.get('/slots/:doctorId/:date', AvailabilityController.getAvailableSlots);
router.post('/bulk-update', requireAuth, requireDoctor, AvailabilityController.bulkUpdateAvailability);

export default router;