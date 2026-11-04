import { Router } from 'express';
import * as ConsultationController from '../controllers/consultation.controller';
import { requireAuth, requireDoctor } from '../middleware/authMiddleware';

const router = Router();

router.post('/consultations', requireAuth, requireDoctor, ConsultationController.createConsultation);
router.get('/consultations', requireAuth, ConsultationController.listConsultations);
router.get('/consultations/:consultation_id', requireAuth, ConsultationController.getConsultation);
router.patch('/consultations/:consultation_id', requireAuth, requireDoctor, ConsultationController.updateConsultation);

// router.post('/consultations/:consultationId/complete', requireAuth, ConsultationController.completeConsultation);
router.get('/consultations/patient/:patientId', requireAuth, ConsultationController.getPatientConsultationHistory);
router.get('/consultations/doctor/:doctorId', requireAuth, ConsultationController.getDoctorConsultations);
router.get('/consultations/:consultation_id/summary', requireAuth, ConsultationController.getConsultationSummary);

// Video: join window and tokens are checked on the server. Keyed by appointment,
// because a consultation record only exists after the appointment is completed.
router.get('/appointments/:appointmentId/join', requireAuth, ConsultationController.joinVideoCall);

export default router;