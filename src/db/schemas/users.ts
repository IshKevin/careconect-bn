import { pgTable, uuid, varchar, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z, ZodObject,  ZodRawShape  } from 'zod';

// Enums
export const userTypeEnum = pgEnum('user_type', ['patient', 'doctor', 'admin', 'super_admin']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'inactive', 'suspended', 'pending_verification']);

// Table
export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  userType: userTypeEnum('user_type').notNull(),
  accountStatus: accountStatusEnum('account_status').default('active').notNull(),
  emailVerified: varchar('email_verified', { length: 255 }),
  phoneVerified: varchar('phone_verified', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  loginAttempts: varchar('login_attempts', { length: 255 }),
  accountLockedUntil: timestamp('account_locked_until', { withTimezone: true }),
});

// Create schemas
const baseInsertSchema = createInsertSchema(users);

export const insertUserSchema = baseInsertSchema.extend({
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  passwordHash: z.string().min(60, 'Password hash must be valid BCrypt hash'),
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin']),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']).optional(),
  emailVerified: z.string().optional(),
  phoneVerified: z.string().optional(),
  loginAttempts: z.string().optional(),
});

export const selectUserSchema = createSelectSchema(users);

export const updateUserSchema = insertUserSchema.partial() as unknown as ZodObject<ZodRawShape>;


// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserType = 'patient' | 'doctor' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';
