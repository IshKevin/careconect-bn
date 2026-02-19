import { Router } from 'express';
import * as ConsultationController from '../controllers/consultation.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/consultations', requireAuth, ConsultationController.createConsultation);
router.get('/consultations', requireAuth, ConsultationController.listConsultations);
router.get('/consultations/:consultation_id', requireAuth, ConsultationController.getConsultation);
router.patch('/consultations/:consultation_id', requireAuth, ConsultationController.updateConsultation);

// router.post('/consultations/:consultationId/complete', requireAuth, ConsultationController.completeConsultation);
router.get('/consultations/patient/:patientId', requireAuth, ConsultationController.getPatientConsultationHistory);
router.get('/consultations/doctor/:doctorId', requireAuth, ConsultationController.getDoctorConsultations);
router.get('/consultations/:consultation_id/summary', requireAuth, ConsultationController.getConsultationSummary);

export default router;