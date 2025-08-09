import { Request, Response, NextFunction } from 'express';
import { 
  PatientService,
  createPatientProfileSchema,
  addMedicalHistorySchema,
  addAllergySchema,
  addMedicationSchema,
  updatePreferencesSchema,
} from '../services/patient.service';
import { ValidationError } from '../utils/errors';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    userType: string;
    email: string;
  };
}

export class PatientController {
  private patientService: PatientService;

  constructor() {
    this.patientService = new PatientService();
  }

  // Helper: validate UUID param
  private static isUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
  }

  // ---------- Public (no-auth) onboarding endpoints ----------
  // Create or update patient profile by userId (no auth)
  createOrUpdateProfilePublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.createOrUpdatePatientProfile(userId, req.body);
      res.status(200).json({ success: true, data: result, message: 'Patient profile updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Add medical history by userId (no auth)
  addMedicalHistoryPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const validatedData = addMedicalHistorySchema.parse(req.body);
      const result = await this.patientService.addMedicalHistory(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Add allergy by userId (no auth)
  addAllergyPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const validatedData = addAllergySchema.parse(req.body);
      const result = await this.patientService.addAllergy(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Add medication by userId (no auth)
  addMedicationPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const validatedData = addMedicationSchema.parse(req.body);
      const result = await this.patientService.addMedication(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Update preferences by userId (no auth)
  updatePreferencesPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const validatedData = updatePreferencesSchema.parse(req.body);
      const result = await this.patientService.updatePreferences(userId, validatedData);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ---------- Doctor/Admin endpoints (by userId) ----------
  getProfileByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getPatientProfile(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMedicalSummaryByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getMedicalSummary(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMedicalHistoryByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getMedicalHistory(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAllergiesByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getAllergies(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMedicationsByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      const activeOnly = req.query.activeOnly === 'true';
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getMedications(userId, activeOnly);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getPreferencesByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId || !PatientController.isUuid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid userId (UUID) is required' });
      }
      const result = await this.patientService.getPreferences(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Create or update patient profile
  createOrUpdateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.createOrUpdatePatientProfile(userId, req.body);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Patient profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get patient profile
  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.getPatientProfile(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get complete medical summary
  getMedicalSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.getMedicalSummary(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Add medical history
  addMedicalHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validatedData = addMedicalHistorySchema.parse(req.body);
      
      const result = await this.patientService.addMedicalHistory(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new ValidationError('Invalid medical history data', error));
      } else {
        next(error);
      }
    }
  };

  // Get medical history
  getMedicalHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.getMedicalHistory(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete medical history entry
  deleteMedicalHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const { historyId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!historyId) {
        return res.status(400).json({ error: 'History ID is required' });
      }

      const result = await this.patientService.deleteMedicalHistory(userId, historyId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Add allergy
  addAllergy = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validatedData = addAllergySchema.parse(req.body);
      
      const result = await this.patientService.addAllergy(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new ValidationError('Invalid allergy data', error));
      } else {
        next(error);
      }
    }
  };

  // Get allergies
  getAllergies = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.getAllergies(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete allergy
  deleteAllergy = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const { allergyId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!allergyId) {
        return res.status(400).json({ error: 'Allergy ID is required' });
      }

      const result = await this.patientService.deleteAllergy(userId, allergyId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Add medication
  addMedication = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validatedData = addMedicationSchema.parse(req.body);
      
      const result = await this.patientService.addMedication(userId, validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new ValidationError('Invalid medication data', error));
      } else {
        next(error);
      }
    }
  };

  // Get medications
  getMedications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const activeOnly = req.query.activeOnly === 'true';
      const result = await this.patientService.getMedications(userId, activeOnly);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Update medication status
  updateMedicationStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const { medicationId } = req.params;
      const { isActive } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!medicationId) {
        return res.status(400).json({ error: 'Medication ID is required' });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      const result = await this.patientService.updateMedicationStatus(userId, medicationId, isActive);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Delete medication
  deleteMedication = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const { medicationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!medicationId) {
        return res.status(400).json({ error: 'Medication ID is required' });
      }

      const result = await this.patientService.deleteMedication(userId, medicationId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Update preferences
  updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validatedData = updatePreferencesSchema.parse(req.body);
      
      const result = await this.patientService.updatePreferences(userId, validatedData);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new ValidationError('Invalid preferences data', error));
      } else {
        next(error);
      }
    }
  };

  // Get preferences
  getPreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await this.patientService.getPreferences(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}