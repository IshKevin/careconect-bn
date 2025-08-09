import { eq, and, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users } from '../db/schemas/users';
import { userProfiles } from '../db/schemas/user-profiles';
import {
  UserFilters,
  UpdateUser,
  UpdateUserStatus,
  UserWithProfile,
  CreateUserByAdmin,
} from '../db/schemas/users';
import {
  UpdateUserProfile,
} from '../db/schemas/user-profiles';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import * as bcrypt from 'bcrypt';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

// Define the AppError interface
interface AppError extends Error {
  statusCode: number;
  code: string;
  message: string;
  details?: any[] | any;
}

export class UserService {
  // Get current user profile
  async getMe(userId: string): Promise<UserWithProfile> {
    const user = await db
      .select({
        userId: users.userId,
        email: users.email,
        phoneNumber: users.phoneNumber,
        userType: users.userType,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return {
      ...user[0],
      profile: profile[0]
        ? {
            firstName: profile[0].firstName,
            lastName: profile[0].lastName,
          }
        : undefined,
    };
  }

  // Update current user profile
  async updateMe(userId: string, data: UpdateUserProfile & { email?: string; phoneNumber?: string }): Promise<UserWithProfile> {
    const { email, phoneNumber, firstName, lastName } = data;

    // Check if email is being updated and if it's already taken
    if (email) {
      const existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), sql`${users.userId} != ${userId}`))
        .limit(1);

      if (existingUser[0]) {
        throw new ConflictError(`Email '${email}' is already taken`);
      }
    }

