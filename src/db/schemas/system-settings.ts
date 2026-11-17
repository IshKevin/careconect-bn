import { pgTable, smallint, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';

// One row (id = 1) holding the admin-editable settings as JSON. The shape is validated in
// src/services/settings.service.ts, so new settings need no migration.
export const systemSettings = pgTable('system_settings', {
  id: smallint('id').primaryKey().default(1).notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SystemSettingsRow = typeof systemSettings.$inferSelect;
