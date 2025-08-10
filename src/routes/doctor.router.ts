import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();
const doctorController = new DoctorController();

// Public endpoints (no auth)
router.get('/public/search', doctorController.searchActiveDoctors.bind(doctorController));
router.get('/public/:doctorId/profile', doctorController.getDoctorProfile.bind(doctorController));

// Admin endpoints
router.post('/', requireAuth, requireAdmin, doctorController.createDoctor.bind(doctorController));
router.get('/', requireAuth, requireAdmin, doctorController.listDoctors.bind(doctorController));
router.get('/:doctorId', requireAuth, requireAdmin, doctorController.getDoctor.bind(doctorController));
router.put('/:doctorId', requireAuth, requireAdmin, doctorController.updateDoctor.bind(doctorController));
router.put('/:doctorId/status', requireAuth, requireAdmin, doctorController.updateDoctorStatus.bind(doctorController));
router.get('/:doctorId/stats', requireAuth, requireAdmin, doctorController.getDoctorStats.bind(doctorController));
router.delete('/:doctorId', requireAuth, requireAdmin, doctorController.deleteDoctor.bind(doctorController));

export default router;


