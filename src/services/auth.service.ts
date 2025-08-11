import { patients } from './../db/schemas/patients';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors, } from '../db/schemas';
import {
  UserLogin,
  UserRegistration,
  ChangePassword,
  ResetPassword,
  ResetPasswordConfirm,
  UserWithProfile,
} from '../db/schemas/users';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

// Define the AppError interface (moved from errors.ts to align with controller)
interface AppError extends Error {
  statusCode: number;
  code: string;
  message: string;
  details?: any[] | any;
}

// Define specific error classes
class AuthenticationError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any[] | any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTH_ERROR';
    this.details = details;
  }
}

class NotFoundError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any[] | any;

  constructor(entity: string, details?: any) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
    this.details = details;
  }
}

class ConflictError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any[] | any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
    this.details = details;
  }
}

class AuthorizationError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any[] | any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.code = 'AUTHORIZATION_ERROR';
    this.details = details;
  }
}

// Updated interface to include doctorId and patientId
interface LoginResponse extends UserWithProfile {
  doctorId?: string;
  patientId?: string;
}

export class AuthService {
  async login(data: UserLogin): Promise<{ accessToken: string; refreshToken: string; user: LoginResponse }> {
    const { email, password } = data;

    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user[0]) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user[0].passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check account status
    if (user[0].accountStatus !== 'active') {
      throw new AuthorizationError('Account is not active');
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.userId, user[0].userId));

    // Get user profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user[0].userId))
      .limit(1);

    // Initialize response user object
    let responseUser: LoginResponse = {
      ...user[0],
      profile: profile[0]
        ? {
          firstName: profile[0].firstName,
          lastName: profile[0].lastName,
        }
        : undefined,
    };

    // Get doctorId or patientId based on user type
    if (user[0].userType === 'doctor') {
      const doctor = await db
        .select({ doctorId: doctors.doctorId })
        .from(doctors)
        .where(eq(doctors.userId, user[0].userId))
        .limit(1);
      
      if (doctor[0]) {
        responseUser.doctorId = doctor[0].doctorId;
      }
    } else if (user[0].userType === 'patient') {
      const patient = await db
        .select({ patientId: patients.patientId })
        .from(patients)
        .where(eq(patients.userId, user[0].userId))
        .limit(1);
      
      if (patient[0]) {
        responseUser.patientId = patient[0].patientId;
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user[0].userId, user[0].userType);
    const refreshToken = this.generateRefreshToken(user[0].userId);

    return {
      accessToken,
      refreshToken,
      user: responseUser,
    };
  }

  async register(data: UserRegistration): Promise<UserWithProfile> {
    const { email, phoneNumber, password, userType, firstName, lastName } = data;

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser[0]) {
      throw new ConflictError(`User with email '${email}' already exists`);
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
      accountStatus: 'active', // to be changed into 'pending_verification', 
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

    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return {
      ...user[0],
      profile: {
        firstName: profile[0].firstName,
        lastName: profile[0].lastName,
      },
    };
  }

  async logout(token: string): Promise<void> {
    // Invalidate token (implementation depends on token management strategy)
    // For example, add to blacklist or revoke refresh token
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };

      const user = await db
        .select()
        .from(users)
        .where(eq(users.userId, decoded.userId))
        .limit(1);

      if (!user[0]) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const accessToken = this.generateAccessToken(user[0].userId, user[0].userType);
      const newRefreshToken = this.generateRefreshToken(user[0].userId);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async forgotPassword(data: ResetPassword): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user[0]) {
      return; // Silently fail to prevent email enumeration
    }

    // Generate reset token and send email (implement email service integration)
    const resetToken = this.generateResetToken(user[0].userId);
    // TODO: Implement email sending with reset token
  }

  async resetPassword(data: ResetPasswordConfirm): Promise<void> {
    try {
      const decoded = jwt.verify(data.token, config.jwt.resetSecret) as { userId: string };

      const user = await db
        .select()
        .from(users)
        .where(eq(users.userId, decoded.userId))
        .limit(1);

      if (!user[0]) {
        throw new AuthenticationError('Invalid reset token');
      }

      const passwordHash = await bcrypt.hash(data.newPassword, config.encryption.saltRounds);
      await db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.userId, user[0].userId));
    } catch (error) {
      throw new AuthenticationError('Invalid reset token');
    }
  }

  async changePassword(userId: string, data: ChangePassword): Promise<void> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user[0]) {
      throw new NotFoundError('User');
    }

    const isPasswordValid = await bcrypt.compare(data.currentPassword, user[0].passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, config.encryption.saltRounds);
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));
  }

  private generateAccessToken(userId: string, userType: string): string {
    const payload = { userId, userType };
    const options: jwt.SignOptions = {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
    };
    return jwt.sign(payload, config.jwt.secret, options);
  }

  private generateRefreshToken(userId: string): string {
    const payload = { userId };
    const options: jwt.SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
    };
    return jwt.sign(payload, config.jwt.refreshSecret, options);
  }

  private generateResetToken(userId: string): string {
    const payload = { userId };
    const options: jwt.SignOptions = {
      expiresIn: '2h',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
    };
    return jwt.sign(payload, config.jwt.resetSecret, options);
  }
}