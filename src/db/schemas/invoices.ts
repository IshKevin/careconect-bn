import { pgTable, uuid, varchar, decimal, pgEnum, date, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { consultations } from './consultations';
import { users } from './users';
import { doctors } from './doctors';

// Enums
export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'paid', 'cancelled']);

// Invoices table
export const invoices = pgTable('invoices', {
  invoiceId: uuid('invoice_id').primaryKey().defaultRandom().notNull(),
  consultationId: uuid('consultation_id').references(() => consultations.consultationId, { onDelete: 'restrict' }).unique().notNull(),
  patientId: uuid('patient_id').references(() => users.userId, { onDelete: 'restrict' }).notNull(),
  doctorId: uuid('doctor_id').references(() => doctors.doctorId, { onDelete: 'restrict' }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 20 }).unique().notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  invoiceStatus: invoiceStatusEnum('invoice_status').default('pending').notNull(),
  invoiceDate: date('invoice_date').defaultNow().notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const invoicesRelations = relations(invoices, ({ one }) => ({
  consultation: one(consultations, {
    fields: [invoices.consultationId],
    references: [consultations.consultationId],
  }),
  patient: one(users, {
    fields: [invoices.patientId],
    references: [users.userId],
  }),
  doctor: one(doctors, {
    fields: [invoices.doctorId],
    references: [doctors.doctorId],
  }),
}));

// Date validation helpers
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Base select schema
export const selectInvoiceSchema = createSelectSchema(invoices);

// Custom insert schema
export const insertInvoiceSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  consultationId: z.string().uuid('Invalid consultation ID format'),
  patientId: z.string().uuid('Invalid patient ID format'),
  doctorId: z.string().uuid('Invalid doctor ID format'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(20, 'Invoice number too long'),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format').default('0.00'),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']).default('pending'),
  invoiceDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').optional(),
  paidAt: z.date().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Update schema
export const updateInvoiceSchema = z.object({
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format').optional(),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']).optional(),
  invoiceDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format').optional(),
  paidAt: z.date().nullable().optional(),
});

// Invoice with consultation and patient/doctor details
export const invoiceWithDetailsSchema = z.object({
  invoiceId: z.string().uuid(),
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  invoiceNumber: z.string(),
  totalAmount: z.string(),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']),
  invoiceDate: z.string(),
  paidAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  consultation: z.object({
    appointmentId: z.string().uuid(),
    notes: z.string(),
    appointment: z.object({
      appointmentType: z.enum(['consultation', 'follow_up', 'emergency', 'telemedicine', 'routine_checkup']),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
    }),
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

// Create invoice request schema
export const createInvoiceSchema = z.object({
  consultationId: z.string().uuid('Invalid consultation ID'),
  totalAmount: z.number().positive('Amount must be positive'),
});

// Update invoice status schema
export const updateInvoiceStatusSchema = z.object({
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']),
  paidAt: z.date().nullable().optional(),
});

// Invoice filters for queries
export const invoiceFiltersSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Invoice summary for reports
export const invoiceSummarySchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string(),
  patientName: z.string(),
  doctorName: z.string(),
  totalAmount: z.string(),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']),
  invoiceDate: z.string(),
  paidAt: z.date().nullable(),
});

// Payment record schema
export const paymentRecordSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer', 'insurance']),
  transactionReference: z.string().optional(),
  paidAt: z.date(),
});

// Additional schemas for specific operations
export const markInvoiceAsPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer', 'insurance']),
  transactionReference: z.string().optional(),
  paidAt: z.date().optional(), // Defaults to now if not provided
});

export const invoicePaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer', 'insurance']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceReportFiltersSchema = z.object({
  startDate: z.string().regex(dateRegex, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(dateRegex, 'End date must be in YYYY-MM-DD format'),
  doctorId: z.string().uuid().optional(),
  invoiceStatus: z.enum(['pending', 'paid', 'cancelled']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export const overDueInvoicesSchema = z.object({
  daysOverdue: z.number().int().min(1).default(30),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Invoice generation schema
export const generateInvoiceSchema = z.object({
  consultationId: z.string().uuid('Invalid consultation ID'),
  customAmount: z.number().positive().optional(), // Override consultation fee if needed
  additionalCharges: z.array(z.object({
    description: z.string().min(1, 'Charge description required'),
    amount: z.number().positive('Charge amount must be positive'),
  })).optional(),
  notes: z.string().optional(),
});

// Types
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;
export type InvoiceWithDetails = z.infer<typeof invoiceWithDetailsSchema>;
export type CreateInvoiceRequest = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatusRequest = z.infer<typeof updateInvoiceStatusSchema>;
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>;
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
export type MarkInvoiceAsPaid = z.infer<typeof markInvoiceAsPaidSchema>;
export type InvoicePayment = z.infer<typeof invoicePaymentSchema>;
export type InvoiceReportFilters = z.infer<typeof invoiceReportFiltersSchema>;
export type OverDueInvoices = z.infer<typeof overDueInvoicesSchema>;
export type GenerateInvoice = z.infer<typeof generateInvoiceSchema>;

// Enum types
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'insurance';