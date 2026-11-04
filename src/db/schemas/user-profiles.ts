import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';

// User profiles table
export const userProfiles = pgTable('user_profiles', {
  profileId: uuid('profile_id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).unique().notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.userId],
  }),
}));

// Base select schema
export const selectUserProfileSchema = createSelectSchema(userProfiles);

// Custom insert schema
export const insertUserProfileSchema = z.object({
  profileId: z.string().uuid().optional(),
  userId: z.string().uuid('Invalid user ID format'),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Update schema
export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
});

// Additional schemas for profile management
export const createProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
});

export const profileSearchSchema = z.object({
  search: z.string().min(2, 'Search term must be at least 2 characters'),
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Full profile with user data schema
export const fullUserProfileSchema = z.object({
  profileId: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.object({
    email: z.string().email(),
    phoneNumber: z.string().nullable(),
    userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']),
    accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
    emailVerified: z.string().nullable(),
    phoneVerified: z.string().nullable(),
    lastLogin: z.date().nullable(),
  }),
});

// Profile validation for completeness
export const profileCompletenessSchema = z.object({
  hasFirstName: z.boolean(),
  hasLastName: z.boolean(),
  hasEmail: z.boolean(),
  hasPhone: z.boolean(),
  isComplete: z.boolean(),
  completionPercentage: z.number().min(0).max(100),
});

// Types
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type CreateProfile = z.infer<typeof createProfileSchema>;
export type ProfileSearch = z.infer<typeof profileSearchSchema>;
export type FullUserProfile = z.infer<typeof fullUserProfileSchema>;
export type ProfileCompleteness = z.infer<typeof profileCompletenessSchema>;