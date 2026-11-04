import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { requireAuth, requireSelfParam } from '../middleware/authMiddleware';

const router = Router();
const patientController = new PatientController();

// Onboarding by userId: signed in, and only for the user's own record
router.post('/:userId/profile', requireAuth, requireSelfParam(), patientController.createOrUpdateProfilePublic.bind(patientController));
router.post('/:userId/medical-history', requireAuth, requireSelfParam(), patientController.addMedicalHistoryPublic.bind(patientController));
router.post('/:userId/allergies', requireAuth, requireSelfParam(), patientController.addAllergyPublic.bind(patientController));
router.post('/:userId/medications', requireAuth, requireSelfParam(), patientController.addMedicationPublic.bind(patientController));
router.put('/:userId/preferences', requireAuth, requireSelfParam(), patientController.updatePreferencesPublic.bind(patientController));

export default router;


