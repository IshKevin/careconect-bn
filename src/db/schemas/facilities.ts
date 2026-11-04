import { pgTable, uuid, varchar, pgEnum, timestamp } from 'drizzle-orm/pg-core';

// A healthcare facility (hospital, clinic, practice) that employs or contracts doctors.
// Clinic settlement is calculated per facility. Only a settlement reference is stored here,
// never bank details.
export const facilityVerificationEnum = pgEnum('facility_verification_status', ['pending', 'verified', 'rejected', 'suspended']);

export const facilities = pgTable('facilities', {
  facilityId: uuid('facility_id').primaryKey().defaultRandom().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  facilityType: varchar('facility_type', { length: 50 }).notNull(),
  registrationNumber: varchar('registration_number', { length: 100 }).unique().notNull(),
  district: varchar('district', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  verificationStatus: facilityVerificationEnum('verification_status').default('pending').notNull(),
  settlementAccountRef: varchar('settlement_account_ref', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Facility = typeof facilities.$inferSelect;
export type FacilityVerificationStatus = (typeof facilityVerificationEnum.enumValues)[number];
