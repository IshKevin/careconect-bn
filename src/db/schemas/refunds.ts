import { pgTable, uuid, text, pgEnum, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { invoices } from './invoices';
import { paymentTransactions } from './payment-transactions';
import { users } from './users';

// Refunds need two people: the admin who requests one cannot approve it.
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'approved', 'processed', 'rejected', 'failed']);

export const refunds = pgTable(
  'refunds',
  {
    refundId: uuid('refund_id').primaryKey().defaultRandom().notNull(),
    invoiceId: uuid('invoice_id').references(() => invoices.invoiceId, { onDelete: 'restrict' }).notNull(),
    transactionId: uuid('transaction_id').references(() => paymentTransactions.id, { onDelete: 'restrict' }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    reason: text('reason').notNull(),
    status: refundStatusEnum('status').default('pending').notNull(),
    requestedBy: uuid('requested_by').references(() => users.userId, { onDelete: 'restrict' }).notNull(),
    approvedBy: uuid('approved_by').references(() => users.userId, { onDelete: 'restrict' }),
    decisionNote: text('decision_note'),
    pesapalRefundRef: text('pesapal_refund_ref'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    invoiceIdx: index('refunds_invoice_idx').on(table.invoiceId),
    statusIdx: index('refunds_status_idx').on(table.status),
  }),
);

export const refundsRelations = relations(refunds, ({ one }) => ({
  invoice: one(invoices, { fields: [refunds.invoiceId], references: [invoices.invoiceId] }),
  transaction: one(paymentTransactions, { fields: [refunds.transactionId], references: [paymentTransactions.id] }),
}));

export type Refund = typeof refunds.$inferSelect;
export type RefundStatus = (typeof refundStatusEnum.enumValues)[number];
