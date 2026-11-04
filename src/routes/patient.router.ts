import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { requireAuth, requirePatient, requireDoctor, requireAdmin, requireSelfParam, requireMedicalAccess } from '../middleware/authMiddleware';

const router = Router();
const patientController = new PatientController();

// All patient routes require authentication and patient role
// Patient profile endpoints
router.get('/profile', requireAuth, requirePatient, patientController.getProfile.bind(patientController));
router.post('/profile', requireAuth, requirePatient, patientController.createOrUpdateProfile.bind(patientController));
router.put('/profile', requireAuth, requirePatient, patientController.createOrUpdateProfile.bind(patientController));

// Complete medical summary
router.get('/medical-summary', requireAuth, requirePatient, patientController.getMedicalSummary.bind(patientController));

// Medical history endpoints
router.get('/medical-history', requireAuth, requirePatient, patientController.getMedicalHistory.bind(patientController));
router.post('/medical-history', requireAuth, requirePatient, patientController.addMedicalHistory.bind(patientController));
router.delete('/medical-history/:historyId', requireAuth, requirePatient, patientController.deleteMedicalHistory.bind(patientController));

// Allergies endpoints
router.get('/allergies', requireAuth, requirePatient, patientController.getAllergies.bind(patientController));
router.post('/allergies', requireAuth, requirePatient, patientController.addAllergy.bind(patientController));
router.delete('/allergies/:allergyId', requireAuth, requirePatient, patientController.deleteAllergy.bind(patientController));

// Medications endpoints
router.get('/medications', requireAuth, requirePatient, patientController.getMedications.bind(patientController));
router.post('/medications', requireAuth, requirePatient, patientController.addMedication.bind(patientController));
router.put('/medications/:medicationId/status', requireAuth, requirePatient, patientController.updateMedicationStatus.bind(patientController));
router.delete('/medications/:medicationId', requireAuth, requirePatient, patientController.deleteMedication.bind(patientController));

// Preferences endpoints
router.get('/preferences', requireAuth, requirePatient, patientController.getPreferences.bind(patientController));
router.put('/preferences', requireAuth, requirePatient, patientController.updatePreferences.bind(patientController));

// -------- Onboarding by userId: signed in, and only for the user's own record --------
router.post('/public/:userId/profile', requireAuth, requireSelfParam(), patientController.createOrUpdateProfilePublic.bind(patientController));
router.post('/public/:userId/medical-history', requireAuth, requireSelfParam(), patientController.addMedicalHistoryPublic.bind(patientController));
router.post('/public/:userId/allergies', requireAuth, requireSelfParam(), patientController.addAllergyPublic.bind(patientController));
router.post('/public/:userId/medications', requireAuth, requireSelfParam(), patientController.addMedicationPublic.bind(patientController));
router.put('/public/:userId/preferences', requireAuth, requireSelfParam(), patientController.updatePreferencesPublic.bind(patientController));

// -------- Doctor/Admin access by userId --------
router.get('/admin/:userId/profile', requireAuth, requireAdmin, patientController.getProfileByUserId.bind(patientController));
router.get('/admin/:userId/medical-summary', requireAuth, requireAdmin, patientController.getMedicalSummaryByUserId.bind(patientController));
router.get('/admin/:userId/medical-history', requireAuth, requireAdmin, patientController.getMedicalHistoryByUserId.bind(patientController));
router.get('/admin/:userId/allergies', requireAuth, requireAdmin, patientController.getAllergiesByUserId.bind(patientController));
router.get('/admin/:userId/medications', requireAuth, requireAdmin, patientController.getMedicationsByUserId.bind(patientController));
router.get('/admin/:userId/preferences', requireAuth, requireAdmin, patientController.getPreferencesByUserId.bind(patientController));

router.get('/doctor/:userId/profile', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getProfileByUserId.bind(patientController));
router.get('/doctor/:userId/medical-summary', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getMedicalSummaryByUserId.bind(patientController));
router.get('/doctor/:userId/medical-history', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getMedicalHistoryByUserId.bind(patientController));
router.get('/doctor/:userId/allergies', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getAllergiesByUserId.bind(patientController));
router.get('/doctor/:userId/medications', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getMedicationsByUserId.bind(patientController));
router.get('/doctor/:userId/preferences', requireAuth, requireDoctor, requireMedicalAccess(), patientController.getPreferencesByUserId.bind(patientController));

export default router;