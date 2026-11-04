import { pgTable, uuid, varchar, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const userTypeEnum = pgEnum('user_type', ['patient', 'doctor', 'admin', 'super_admin', 'sponsor']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'inactive', 'suspended', 'pending_verification']);

// Users table
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

// Base select schema
export const selectUserSchema = createSelectSchema(users);

// Custom insert schema
export const insertUserSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  passwordHash: z.string().min(60, 'Password hash must be valid BCrypt hash'),
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']).default('active'),
  emailVerified: z.string().optional(),
  phoneVerified: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastLogin: z.date().optional(),
  loginAttempts: z.string().optional(),
  accountLockedUntil: z.date().optional(),
});

// Update schema
export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  passwordHash: z.string().min(60, 'Password hash must be valid BCrypt hash').optional(),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']).optional(),
  emailVerified: z.string().optional(),
  phoneVerified: z.string().optional(),
  lastLogin: z.date().optional(),
  loginAttempts: z.string().optional(),
  accountLockedUntil: z.date().optional(),
});

// Authentication schemas
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  userType: z.enum(['patient', 'doctor', 'sponsor']), // Patients, doctors and sponsors can register directly
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'Password too long'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Email verification schemas
export const emailVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  email: z.string().email('Invalid email format'),
});

// Phone verification schemas
export const phoneVerificationSchema = z.object({
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX'),
});

export const phoneVerificationConfirmSchema = z.object({
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX'),
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
});

// User profile update schema
export const updateUserProfileSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX').optional(),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
});

// Admin user management schemas
export const createUserByAdminSchema = z.object({
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().regex(/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']).default('active'),
});

export const updateUserStatusSchema = z.object({
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
  reason: z.string().optional(),
});

// User filters for queries
export const userFiltersSchema = z.object({
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']).optional(),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']).optional(),
  search: z.string().optional(), // Search by email or phone
  createdFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// User with profile schema for common queries
export const userWithProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  userType: z.enum(['patient', 'doctor', 'admin', 'super_admin', 'sponsor']),
  accountStatus: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
  emailVerified: z.string().nullable(),
  phoneVerified: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().nullable(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
  }).optional(),
});

// Security log schema
export const securityLogSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum([
    'login_success',
    'login_failed',
    'password_changed',
    'email_verified',
    'phone_verified',
    'account_locked',
    'account_unlocked',
    'profile_updated'
  ]),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  details: z.record(z.any()).optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirm = z.infer<typeof resetPasswordConfirmSchema>;
export type EmailVerification = z.infer<typeof emailVerificationSchema>;
export type EmailVerificationConfirm = z.infer<typeof emailVerificationConfirmSchema>;
export type PhoneVerification = z.infer<typeof phoneVerificationSchema>;
export type PhoneVerificationConfirm = z.infer<typeof phoneVerificationConfirmSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type CreateUserByAdmin = z.infer<typeof createUserByAdminSchema>;
export type UpdateUserStatus = z.infer<typeof updateUserStatusSchema>;
export type UserFilters = z.infer<typeof userFiltersSchema>;
export type UserWithProfile = z.infer<typeof userWithProfileSchema>;
export type SecurityLog = z.infer<typeof securityLogSchema>;

// Enum types
export type UserType = 'patient' | 'doctor' | 'admin' | 'super_admin' | 'sponsor';
export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';