import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();
const appointmentController = new AppointmentController();

// Patient endpoints
router.post('/book', requireAuth, requireRole(['patient']), appointmentController.bookAppointment.bind(appointmentController));
router.get('/my-appointments', requireAuth, requireRole(['patient']), appointmentController.getMyAppointments.bind(appointmentController));
router.put('/:appointmentId/reschedule', requireAuth, requireRole(['patient']), appointmentController.rescheduleAppointment.bind(appointmentController));
router.put('/:appointmentId/cancel', requireAuth, requireRole(['patient']), appointmentController.cancelAppointment.bind(appointmentController));

// Doctor endpoints  
router.get('/doctor-appointments', requireAuth, requireRole(['doctor']), appointmentController.getMyAppointments.bind(appointmentController));
router.put('/:appointmentId/status', requireAuth, requireRole(['doctor']), appointmentController.updateAppointmentStatus.bind(appointmentController));

// Public endpoints
router.get('/availability/:doctorId/:date', appointmentController.getAvailableTimeSlots.bind(appointmentController));

// Admin endpoints
router.get('/', requireAdmin, appointmentController.listAppointments.bind(appointmentController));
router.get('/:appointmentId', requireAdmin, appointmentController.getAppointment.bind(appointmentController));
router.put('/:appointmentId', requireAdmin, appointmentController.updateAppointment.bind(appointmentController));
router.delete('/:appointmentId', requireAdmin, appointmentController.deleteAppointment.bind(appointmentController));

export default router;
