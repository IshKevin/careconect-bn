import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

// One row per reconciliation run. Findings are stored so the admin can review them later.
export const reconciliationRuns = pgTable('reconciliation_runs', {
  runId: uuid('run_id').primaryKey().defaultRandom().notNull(),
  triggeredBy: text('triggered_by').notNull(), // 'schedule' or the admin's user id
  status: text('status').notNull(), // 'completed' or 'failed'
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  checkedTransactions: integer('checked_transactions').default(0).notNull(),
  checkedInvoices: integer('checked_invoices').default(0).notNull(),
  resolvedCount: integer('resolved_count').default(0).notNull(),
  mismatchCount: integer('mismatch_count').default(0).notNull(),
  findings: jsonb('findings').default([]).notNull(),
  error: text('error'),
});

export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
