import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z, ZodObject, ZodRawShape } from 'zod';
import { users } from './users';


export const userProfiles = pgTable('user_profiles', {
  profileId: uuid('profile_id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).unique().notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});



export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.userId],
  }),
}));

// Zod schemas for validation
const baseInsertUserProfileSchema = createInsertSchema(userProfiles);

export const insertUserProfileSchema = baseInsertUserProfileSchema.extend({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  userId: z.string().uuid('Invalid user ID format'),
});

export const selectUserProfileSchema = createSelectSchema(userProfiles);

// Fixing type inference issue
export const updateUserProfileSchema = insertUserProfileSchema.partial() as unknown as ZodObject<ZodRawShape>;

// Types
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
