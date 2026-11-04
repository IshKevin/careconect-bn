import { pgTable, uuid, integer, time, boolean, timestamp, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
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

// Custom date validation function
const isValidTimeRange = (startTime: string, endTime: string): boolean => {
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);
  return end > start;
};

// Base select schema
export const selectDoctorAvailabilitySchema = createSelectSchema(doctorAvailability);

// Custom insert schema
export const insertDoctorAvailabilitySchema = z.object({
  availabilityId: z.string().uuid().optional(),
  doctorId: z.string().uuid('Invalid doctor ID format'),
  dayOfWeek: z.number().int().min(0).max(6, 'Day of week must be 0-6 (Sunday-Saturday)'),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:MM:SS format'),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:MM:SS format'),
  slotDuration: z.number().int().min(15, 'Slot duration must be at least 15 minutes').default(30),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).refine((data) => isValidTimeRange(data.startTime, data.endTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

// Update schema
export const updateDoctorAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6, 'Day of week must be 0-6 (Sunday-Saturday)').optional(),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:MM:SS format').optional(),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:MM:SS format').optional(),
  slotDuration: z.number().int().min(15, 'Slot duration must be at least 15 minutes').optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.startTime && data.endTime) {
    return isValidTimeRange(data.startTime, data.endTime);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

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

// Additional schemas for availability management
export const setDoctorAvailabilitySchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  schedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'Start time must be in HH:MM:SS format'),
    endTime: z.string().regex(timeRegex, 'End time must be in HH:MM:SS format'),
    slotDuration: z.number().int().min(15).default(30),
    isActive: z.boolean().default(true),
  })).min(1, 'At least one schedule is required'),
}).refine((data) => {
  // Validate all time ranges
  return data.schedules.every(schedule => 
    isValidTimeRange(schedule.startTime, schedule.endTime)
  );
}, {
  message: 'All end times must be after their corresponding start times',
  path: ['schedules'],
});

export const getAvailableSlotsSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  includeBooked: z.boolean().default(false),
});

export const bulkUpdateAvailabilitySchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  isActive: z.boolean(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  reason: z.string().optional(),
});

export const availabilityFiltersSchema = z.object({
  doctorId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  isActive: z.boolean().optional(),
  startTimeAfter: z.string().regex(timeRegex).optional(),
  endTimeBefore: z.string().regex(timeRegex).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const weeklyScheduleSchema = z.object({
  doctorId: z.string().uuid(),
  week: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    dayName: z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    schedules: z.array(z.object({
      availabilityId: z.string().uuid(),
      startTime: z.string(),
      endTime: z.string(),
      slotDuration: z.number(),
      isActive: z.boolean(),
      totalSlots: z.number(),
      availableSlots: z.number(),
    })),
    isWorkingDay: z.boolean(),
  })).length(7),
});

export const doctorScheduleSummarySchema = z.object({
  doctorId: z.string().uuid(),
  doctorName: z.string(),
  specialty: z.string(),
  totalWeeklyHours: z.number(),
  workingDays: z.number(),
  averageSlotDuration: z.number(),
  isCurrentlyAvailable: z.boolean(),
  nextAvailableSlot: z.object({
    date: z.string(),
    time: z.string(),
    dayOfWeek: z.number(),
  }).optional(),
});

// Types
export type DoctorAvailability = typeof doctorAvailability.$inferSelect;
export type NewDoctorAvailability = typeof doctorAvailability.$inferInsert;
export type InsertDoctorAvailability = z.infer<typeof insertDoctorAvailabilitySchema>;
export type UpdateDoctorAvailability = z.infer<typeof updateDoctorAvailabilitySchema>;
export type AvailabilityWithDoctor = z.infer<typeof availabilityWithDoctorSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type SetDoctorAvailability = z.infer<typeof setDoctorAvailabilitySchema>;
export type GetAvailableSlots = z.infer<typeof getAvailableSlotsSchema>;
export type BulkUpdateAvailability = z.infer<typeof bulkUpdateAvailabilitySchema>;
export type AvailabilityFilters = z.infer<typeof availabilityFiltersSchema>;
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;
export type DoctorScheduleSummary = z.infer<typeof doctorScheduleSummarySchema>;

// Enum types
export type DayOfWeek = keyof typeof daysOfWeek;