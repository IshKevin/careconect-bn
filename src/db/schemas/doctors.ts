import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { facilities } from './facilities';

// Doctors table
export const doctors = pgTable('doctors', {
  doctorId: uuid('doctor_id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).unique().notNull(),
  medicalLicenseNumber: varchar('medical_license_number', { length: 50 }).unique().notNull(),
  specialty: varchar('specialty', { length: 100 }).notNull(),
  consultationFee: decimal('consultation_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  facilityId: uuid('facility_id').references(() => facilities.facilityId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const doctorsRelations = relations(doctors, ({ one }) => ({
  user: one(users, {
    fields: [doctors.userId],
    references: [users.userId],
  }),
}));

// Common specialties for validation
export const specialties = [
  'general_medicine',
  'cardiology',
  'dermatology',
  'endocrinology',
  'gastroenterology',
  'neurology',
  'oncology',
  'orthopedics',
  'pediatrics',
  'psychiatry',
  'radiology',
  'surgery',
  'gynecology',
  'ophthalmology',
  'ent',
  'urology',
  'emergency_medicine',
  'family_medicine',
  'internal_medicine',
  'other',
] as const;

// Base select schema
export const selectDoctorSchema = createSelectSchema(doctors);

// Custom insert schema
export const insertDoctorSchema = z.object({
  doctorId: z.string().uuid().optional(),
  userId: z.string().uuid('Invalid user ID format'),
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required').max(50),
  specialty: z.enum(specialties),
  consultationFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format').default('0.00'),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Update schema
export const updateDoctorSchema = z.object({
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required').max(50).optional(),
  specialty: z.enum(specialties).optional(),
  consultationFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format').optional(),
  isActive: z.boolean().optional(),
});

// Doctor with user profile for common queries
export const doctorWithUserSchema = z.object({
  doctorId: z.string().uuid(),
  userId: z.string().uuid(),
  medicalLicenseNumber: z.string(),
  specialty: z.enum(specialties),
  consultationFee: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.object({
    email: z.string().email(),
    phoneNumber: z.string().nullable(),
    userType: z.enum(['patient', 'doctor', 'admin', 'super_admin']),
    accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
    profile: z.object({
      firstName: z.string(),
      lastName: z.string(),
    }).optional(),
  }),
});

// Additional schemas for doctor management
export const createDoctorByAdminSchema = z.object({
  // User details
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  // Doctor-specific details
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required').max(50),
  specialty: z.enum(specialties),
  consultationFee: z.number().min(0, 'Consultation fee must be non-negative'),
  isActive: z.boolean().default(true),
});

export const doctorFiltersSchema = z.object({
  specialty: z.enum(specialties).optional(),
  isActive: z.boolean().optional(),
  minFee: z.coerce.number().min(0).optional(),
  maxFee: z.coerce.number().min(0).optional(),
  search: z.string().optional(), // Search by name or license number
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const doctorAvailabilityStatusSchema = z.object({
  doctorId: z.string().uuid(),
  isAvailable: z.boolean(),
  availableFrom: z.date().optional(),
  availableUntil: z.date().optional(),
  reason: z.string().optional(),
});

export const doctorStatsSchema = z.object({
  doctorId: z.string().uuid(),
  totalAppointments: z.number().int().min(0),
  completedConsultations: z.number().int().min(0),
  totalRevenue: z.number().min(0),
  averageRating: z.number().min(0).max(5).optional(),
  patientCount: z.number().int().min(0),
  upcomingAppointments: z.number().int().min(0),
});

export const updateDoctorStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const doctorProfileSchema = z.object({
  doctorId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  specialty: z.enum(specialties),
  consultationFee: z.string(),
  medicalLicenseNumber: z.string(),
  isActive: z.boolean(),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
  totalExperience: z.number().optional(),
  education: z.string().optional(),
  certifications: z.array(z.string()).optional(),
});

// Types
export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type UpdateDoctor = z.infer<typeof updateDoctorSchema>;
export type DoctorWithUser = z.infer<typeof doctorWithUserSchema>;
export type CreateDoctorByAdmin = z.infer<typeof createDoctorByAdminSchema>;
export type DoctorFilters = z.infer<typeof doctorFiltersSchema>;
export type DoctorAvailabilityStatus = z.infer<typeof doctorAvailabilityStatusSchema>;
export type DoctorStats = z.infer<typeof doctorStatsSchema>;
export type UpdateDoctorStatus = z.infer<typeof updateDoctorStatusSchema>;
export type DoctorProfile = z.infer<typeof doctorProfileSchema>;

// Enum types
export type Specialty = typeof specialties[number];