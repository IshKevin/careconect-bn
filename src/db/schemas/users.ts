import { pgTable, uuid, varchar, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userTypeEnum = pgEnum('user_type', ['patient', 'doctor', 'admin', 'super_admin']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'inactive', 'suspended', 'pending_verification']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other', 'prefer_not_to_say']);
export const addressTypeEnum = pgEnum('address_type', ['home', 'work', 'billing', 'emergency']);
export const mfaMethodTypeEnum = pgEnum('mfa_method_type', ['sms', 'email', 'totp', 'backup_codes']);

// Users table
export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 20 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  userType: userTypeEnum('user_type').notNull(),
  accountStatus: accountStatusEnum('account_status').notNull().default('pending_verification'),
  emailVerified: boolean('email_verified').notNull().default(false),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLogin: timestamp('last_login'),
  loginAttempts: integer('login_attempts').notNull().default(0),
  accountLockedUntil: timestamp('account_locked_until'),
});

// User profiles table
export const userProfiles = pgTable('user_profiles', {
  profileId: uuid('profile_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  dateOfBirth: timestamp('date_of_birth', { mode: 'date' }),
  gender: genderEnum('gender'),
  nationality: varchar('nationality', { length: 100 }),
  nationalId: varchar('national_id', { length: 50 }).unique(),
  passportNumber: varchar('passport_number', { length: 50 }),
  profilePictureUrl: varchar('profile_picture_url', { length: 500 }),
  preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
  timezone: varchar('timezone', { length: 50 }).default('Africa/Kigali'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User addresses table
export const userAddresses = pgTable('user_addresses', {
  addressId: uuid('address_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  addressType: addressTypeEnum('address_type').notNull(),
  streetAddress: varchar('street_address', { length: 255 }),
  city: varchar('city', { length: 100 }),
  district: varchar('district', { length: 100 }),
  province: varchar('province', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }).default('Rwanda'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// User sessions table
export const userSessions = pgTable('user_sessions', {
  sessionId: uuid('session_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  refreshToken: varchar('refresh_token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Multi-factor authentication table
export const multiFactorAuth = pgTable('multi_factor_auth', {
  mfaId: uuid('mfa_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  methodType: mfaMethodTypeEnum('method_type').notNull(),
  secretKey: varchar('secret_key', { length: 255 }),
  isEnabled: boolean('is_enabled').notNull().default(false),
  backupCodes: text('backup_codes'), // JSON array of backup codes
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// User permissions table
export const userPermissions = pgTable('user_permissions', {
  permissionId: uuid('permission_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  grantedBy: uuid('granted_by').references(() => users.userId),
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
});

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  logId: uuid('log_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.userId),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  oldValues: text('old_values'), // JSON
  newValues: text('new_values'), // JSON
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  severity: pgEnum('severity', ['low', 'medium', 'high', 'critical'])('severity').notNull().default('low'),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.userId],
    references: [userProfiles.userId],
  }),
  addresses: many(userAddresses),
  sessions: many(userSessions),
  mfaSettings: many(multiFactorAuth),
  permissions: many(userPermissions),
  auditLogs: many(auditLogs),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.userId],
  }),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.userId],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.userId],
  }),
}));

export const multiFactorAuthRelations = relations(multiFactorAuth, ({ one }) => ({
  user: one(users, {
    fields: [multiFactorAuth.userId],
    references: [users.userId],
  }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.userId],
  }),
  grantedByUser: one(users, {
    fields: [userPermissions.grantedBy],
    references: [users.userId],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.userId],
  }),
}));
