import { pgTable, uuid, pgEnum, date, time, decimal, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { doctors } from './doctors';

// Enums (aligned with types file)
export const appointmentTypeEnum = pgEnum('appointment_type', [
  'consultation',
  'follow_up',
  'emergency',
  'telemedicine',
  'routine_checkup',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show',
]);

// Appointments table
export const appointments = pgTable('appointments', {
  appointmentId: uuid('appointment_id').primaryKey().defaultRandom().notNull(),
  patientId: uuid('patient_id').references(() => users.userId, { onDelete: 'restrict' }).notNull(),
  doctorId: uuid('doctor_id').references(() => doctors.doctorId, { onDelete: 'restrict' }).notNull(),
  appointmentType: appointmentTypeEnum('appointment_type').default('consultation').notNull(),
  appointmentStatus: appointmentStatusEnum('appointment_status').default('scheduled').notNull(),
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: time('scheduled_time').notNull(),
  consultationFee: decimal('consultation_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(users, {
    fields: [appointments.patientId],
    references: [users.userId],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.doctorId],
  }),
}));

// Date/time validation helpers
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;

// Custom date validation function
const isValidFutureDate = (dateString: string): boolean => {
  if (!dateRegex.test(dateString)) return false;
  
  const appointmentDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return !isNaN(appointmentDate.getTime()) && appointmentDate >= today;
};

// Base schemas
export const selectAppointmentSchema = createSelectSchema(appointments);

// Create custom insert schema without using createInsertSchema with overrides
export const insertAppointmentSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid('Invalid patient ID format'),
  doctorId: z.string().uuid('Invalid doctor ID format'),
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']).default('consultation'),
  appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']).default('scheduled'),
  scheduledDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').refine(isValidFutureDate, {
    message: 'Appointment date cannot be in the past',
  }),
  scheduledTime: z.string().regex(timeRegex, 'Time must be in HH:MM:SS format'),
  consultationFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format').default('0.00'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Update schema
export const updateAppointmentSchema = z.object({
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']).optional(),
  appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']).optional(),
  scheduledDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').refine(isValidFutureDate, {
    message: 'Appointment date cannot be in the past',
  }).optional(),
  scheduledTime: z.string().regex(timeRegex, 'Time must be in HH:MM:SS format').optional(),
  consultationFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid fee format').optional(),
});

// Appointment with patient and doctor info for common queries
export const appointmentWithDetailsSchema = z.object({
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']),
  appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  consultationFee: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  patient: z.object({
    email: z.string().email(),
    phoneNumber: z.string(),
    profile: z.object({
      firstName: z.string(),
      lastName: z.string(),
    }).optional(),
  }),
  doctor: z.object({
    specialty: z.string(),
    consultationFee: z.string(),
    user: z.object({
      email: z.string().email(),
      profile: z.object({
        firstName: z.string(),
        lastName: z.string(),
      }).optional(),
    }),
  }),
});

// Appointment booking request schema
export const bookAppointmentSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']).default('consultation'),
  scheduledDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').refine(isValidFutureDate, {
    message: 'Appointment date cannot be in the past',
  }),
  scheduledTime: z.string().regex(timeRegex, 'Time must be in HH:MM:SS format'),
});

// Appointment filters for queries
export const appointmentFiltersSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']).optional(),
  appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Additional schemas for specific operations
export const rescheduleAppointmentSchema = z.object({
  scheduledDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').refine(isValidFutureDate, {
    message: 'New appointment date cannot be in the past',
  }),
  scheduledTime: z.string().regex(timeRegex, 'Time must be in HH:MM:SS format'),
});

export const updateAppointmentStatusSchema = z.object({
  appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']),
});

// Appointment availability check schema
export const checkAvailabilitySchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  scheduledDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  scheduledTime: z.string().regex(timeRegex, 'Time must be in HH:MM:SS format'),
});

// Types
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;
export type AppointmentWithDetails = z.infer<typeof appointmentWithDetailsSchema>;
export type BookAppointmentRequest = z.infer<typeof bookAppointmentSchema>;
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
export type RescheduleAppointmentRequest = z.infer<typeof rescheduleAppointmentSchema>;
export type UpdateAppointmentStatusRequest = z.infer<typeof updateAppointmentStatusSchema>;
export type CheckAvailabilityRequest = z.infer<typeof checkAvailabilitySchema>;

// Enum types
export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'telemedicine' | 'routine_checkup';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';