    // Check if phone number is being updated and if it's already taken
    if (phoneNumber) {
      const existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.phoneNumber, phoneNumber), sql`${users.userId} != ${userId}`))
        .limit(1);

      if (existingUser[0]) {
        throw new ConflictError(`Phone number '${phoneNumber}' is already taken`);
      }
    }

    // Update user basic info
    if (email || phoneNumber) {
      await db
        .update(users)
        .set({
          ...(email && { email }),
          ...(phoneNumber && { phoneNumber }),
          updatedAt: new Date(),
        })
        .where(eq(users.userId, userId));
    }

    // Update profile info
    if (firstName || lastName) {
      const existingProfile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (existingProfile[0]) {
        await db
          .update(userProfiles)
          .set({
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId));
      } else {
        // Create profile if it doesn't exist
        await db.insert(userProfiles).values({
          profileId: uuidv4(),
          userId,
          firstName: firstName || '',
          lastName: lastName || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return this.getMe(userId);
  }

  // Delete current user account (deactivate)
  async deleteMe(userId: string): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    await db
      .update(users)
      .set({
        accountStatus: 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));
  }

  // Get specific user profile (admin only)
  async getUserProfile(userId: string): Promise<UserWithProfile> {
    return this.getMe(userId);
  }

  // Update user profile (admin only)
  async updateUserProfile(userId: string, data: UpdateUser): Promise<UserWithProfile> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    // Check for email conflicts
    if (data.email) {
      const existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.email, data.email), sql`${users.userId} != ${userId}`))
        .limit(1);

      if (existingUser[0]) {
        throw new ConflictError(`Email '${data.email}' is already taken`);
      }
    }

    // Check for phone conflicts
    if (data.phoneNumber) {
      const existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.phoneNumber, data.phoneNumber), sql`${users.userId} != ${userId}`))
        .limit(1);

      if (existingUser[0]) {
        throw new ConflictError(`Phone number '${data.phoneNumber}' is already taken`);
      }
    }

    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));

    return this.getMe(userId);
  }

  // Search users (admin only)
  async searchUsers(filters: UserFilters) {
    const {
      userType,
      accountStatus,
      search,
      createdFrom,
      createdTo,
      page = 1,
      limit = 10,
    } = filters;

    const baseQuery = db
      .select({
        userId: users.userId,
        email: users.email,
        phoneNumber: users.phoneNumber,
        userType: users.userType,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLogin: users.lastLogin,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId));

    // Build conditions
    const conditions: any[] = [];

    if (userType) {
      conditions.push(eq(users.userType, userType));
    }

    if (accountStatus) {
      conditions.push(eq(users.accountStatus, accountStatus));
    }

    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.phoneNumber, `%${search}%`),
          like(userProfiles.firstName, `%${search}%`),
          like(userProfiles.lastName, `%${search}%`)
        )
      );
    }

    if (createdFrom) {
      conditions.push(sql`${users.createdAt} >= ${createdFrom}::timestamp`);
    }

    if (createdTo) {
      conditions.push(sql`${users.createdAt} <= ${createdTo}::timestamp`);
    }

    // Apply filters and execute query
    const offset = (page - 1) * limit;
    const results = conditions.length > 0 
      ? await baseQuery.where(and(...conditions)).limit(limit).offset(offset)
      : await baseQuery.limit(limit).offset(offset);

    // Get total count with same conditions
    const countQueryBase = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId));
    
    const totalResult = conditions.length > 0
      ? await countQueryBase.where(and(...conditions))
      : await countQueryBase;
    const total = totalResult[0].count;

    return {
      users: results.map((user) => ({
        userId: user.userId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        profile: user.firstName && user.lastName
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
            }
          : undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // List all users (admin only)
  async listUsers(filters: UserFilters) {
    return this.searchUsers(filters);
  }

  // Create user by admin
  async createUser(data: CreateUserByAdmin): Promise<UserWithProfile> {
    const {
      email,
      phoneNumber,
      password,
      userType,
      firstName,
      lastName,
      accountStatus = 'active',
    } = data;

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.phoneNumber, phoneNumber)))
      .limit(1);

    if (existingUser[0]) {
      throw new ConflictError(
        `User with ${existingUser[0].email === email ? 'email' : 'phone number'} already exists`
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.encryption.saltRounds);

    // Create user
    const userId = uuidv4();
    await db.insert(users).values({
      userId,
      email,
      phoneNumber,
      passwordHash,
      userType,
      accountStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create user profile
    await db.insert(userProfiles).values({
      profileId: uuidv4(),
      userId,
      firstName,
      lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.getMe(userId);
  }

  // Update user status (admin only)
  async updateUserStatus(userId: string, data: UpdateUserStatus): Promise<UserWithProfile> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    await db
      .update(users)
      .set({
        accountStatus: data.accountStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));

    return this.getMe(userId);
  }

  // Unlock user account (admin only)
  async unlockUser(userId: string): Promise<UserWithProfile> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    await db
      .update(users)
      .set({
        accountLockedUntil: null,
        loginAttempts: '0',
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));

    return this.getMe(userId);
  }

  // Check profile completeness
  async getProfileCompleteness(userId: string) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const completeness = {
      hasEmail: !!user[0].email,
      hasPhone: !!user[0].phoneNumber,
      hasFirstName: !!profile[0]?.firstName,
      hasLastName: !!profile[0]?.lastName,
      isEmailVerified: !!user[0].emailVerified,
      isPhoneVerified: !!user[0].phoneVerified,
    };

    const totalFields = Object.keys(completeness).length;
    const completedFields = Object.values(completeness).filter(Boolean).length;
    const completionPercentage = Math.round((completedFields / totalFields) * 100);

    return {
      ...completeness,
      isComplete: completionPercentage === 100,
      completionPercentage,
    };
  }

  // Reset user password (admin only)
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.encryption.saltRounds);

    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));
  }

  // Delete user permanently (admin only)
  async deleteUser(userId: string): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    // Delete user (cascading will handle profile)
    await db.delete(users).where(eq(users.userId, userId));
  }

  // Get user by user type
  async getUsersByType(userType: 'patient' | 'doctor' | 'admin' | 'super_admin', filters?: Partial<UserFilters>) {
    return this.searchUsers({
      userType,
      page: filters?.page || 1,
      limit: filters?.limit || 10,
      ...filters,
    });
  }

  // Get all doctors (useful for patient assignment)
  async getDoctors(filters?: Partial<UserFilters>) {
    return this.getUsersByType('doctor', filters);
  }

  // Get all patients (useful for doctor's patient list)
  async getPatients(filters?: Partial<UserFilters>) {
    return this.getUsersByType('patient', filters);
  }

  // Check if user exists by email or phone
  async checkUserExists(email?: string, phoneNumber?: string): Promise<boolean> {
    if (!email && !phoneNumber) {
      return false;
    }

    const conditions = [];
    if (email) conditions.push(eq(users.email, email));
    if (phoneNumber) conditions.push(eq(users.phoneNumber, phoneNumber));

    const existingUser = await db
      .select()
      .from(users)
      .where(or(...conditions))
      .limit(1);

    return existingUser.length > 0;
  }

  // Get user stats (admin dashboard)
  async getUserStats() {
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalPatients = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userType, 'patient'));
    const totalDoctors = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userType, 'doctor'));
    const activeUsers = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountStatus, 'active'));
    const pendingVerification = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountStatus, 'pending_verification'));

    return {
      totalUsers: totalUsers[0].count,
      totalPatients: totalPatients[0].count,
      totalDoctors: totalDoctors[0].count,
      activeUsers: activeUsers[0].count,
      pendingVerification: pendingVerification[0].count,
      inactiveUsers: totalUsers[0].count - activeUsers[0].count,
    };
  }
}