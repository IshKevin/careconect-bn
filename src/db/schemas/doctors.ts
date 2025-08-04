import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z, ZodObject, ZodRawShape } from 'zod';
import { users } from './users';


// Doctors table
export const doctors = pgTable('doctors', {
  doctorId: uuid('doctor_id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).unique().notNull(),
  medicalLicenseNumber: varchar('medical_license_number', { length: 50 }).unique().notNull(),
  specialty: varchar('specialty', { length: 100 }).notNull(),
  consultationFee: decimal('consultation_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
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

// Zod schemas for validation
export const insertDoctorSchema = createInsertSchema(doctors).extend({
  userId: z.string().uuid('Invalid user ID format'),
  medicalLicenseNumber: z.string().min(1, 'Medical license number is required').max(50),
  specialty: z.enum(specialties),
  consultationFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format').transform(Number),
  isActive: z.boolean().optional(),
});

export const selectDoctorSchema = createSelectSchema(doctors);

export const updateDoctorSchema = insertDoctorSchema.partial() as unknown as ZodObject<ZodRawShape>;

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
    phoneNumber: z.string(),
    userType: z.enum(['patient', 'doctor', 'admin']),
    accountStatus: z.enum(['active', 'inactive']),
    profile: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
      })
      .optional(),
  }),
});

// Types
export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type UpdateDoctor = z.infer<typeof updateDoctorSchema>;
export type DoctorWithUser = z.infer<typeof doctorWithUserSchema>;
export type Specialty = typeof specialties[number];
