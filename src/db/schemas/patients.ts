import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Enums
export const bloodTypeEnum = pgEnum('blood_type', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export const conditionTypeEnum = pgEnum('condition_type', ['allergy', 'chronic_condition', 'past_surgery', 'family_history', 'medication']);
export const severityEnum = pgEnum('severity', ['mild', 'moderate', 'severe', 'critical']);
export const allergenTypeEnum = pgEnum('allergen_type', ['drug', 'food', 'environmental', 'other']);
export const medicationRouteEnum = pgEnum('medication_route', ['oral', 'injection', 'topical', 'inhalation', 'other']);
export const communicationMethodEnum = pgEnum('communication_method', ['email', 'sms', 'phone', 'app_notification']);
export const relationshipEnum = pgEnum('relationship', ['parent', 'child', 'spouse', 'sibling', 'guardian', 'other']);
export const accessLevelEnum = pgEnum('access_level', ['full', 'emergency_only', 'limited']);

// Patients table
export const patients = pgTable('patients', {
  patientId: uuid('patient_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }).unique(),
  medicalRecordNumber: varchar('medical_record_number', { length: 50 }).notNull().unique(),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
  emergencyContactRelationship: varchar('emergency_contact_relationship', { length: 100 }),
  bloodType: bloodTypeEnum('blood_type'),
  height: decimal('height', { precision: 5, scale: 2 }), // in cm
  weight: decimal('weight', { precision: 5, scale: 2 }), // in kg
  insuranceProvider: varchar('insurance_provider', { length: 255 }),
  insurancePolicyNumber: varchar('insurance_policy_number', { length: 100 }),
  insuranceGroupNumber: varchar('insurance_group_number', { length: 100 }),
  primaryPhysicianId: uuid('primary_physician_id'), // Will reference doctors table
  preferredPharmacy: varchar('preferred_pharmacy', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Patient medical history table
export const patientMedicalHistory = pgTable('patient_medical_history', {
  historyId: uuid('history_id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }),
  conditionType: conditionTypeEnum('condition_type').notNull(),
  conditionName: varchar('condition_name', { length: 255 }).notNull(),
  conditionCode: varchar('condition_code', { length: 50 }), // ICD-11 codes
  severity: severityEnum('severity'),
  onsetDate: timestamp('onset_date', { mode: 'date' }),
  resolvedDate: timestamp('resolved_date', { mode: 'date' }),
  notes: text('notes'),
  documentedBy: uuid('documented_by').references(() => users.userId),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Patient allergies table
export const patientAllergies = pgTable('patient_allergies', {
  allergyId: uuid('allergy_id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }),
  allergenType: allergenTypeEnum('allergen_type').notNull(),
  allergenName: varchar('allergen_name', { length: 255 }).notNull(),
  reactionSeverity: severityEnum('reaction_severity'),
  symptoms: text('symptoms'), // JSON array
  firstOccurrence: timestamp('first_occurrence', { mode: 'date' }),
  lastOccurrence: timestamp('last_occurrence', { mode: 'date' }),
  treatmentNotes: text('treatment_notes'),
  verifiedByDoctor: boolean('verified_by_doctor').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Patient medications table
export const patientMedications = pgTable('patient_medications', {
  medicationId: uuid('medication_id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }),
  medicationName: varchar('medication_name', { length: 255 }).notNull(),
  genericName: varchar('generic_name', { length: 255 }),
  dosage: varchar('dosage', { length: 100 }),
  frequency: varchar('frequency', { length: 100 }),
  route: medicationRouteEnum('route'),
  startDate: timestamp('start_date', { mode: 'date' }),
  endDate: timestamp('end_date', { mode: 'date' }),
  prescribedBy: uuid('prescribed_by'), // Will reference doctors table
  pharmacyFilled: varchar('pharmacy_filled', { length: 255 }),
  adherenceScore: decimal('adherence_score', { precision: 5, scale: 2 }),
  sideEffects: text('side_effects'), // JSON array
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Patient preferences table
export const patientPreferences = pgTable('patient_preferences', {
  preferenceId: uuid('preference_id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }).unique(),
  preferredCommunicationMethod: communicationMethodEnum('preferred_communication_method').default('email'),
  appointmentReminderTiming: decimal('appointment_reminder_timing', { precision: 3, scale: 0 }).default('24'), // hours before
  dataSharingConsent: text('data_sharing_consent'), // JSON
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  researchParticipationConsent: boolean('research_participation_consent').notNull().default(false),
  familyAccessPermissions: text('family_access_permissions'), // JSON
  privacySettings: text('privacy_settings'), // JSON
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Patient family links table
export const patientFamilyLinks = pgTable('patient_family_links', {
  linkId: uuid('link_id').primaryKey().defaultRandom(),
  primaryPatientId: uuid('primary_patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }),
  linkedPatientId: uuid('linked_patient_id').notNull().references(() => patients.patientId, { onDelete: 'cascade' }),
  relationship: relationshipEnum('relationship').notNull(),
  accessLevel: accessLevelEnum('access_level').notNull().default('limited'),
  approvedByPatient: boolean('approved_by_patient').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.userId],
  }),
  medicalHistory: many(patientMedicalHistory),
  allergies: many(patientAllergies),
  medications: many(patientMedications),
  preferences: one(patientPreferences, {
    fields: [patients.patientId],
    references: [patientPreferences.patientId],
  }),
  primaryFamilyLinks: many(patientFamilyLinks, {
    relationName: 'primaryPatient',
  }),
  linkedFamilyLinks: many(patientFamilyLinks, {
    relationName: 'linkedPatient',
  }),
}));

export const patientMedicalHistoryRelations = relations(patientMedicalHistory, ({ one }) => ({
  patient: one(patients, {
    fields: [patientMedicalHistory.patientId],
    references: [patients.patientId],
  }),
  documentedByUser: one(users, {
    fields: [patientMedicalHistory.documentedBy],
    references: [users.userId],
  }),
}));

export const patientAllergiesRelations = relations(patientAllergies, ({ one }) => ({
  patient: one(patients, {
    fields: [patientAllergies.patientId],
    references: [patients.patientId],
  }),
}));

export const patientMedicationsRelations = relations(patientMedications, ({ one }) => ({
  patient: one(patients, {
    fields: [patientMedications.patientId],
    references: [patients.patientId],
  }),
}));

export const patientPreferencesRelations = relations(patientPreferences, ({ one }) => ({
  patient: one(patients, {
    fields: [patientPreferences.patientId],
    references: [patients.patientId],
  }),
}));

export const patientFamilyLinksRelations = relations(patientFamilyLinks, ({ one }) => ({
  primaryPatient: one(patients, {
    fields: [patientFamilyLinks.primaryPatientId],
    references: [patients.patientId],
    relationName: 'primaryPatient',
  }),
  linkedPatient: one(patients, {
    fields: [patientFamilyLinks.linkedPatientId],
    references: [patients.patientId],
    relationName: 'linkedPatient',
  }),
}));
