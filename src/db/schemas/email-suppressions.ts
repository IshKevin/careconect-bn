import { pgTable, text, pgEnum, timestamp } from 'drizzle-orm/pg-core';

export const emailSuppressionReasonEnum = pgEnum('email_suppression_reason', ['bounced', 'complained']);

// Addresses that bounced or complained. Transactional mail to them is skipped.
export const emailSuppressions = pgTable('email_suppressions', {
  email: text('email').primaryKey().notNull(),
  reason: emailSuppressionReasonEnum('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
