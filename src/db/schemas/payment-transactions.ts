import { pgTable, uuid, text, pgEnum, numeric, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { invoices } from './invoices';
import { users } from './users';

export const paymentProviderEnum = pgEnum('payment_provider', ['pesapal']);

export const paymentTransactionStatusEnum = pgEnum('payment_transaction_status', [
  'pending',
  'completed',
  'failed',
  'reversed',
  'invalid',
]);

// One row per payment attempt. The reference is created on the server and the
// amount is copied from the invoice, so the client never chooses either.
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    txRef: text('tx_ref').notNull().unique(),
    invoiceId: uuid('invoice_id').references(() => invoices.invoiceId, { onDelete: 'restrict' }).notNull(),
    patientId: uuid('patient_id').references(() => users.userId, { onDelete: 'restrict' }).notNull(),
    provider: paymentProviderEnum('provider').default('pesapal').notNull(),
    orderTrackingId: text('order_tracking_id').unique(),
    confirmationCode: text('confirmation_code'),
    paymentMethod: text('payment_method'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    status: paymentTransactionStatusEnum('status').default('pending').notNull(),
    rawStatus: jsonb('raw_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    invoiceIdx: index('payment_transactions_invoice_idx').on(table.invoiceId),
    statusIdx: index('payment_transactions_status_idx').on(table.status),
  }),
);

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  invoice: one(invoices, {
    fields: [paymentTransactions.invoiceId],
    references: [invoices.invoiceId],
  }),
  patient: one(users, {
    fields: [paymentTransactions.patientId],
    references: [users.userId],
  }),
}));

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type PaymentTransactionStatus = (typeof paymentTransactionStatusEnum.enumValues)[number];
