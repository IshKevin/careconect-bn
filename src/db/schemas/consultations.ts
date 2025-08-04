import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { appointments } from './appointments';
import { users } from './users';
import { doctors } from './doctors';

// Consultations table
export const consultations = pgTable('consultations', {
  consultationId: uuid('consultation_id').primaryKey().defaultRandom().notNull(),
  appointmentId: uuid('appointment_id').references(() => appointments.appointmentId, { onDelete: 'cascade' }).unique().notNull(),
  patientId: uuid('patient_id').references(() => users.userId, { onDelete: 'restrict' }).notNull(),
  doctorId: uuid('doctor_id').references(() => doctors.doctorId, { onDelete: 'restrict' }).notNull(),
  notes: text('notes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const consultationsRelations = relations(consultations, ({ one }) => ({
  appointment: one(appointments, {
    fields: [consultations.appointmentId],
    references: [appointments.appointmentId],
  }),
  patient: one(users, {
    fields: [consultations.patientId],
    references: [users.userId],
  }),
  doctor: one(doctors, {
    fields: [consultations.doctorId],
    references: [doctors.doctorId],
  }),
}));

// Base select schema
export const selectConsultationSchema = createSelectSchema(consultations);

// Custom insert schema
export const insertConsultationSchema = z.object({
  consultationId: z.string().uuid().optional(),
  appointmentId: z.string().uuid('Invalid appointment ID format'),
  patientId: z.string().uuid('Invalid patient ID format'),
  doctorId: z.string().uuid('Invalid doctor ID format'),
  notes: z.string().min(1, 'Consultation notes are required').max(10000, 'Notes too long'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Update schema
export const updateConsultationSchema = z.object({
  notes: z.string().min(1, 'Consultation notes are required').max(10000, 'Notes too long').optional(),
});

// Consultation with appointment and patient/doctor details
export const consultationWithDetailsSchema = z.object({
  consultationId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  notes: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  appointment: z.object({
    appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']),
    appointmentStatus: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show']),
    scheduledDate: z.string(),
    scheduledTime: z.string(),
    consultationFee: z.string(),
  }),
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

// Create consultation request schema
export const createConsultationSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment ID'),
  notes: z.string().min(1, 'Consultation notes are required').max(10000, 'Notes too long'),
});

// Consultation filters for queries
export const consultationFiltersSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  searchNotes: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Consultation summary for patient history
export const consultationSummarySchema = z.object({
  consultationId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  doctorName: z.string(),
  doctorSpecialty: z.string(),
  notesPreview: z.string(), // First 200 characters of notes
  createdAt: z.date(),
});

// Additional schemas for specific operations
export const consultationNotesUpdateSchema = z.object({
  notes: z.string().min(1, 'Consultation notes are required').max(10000, 'Notes too long'),
});

// Consultation search schema
export const consultationSearchSchema = z.object({
  query: z.string().min(3, 'Search query must be at least 3 characters'),
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Patient consultation history schema
export const patientConsultationHistorySchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  includeNotes: z.boolean().default(false),
});

// Doctor consultation summary schema
export const doctorConsultationSummarySchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Types
export type Consultation = typeof consultations.$inferSelect;
export type NewConsultation = typeof consultations.$inferInsert;
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type UpdateConsultation = z.infer<typeof updateConsultationSchema>;
export type ConsultationWithDetails = z.infer<typeof consultationWithDetailsSchema>;
export type CreateConsultationRequest = z.infer<typeof createConsultationSchema>;
export type ConsultationFilters = z.infer<typeof consultationFiltersSchema>;
export type ConsultationSummary = z.infer<typeof consultationSummarySchema>;
export type ConsultationNotesUpdate = z.infer<typeof consultationNotesUpdateSchema>;
export type ConsultationSearch = z.infer<typeof consultationSearchSchema>;
export type PatientConsultationHistory = z.infer<typeof patientConsultationHistorySchema>;
export type DoctorConsultationSummary = z.infer<typeof doctorConsultationSummarySchema>;