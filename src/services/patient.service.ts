import { eq, and, desc, asc, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users } from '../db/schemas/users';
import { userProfiles } from '../db/schemas/user-profiles';
import {
  patients,
  patientMedicalHistory,
  patientAllergies,
  patientMedications,
  patientPreferences,
  patientFamilyLinks,
} from '../db/schemas/patients';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Validation schemas
const createPatientProfileSchema = z.object({
  emergencyContactName: z.string().min(1, 'Emergency contact name is required').max(255).optional(),
  emergencyContactPhone: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  emergencyContactRelationship: z.string().max(100).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  height: z.number().min(50).max(300).optional(), // cm
  weight: z.number().min(1).max(500).optional(), // kg
  insuranceProvider: z.string().max(255).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
  insuranceGroupNumber: z.string().max(100).optional(),
  preferredPharmacy: z.string().max(255).optional(),
});

const addMedicalHistorySchema = z.object({
  conditionType: z.enum(['allergy', 'chronic_condition', 'past_surgery', 'family_history', 'medication']),
  conditionName: z.string().min(1, 'Condition name is required').max(255),
  conditionCode: z.string().max(50).optional(),
  severity: z.enum(['mild', 'moderate', 'severe', 'critical']).optional(),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  resolvedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  notes: z.string().optional(),
});

const addAllergySchema = z.object({
  allergenType: z.enum(['drug', 'food', 'environmental', 'other']),
  allergenName: z.string().min(1, 'Allergen name is required').max(255),
  reactionSeverity: z.enum(['mild', 'moderate', 'severe', 'critical']).optional(),
  symptoms: z.string().optional(), // Will be stored as JSON
  firstOccurrence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  lastOccurrence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  treatmentNotes: z.string().optional(),
});

