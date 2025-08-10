import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';

const router = Router();
const patientController = new PatientController();

// Public onboarding endpoints (no auth)
router.post('/:userId/profile', patientController.createOrUpdateProfilePublic.bind(patientController));
router.post('/:userId/medical-history', patientController.addMedicalHistoryPublic.bind(patientController));
router.post('/:userId/allergies', patientController.addAllergyPublic.bind(patientController));
router.post('/:userId/medications', patientController.addMedicationPublic.bind(patientController));
router.put('/:userId/preferences', patientController.updatePreferencesPublic.bind(patientController));

export default router;


