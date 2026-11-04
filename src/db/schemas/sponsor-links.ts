import { pgTable, uuid, pgEnum, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { relationshipEnum } from './patients';

// A sponsor (diaspora member) books and pays for a patient in Rwanda.
// Payment or booking alone never grants medical access: that needs medicalAccessGranted,
// which only the patient can switch on.
export const sponsorLinkStatusEnum = pgEnum('sponsor_link_status', ['pending', 'active', 'revoked']);

export const sponsorLinks = pgTable(
  'sponsor_links',
  {
    linkId: uuid('link_id').primaryKey().defaultRandom().notNull(),
    sponsorUserId: uuid('sponsor_user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
    patientUserId: uuid('patient_user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
    relationship: relationshipEnum('relationship').notNull(),
    status: sponsorLinkStatusEnum('status').default('pending').notNull(),
    medicalAccessGranted: boolean('medical_access_granted').default(false).notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sponsorPatientUnique: unique('sponsor_links_sponsor_patient_unique').on(table.sponsorUserId, table.patientUserId),
  }),
);

export const sponsorLinksRelations = relations(sponsorLinks, ({ one }) => ({
  sponsor: one(users, {
    fields: [sponsorLinks.sponsorUserId],
    references: [users.userId],
    relationName: 'sponsorOf',
  }),
  patient: one(users, {
    fields: [sponsorLinks.patientUserId],
    references: [users.userId],
    relationName: 'sponsoredPatient',
  }),
}));

export type SponsorLink = typeof sponsorLinks.$inferSelect;
export type SponsorLinkStatus = (typeof sponsorLinkStatusEnum.enumValues)[number];
