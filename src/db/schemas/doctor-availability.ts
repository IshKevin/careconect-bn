import { pgTable, uuid, integer, time, boolean, timestamp, check} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z, ZodObject, ZodRawShape } from 'zod';
import { doctors } from './doctors';


// Doctor availability table
export const doctorAvailability = pgTable(
  'doctor_availability',
  {
    availabilityId: uuid('availability_id').primaryKey().defaultRandom().notNull(),
    doctorId: uuid('doctor_id').references(() => doctors.doctorId, { onDelete: 'cascade' }).notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    slotDuration: integer('slot_duration').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dayOfWeekCheck: check('day_of_week_check', sql`${table.dayOfWeek} >= 0 AND ${table.dayOfWeek} <= 6`),
    slotDurationCheck: check('slot_duration_check', sql`${table.slotDuration} >= 15`),
  })
);

// Relations
export const doctorAvailabilityRelations = relations(doctorAvailability, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorAvailability.doctorId],
    references: [doctors.doctorId],
  }),
}));

// Day of week mapping
export const daysOfWeek = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
} as const;

// Time regex for HH:MM:SS
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;

// Create base insert schema from table
const baseInsertSchema = createInsertSchema(doctorAvailability);

// Extend with custom validations
export const insertDoctorAvailabilitySchema = baseInsertSchema.extend({
  doctorId: z.string().uuid('Invalid doctor ID format'),
  dayOfWeek: z.number().int().min(0).max(6, 'Day of week must be 0-6 (Sunday-Saturday)'),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:MM:SS format'),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:MM:SS format'),
  slotDuration: z.number().int().min(15, 'Slot duration must be at least 15 minutes').optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  const start = new Date(`1970-01-01T${data.startTime}`);
  const end = new Date(`1970-01-01T${data.endTime}`);
  return end > start;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const selectDoctorAvailabilitySchema = createSelectSchema(doctorAvailability);

// Update schema: partial with cast to fix TS errors
export const updateDoctorAvailabilitySchema = insertDoctorAvailabilitySchema.partial() as unknown as ZodObject<ZodRawShape>;

// Availability with doctor info for common queries
export const availabilityWithDoctorSchema = z.object({
  availabilityId: z.string().uuid(),
  doctorId: z.string().uuid(),
  dayOfWeek: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  slotDuration: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  doctor: z.object({
    userId: z.string().uuid(),
    specialty: z.string(),
    consultationFee: z.string(),
    isActive: z.boolean(),
  }),
});

// Time slot generation schema
export const timeSlotSchema = z.object({
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  isAvailable: z.boolean(),
  appointmentId: z.string().uuid().optional(),
});

// Types
export type DoctorAvailability = typeof doctorAvailability.$inferSelect;
export type NewDoctorAvailability = typeof doctorAvailability.$inferInsert;
export type UpdateDoctorAvailability = z.infer<typeof updateDoctorAvailabilitySchema>;
export type AvailabilityWithDoctor = z.infer<typeof availabilityWithDoctorSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type DayOfWeek = keyof typeof daysOfWeek;
