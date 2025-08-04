import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Enums
export const verificationStatusEnum = pgEnum('verification_status', ['pending', 'verified', 'rejected', 'suspended']);
export const consultationFeeTierEnum = pgEnum('consultation_fee_tier', ['tier_1', 'tier_2', 'tier_3', 'tier_4']);
export const facilityTypeEnum = pgEnum('facility_type', ['hospital', 'clinic', 'private_practice', 'health_center']);
export const credentialTypeEnum = pgEnum('credential_type', ['medical_degree', 'residency', 'fellowship', 'board_certification', 'continuing_education']);

// Doctors table
export const doctors = pgTable('doctors', {
  doctorId: uuid('doctor_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }).unique(),
  medicalLicenseNumber: varchar('medical_license_number', { length: 100 }).notNull().unique(),
  licenseIssuingAuthority: varchar('license_issuing_authority', { length: 255 }),
  licenseExpiryDate: timestamp('license_expiry_date', { mode: 'date' }),
  nidNumber: varchar('nid_number', { length: 50 }).unique(),
  taxIdentificationNumber: varchar('tax_identification_number', { length: 50 }),
  yearsOfExperience: integer('years_of_experience'),
  consultationFeeTier: consultationFeeTierEnum('consultation_fee_tier').default('tier_2'),
  baseConsultationFee: decimal('base_consultation_fee', { precision: 10, scale: 2 }),
  emergencyConsultationFee: decimal('emergency_consultation_fee', { precision: 10, scale: 2 }),
  followUpConsultationFee: decimal('follow_up_consultation_fee', { precision: 10, scale: 2 }),
  averageConsultationDuration: integer('average_consultation_duration').default(30), // minutes
  maxDailyAppointments: integer('max_daily_appointments').default(20),
  isAcceptingNewPatients: boolean('is_accepting_new_patients').notNull().default(true),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
  verificationDate: timestamp('verification_date'),
  verifiedBy: uuid('verified_by').references(() => users.userId),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Doctor specializations table
export const doctorSpecializations = pgTable('doctor_specializations', {
  specializationId: uuid('specialization_id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.doctorId, { onDelete: 'cascade' }),
  specialtyName: varchar('specialty_name', { length: 255 }).notNull(),
  subspecialtyName: varchar('subspecialty_name', { length: 255 }),
  boardCertification: varchar('board_certification', { length: 255 }),
  certificationDate: timestamp('certification_date', { mode: 'date' }),
  certificationExpiry: timestamp('certification_expiry', { mode: 'date' }),
  certifyingBody: varchar('certifying_body', { length: 255 }),
  isPrimarySpecialty: boolean('is_primary_specialty').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Doctor credentials table
export const doctorCredentials = pgTable('doctor_credentials', {
  credentialId: uuid('credential_id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.doctorId, { onDelete: 'cascade' }),
  credentialType: credentialTypeEnum('credential_type').notNull(),
  institutionName: varchar('institution_name', { length: 255 }),
  degreeTitle: varchar('degree_title', { length: 255 }),
  completionDate: timestamp('completion_date', { mode: 'date' }),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
  documentUrl: varchar('document_url', { length: 500 }),
  expiryDate: timestamp('expiry_date', { mode: 'date' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Doctor practice locations table
export const doctorPracticeLocations = pgTable('doctor_practice_locations', {
  locationId: uuid('location_id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.doctorId, { onDelete: 'cascade' }),
  clinicHospitalName: varchar('clinic_hospital_name', { length: 255 }),
  addressLine1: varchar('address_line_1', { length: 255 }),
  addressLine2: varchar('address_line_2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  district: varchar('district', { length: 100 }),
  province: varchar('province', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  facilityType: facilityTypeEnum('facility_type'),
  isPrimaryLocation: boolean('is_primary_location').notNull().default(false),
  acceptsTelemedicine: boolean('accepts_telemedicine').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Doctor reviews table
export const doctorReviews = pgTable('doctor_reviews', {
  reviewId: uuid('review_id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.doctorId, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull(), // Will reference patients table
  appointmentId: uuid('appointment_id'), // Will reference appointments table
  overallRating: integer('overall_rating').notNull(), // 1-5 scale
  communicationRating: integer('communication_rating'),
  punctualityRating: integer('punctuality_rating'),
  expertiseRating: integer('expertise_rating'),
  facilityRating: integer('facility_rating'),
  writtenReview: text('written_review'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Doctor statistics table
export const doctorStatistics = pgTable('doctor_statistics', {
  statId: uuid('stat_id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.doctorId, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start', { mode: 'date' }).notNull(),
  periodEnd: timestamp('period_end', { mode: 'date' }).notNull(),
  totalConsultations: integer('total_consultations').notNull().default(0),
  totalPatientsTreated: integer('total_patients_treated').notNull().default(0),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }),
  noShowRate: decimal('no_show_rate', { precision: 5, scale: 2 }),
  patientSatisfactionScore: decimal('patient_satisfaction_score', { precision: 5, scale: 2 }),
  averageConsultationTime: integer('average_consultation_time'), // minutes
  followUpComplianceRate: decimal('follow_up_compliance_rate', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  user: one(users, {
    fields: [doctors.userId],
    references: [users.userId],
  }),
  verifiedByUser: one(users, {
    fields: [doctors.verifiedBy],
    references: [users.userId],
  }),
  specializations: many(doctorSpecializations),
  credentials: many(doctorCredentials),
  practiceLocations: many(doctorPracticeLocations),
  reviews: many(doctorReviews),
  statistics: many(doctorStatistics),
}));

export const doctorSpecializationsRelations = relations(doctorSpecializations, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorSpecializations.doctorId],
    references: [doctors.doctorId],
  }),
}));

export const doctorCredentialsRelations = relations(doctorCredentials, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorCredentials.doctorId],
    references: [doctors.doctorId],
  }),
}));

export const doctorPracticeLocationsRelations = relations(doctorPracticeLocations, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorPracticeLocations.doctorId],
    references: [doctors.doctorId],
  }),
}));

export const doctorReviewsRelations = relations(doctorReviews, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorReviews.doctorId],
    references: [doctors.doctorId],
  }),
}));

export const doctorStatisticsRelations = relations(doctorStatistics, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorStatistics.doctorId],
    references: [doctors.doctorId],
  }),
}));