const addMedicationSchema = z.object({
  medicationName: z.string().min(1, 'Medication name is required').max(255),
  genericName: z.string().max(255).optional(),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  route: z.enum(['oral', 'injection', 'topical', 'inhalation', 'other']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  pharmacyFilled: z.string().max(255).optional(),
  sideEffects: z.string().optional(), // Will be stored as JSON
  isActive: z.boolean().default(true),
});

const updatePreferencesSchema = z.object({
  preferredCommunicationMethod: z.enum(['email', 'sms', 'phone', 'app_notification']).optional(),
  appointmentReminderTiming: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  dataSharingConsent: z.object({
    allowDataSharing: z.boolean(),
    consentDate: z.date(),
    consentVersion: z.string(),
  }).optional(),
  marketingConsent: z.boolean().optional(),
  researchParticipationConsent: z.boolean().optional(),
  familyAccessPermissions: z.array(z.object({
    relationship: z.string(),
    accessLevel: z.enum(['full', 'emergency_only', 'limited']),
  })).optional(),
  privacySettings: z.object({
    shareWithFamilyMembers: z.boolean(),
    shareWithPrimaryCare: z.boolean(),
    shareForResearch: z.boolean(),
  }).optional(),
});

const addFamilyMemberSchema = z.object({
  familyMemberName: z.string().min(1, 'Family member name is required').max(255),
  familyMemberPhone: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  familyMemberRelationship: z.string().max(100).optional(),
});



export class PatientService {
  // Check if user is a patient
  private async validatePatientUser(userId: string): Promise<void> {
    const user = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    if (user[0].userType !== 'patient') {
      throw new AuthorizationError('Only patients can access this resource');
    }
  }

  // Generate unique medical record number
  private async generateMedicalRecordNumber(): Promise<string> {
    const prefix = 'MRN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  // Create or update patient profile
  async createOrUpdatePatientProfile(userId: string, data: z.infer<typeof createPatientProfileSchema>) {
    await this.validatePatientUser(userId);

    const validatedData = createPatientProfileSchema.parse(data);
    const normalizedData: any = {
      ...validatedData,
    };
    if (validatedData.height !== undefined) {
      normalizedData.height = validatedData.height.toString();
    }
    if (validatedData.weight !== undefined) {
      normalizedData.weight = validatedData.weight.toString();
    }

    // Check if patient profile exists
    const existingPatient = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (existingPatient[0]) {
      // Update existing profile
      await db
        .update(patients)
        .set({
          ...normalizedData,
          updatedAt: new Date(),
        })
        .where(eq(patients.userId, userId));

      return this.getPatientProfile(userId);
    } else {
      // Create new patient profile
      const medicalRecordNumber = await this.generateMedicalRecordNumber();
      
      const patientId = uuidv4();
      await db.insert(patients).values({
        patientId,
        userId,
        medicalRecordNumber,
        ...normalizedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create default preferences
      await db.insert(patientPreferences).values({
        preferenceId: uuidv4(),
        patientId,
        preferredCommunicationMethod: 'email',
        appointmentReminderTiming: '24',
        marketingConsent: false,
        researchParticipationConsent: false,
        updatedAt: new Date(),
      });

      return this.getPatientProfile(userId);
    }
  }

  // Get patient profile with all related data
  async getPatientProfile(userId: string) {
    await this.validatePatientUser(userId);

    const patientData = await db
      .select({
        // Patient info
        patientId: patients.patientId,
        medicalRecordNumber: patients.medicalRecordNumber,
        emergencyContactName: patients.emergencyContactName,
        emergencyContactPhone: patients.emergencyContactPhone,
        emergencyContactRelationship: patients.emergencyContactRelationship,
        bloodType: patients.bloodType,
        height: patients.height,
        weight: patients.weight,
        insuranceProvider: patients.insuranceProvider,
        insurancePolicyNumber: patients.insurancePolicyNumber,
        insuranceGroupNumber: patients.insuranceGroupNumber,
        preferredPharmacy: patients.preferredPharmacy,
        createdAt: patients.createdAt,
        updatedAt: patients.updatedAt,
        // User info
        email: users.email,
        phoneNumber: users.phoneNumber,
        userType: users.userType,
        accountStatus: users.accountStatus,
        // Profile info
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patientData[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    return patientData[0];
  }

  // Add medical history entry
  async addMedicalHistory(userId: string, data: z.infer<typeof addMedicalHistorySchema>) {
    await this.validatePatientUser(userId);

    const validatedData = addMedicalHistorySchema.parse(data);
    
    // Get patient ID
    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found. Please create your profile first.');
    }

    await db.insert(patientMedicalHistory).values({
      historyId: uuidv4(),
      patientId: patient[0].patientId,
      conditionType: validatedData.conditionType,
      conditionName: validatedData.conditionName,
      conditionCode: validatedData.conditionCode,
      severity: validatedData.severity,
      onsetDate: validatedData.onsetDate ? new Date(validatedData.onsetDate) : undefined,
      resolvedDate: validatedData.resolvedDate ? new Date(validatedData.resolvedDate) : undefined,
      notes: validatedData.notes,
      documentedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, message: 'Medical history added successfully' };
  }

  // Get medical history
  async getMedicalHistory(userId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      return [];
    }

    return await db
      .select({
        historyId: patientMedicalHistory.historyId,
        conditionType: patientMedicalHistory.conditionType,
        conditionName: patientMedicalHistory.conditionName,
        conditionCode: patientMedicalHistory.conditionCode,
        severity: patientMedicalHistory.severity,
        onsetDate: patientMedicalHistory.onsetDate,
        resolvedDate: patientMedicalHistory.resolvedDate,
        notes: patientMedicalHistory.notes,
        createdAt: patientMedicalHistory.createdAt,
        updatedAt: patientMedicalHistory.updatedAt,
      })
      .from(patientMedicalHistory)
      .where(eq(patientMedicalHistory.patientId, patient[0].patientId))
      .orderBy(desc(patientMedicalHistory.createdAt));
  }

  // Add allergy
  async addAllergy(userId: string, data: z.infer<typeof addAllergySchema>) {
    await this.validatePatientUser(userId);

    const validatedData = addAllergySchema.parse(data);
    
    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found. Please create your profile first.');
    }

    await db.insert(patientAllergies).values({
      allergyId: uuidv4(),
      patientId: patient[0].patientId,
      allergenType: validatedData.allergenType,
      allergenName: validatedData.allergenName,
      reactionSeverity: validatedData.reactionSeverity,
      symptoms: validatedData.symptoms,
      firstOccurrence: validatedData.firstOccurrence ? new Date(validatedData.firstOccurrence) : undefined,
      lastOccurrence: validatedData.lastOccurrence ? new Date(validatedData.lastOccurrence) : undefined,
      treatmentNotes: validatedData.treatmentNotes,
      verifiedByDoctor: false,
      createdAt: new Date(),
    });

    return { success: true, message: 'Allergy added successfully' };
  }

  // Get allergies
  async getAllergies(userId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      return [];
    }

    return await db
      .select()
      .from(patientAllergies)
      .where(eq(patientAllergies.patientId, patient[0].patientId))
      .orderBy(desc(patientAllergies.createdAt));
  }

  // Add medication
  async addMedication(userId: string, data: z.infer<typeof addMedicationSchema>) {
    await this.validatePatientUser(userId);

    const validatedData = addMedicationSchema.parse(data);
    
    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found. Please create your profile first.');
    }

    await db.insert(patientMedications).values({
      medicationId: uuidv4(),
      patientId: patient[0].patientId,
      medicationName: validatedData.medicationName,
      genericName: validatedData.genericName,
      dosage: validatedData.dosage,
      frequency: validatedData.frequency,
      route: validatedData.route,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      pharmacyFilled: validatedData.pharmacyFilled,
      sideEffects: validatedData.sideEffects,
      isActive: validatedData.isActive,
      createdAt: new Date(),
    });

    return { success: true, message: 'Medication added successfully' };
  }

  // Get medications
  async getMedications(userId: string, activeOnly: boolean = false) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      return [];
    }

    const conditions = [eq(patientMedications.patientId, patient[0].patientId)];
    if (activeOnly) {
      conditions.push(eq(patientMedications.isActive, true));
    }

    return await db
      .select()
      .from(patientMedications)
      .where(and(...conditions))
      .orderBy(desc(patientMedications.createdAt));
  }

  // Update medication status (active/inactive)
  async updateMedicationStatus(userId: string, medicationId: string, isActive: boolean) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    // Verify the medication belongs to this patient
    const medication = await db
      .select()
      .from(patientMedications)
      .where(and(
        eq(patientMedications.medicationId, medicationId),
        eq(patientMedications.patientId, patient[0].patientId)
      ))
      .limit(1);

    if (!medication[0]) {
      throw new NotFoundError('Medication not found');
    }

    await db
      .update(patientMedications)
      .set({ isActive })
      .where(eq(patientMedications.medicationId, medicationId));

    return { success: true, message: `Medication ${isActive ? 'activated' : 'deactivated'} successfully` };
  }

  // Update patient preferences
  async updatePreferences(userId: string, data: z.infer<typeof updatePreferencesSchema>) {
    await this.validatePatientUser(userId);

    const validatedData = updatePreferencesSchema.parse(data);
    
    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found. Please create your profile first.');
    }

    // Convert objects to JSON strings for storage
    const updateData: any = { ...validatedData };
    if (typeof updateData.appointmentReminderTiming === 'number') {
      updateData.appointmentReminderTiming = updateData.appointmentReminderTiming.toString();
    }
    if (updateData.dataSharingConsent) {
      updateData.dataSharingConsent = JSON.stringify(updateData.dataSharingConsent);
    }
    if (updateData.familyAccessPermissions) {
      updateData.familyAccessPermissions = JSON.stringify(updateData.familyAccessPermissions);
    }
    if (updateData.privacySettings) {
      updateData.privacySettings = JSON.stringify(updateData.privacySettings);
    }

    await db
      .update(patientPreferences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(patientPreferences.patientId, patient[0].patientId));

    return { success: true, message: 'Preferences updated successfully' };
  }

  // Get patient preferences
  async getPreferences(userId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    const preferences = await db
      .select()
      .from(patientPreferences)
      .where(eq(patientPreferences.patientId, patient[0].patientId))
      .limit(1);

    if (!preferences[0]) {
      return null;
    }

    // Parse JSON fields
    const result = { ...preferences[0] };
    try {
      if (result.dataSharingConsent) {
        result.dataSharingConsent = JSON.parse(result.dataSharingConsent as string);
      }
      if (result.familyAccessPermissions) {
        result.familyAccessPermissions = JSON.parse(result.familyAccessPermissions as string);
      }
      if (result.privacySettings) {
        result.privacySettings = JSON.parse(result.privacySettings as string);
      }
    } catch (error) {
      // Handle JSON parsing errors gracefully
      console.error('Error parsing JSON fields in preferences:', error);
    }

    return result;
  }

  // Get complete patient medical summary
  async getMedicalSummary(userId: string) {
    await this.validatePatientUser(userId);

    const [profile, medicalHistory, allergies, medications, preferences] = await Promise.all([
      this.getPatientProfile(userId).catch(() => null),
      this.getMedicalHistory(userId),
      this.getAllergies(userId),
      this.getMedications(userId, true), // Only active medications
      this.getPreferences(userId),
    ]);

    return {
      profile,
      medicalHistory,
      allergies,
      activeMedications: medications,
      preferences,
      summary: {
        hasProfile: !!profile,
        medicalHistoryCount: medicalHistory.length,
        allergiesCount: allergies.length,
        activeMedicationsCount: medications.length,
        lastUpdated: profile?.updatedAt || null,
      },
    };
  }

  // Delete medical history entry
  async deleteMedicalHistory(userId: string, historyId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    const deleted = await db
      .delete(patientMedicalHistory)
      .where(and(
        eq(patientMedicalHistory.historyId, historyId),
        eq(patientMedicalHistory.patientId, patient[0].patientId)
      ));

    return { success: true, message: 'Medical history entry deleted successfully' };
  }

  // Delete allergy
  async deleteAllergy(userId: string, allergyId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    await db
      .delete(patientAllergies)
      .where(and(
        eq(patientAllergies.allergyId, allergyId),
        eq(patientAllergies.patientId, patient[0].patientId)
      ));

    return { success: true, message: 'Allergy deleted successfully' };
  }

  // Delete medication
  async deleteMedication(userId: string, medicationId: string) {
    await this.validatePatientUser(userId);

    const patient = await db
      .select({ patientId: patients.patientId })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient[0]) {
      throw new NotFoundError('Patient profile not found');
    }

    await db
      .delete(patientMedications)
      .where(and(
        eq(patientMedications.medicationId, medicationId),
        eq(patientMedications.patientId, patient[0].patientId)
      ));

    return { success: true, message: 'Medication deleted successfully' };
  }
}

// Export validation schemas for use in controllers
export {
  createPatientProfileSchema,
  addMedicalHistorySchema,
  addAllergySchema,
  addMedicationSchema,
  updatePreferencesSchema,
};