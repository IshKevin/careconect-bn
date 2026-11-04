import { eq, and, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors } from '../db/schemas';
import {
  DoctorFilters,
  UpdateDoctor,
  CreateDoctorByAdmin,
  DoctorWithUser,
  UpdateDoctorStatus,
  DoctorProfile,
  DoctorStats,
} from '../db/schemas/doctors';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import * as bcrypt from 'bcrypt';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { doctorStats } from './dashboard.service';

// Define the AppError interface
interface AppError extends Error {
  statusCode: number;
  code: string;
  message: string;
  details?: any[] | any;
}

export class DoctorService {
  // Create doctor by admin
  async createDoctor(data: CreateDoctorByAdmin): Promise<DoctorWithUser> {
    const {
      email,
      phoneNumber,
      password,
      firstName,
      lastName,
      medicalLicenseNumber,
      specialty,
      consultationFee,
      isActive = true,
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

    // Check if medical license exists
    const existingDoctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.medicalLicenseNumber, medicalLicenseNumber))
      .limit(1);

    if (existingDoctor[0]) {
      throw new ConflictError(`Medical license number '${medicalLicenseNumber}' already exists`);
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
      userType: 'doctor',
      accountStatus: 'active',
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

    // Create doctor record
    const doctorId = uuidv4();
    await db.insert(doctors).values({
      doctorId,
      userId,
      medicalLicenseNumber,
      specialty,
      consultationFee: consultationFee.toString(),
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.getDoctor(doctorId);
  }

  // List doctors with filters
  async listDoctors(filters: DoctorFilters) {
    const {
      specialty,
      isActive,
      minFee,
      maxFee,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const baseQuery = db
      .select({
        doctorId: doctors.doctorId,
        userId: doctors.userId,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        specialty: doctors.specialty,
        consultationFee: doctors.consultationFee,
        isActive: doctors.isActive,
        createdAt: doctors.createdAt,
        updatedAt: doctors.updatedAt,
        email: users.email,
        phoneNumber: users.phoneNumber,
        accountStatus: users.accountStatus,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId));

    // Build conditions
    const conditions: any[] = [];

    if (specialty) {
      conditions.push(eq(doctors.specialty, specialty));
    }

    if (isActive !== undefined) {
      conditions.push(eq(doctors.isActive, isActive));
    }

    if (minFee !== undefined) {
      conditions.push(sql`CAST(${doctors.consultationFee} AS DECIMAL) >= ${minFee}`);
    }

    if (maxFee !== undefined) {
      conditions.push(sql`CAST(${doctors.consultationFee} AS DECIMAL) <= ${maxFee}`);
    }

    if (search) {
      conditions.push(
        or(
          like(userProfiles.firstName, `%${search}%`),
          like(userProfiles.lastName, `%${search}%`),
          like(doctors.medicalLicenseNumber, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }

    // Apply filters and execute query
    const offset = (page - 1) * limit;
    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).limit(limit).offset(offset)
      : await baseQuery.limit(limit).offset(offset);

    // Get total count
    const countQueryBase = db.select({ count: sql<number>`count(*)` })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId));
    
    const totalResult = conditions.length > 0
      ? await countQueryBase.where(and(...conditions))
      : await countQueryBase;
    const total = totalResult[0].count;

    return {
      doctors: results.map((doctor) => ({
        doctorId: doctor.doctorId,
        userId: doctor.userId,
        medicalLicenseNumber: doctor.medicalLicenseNumber,
        specialty: doctor.specialty,
        consultationFee: doctor.consultationFee,
        isActive: doctor.isActive,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
        user: {
          email: doctor.email,
          phoneNumber: doctor.phoneNumber,
          userType: 'doctor' as const,
          accountStatus: doctor.accountStatus,
          profile: doctor.firstName
            ? {
                firstName: doctor.firstName,
                lastName: doctor.lastName,
              }
            : undefined,
        },
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

  // Get doctor by ID with full profile
  async getDoctor(doctorId: string): Promise<DoctorWithUser> {
    const result = await db
      .select({
        doctorId: doctors.doctorId,
        userId: doctors.userId,
        medicalLicenseNumber: doctors.medicalLicenseNumber,
        specialty: doctors.specialty,
        consultationFee: doctors.consultationFee,
        isActive: doctors.isActive,
        createdAt: doctors.createdAt,
        updatedAt: doctors.updatedAt,
        email: users.email,
        phoneNumber: users.phoneNumber,
        accountStatus: users.accountStatus,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError('Doctor');
    }

    const doctor = result[0];
    return {
      doctorId: doctor.doctorId,
      userId: doctor.userId,
      medicalLicenseNumber: doctor.medicalLicenseNumber,
      specialty: doctor.specialty as any,
      consultationFee: doctor.consultationFee,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
      user: {
        email: doctor.email,
        phoneNumber: doctor.phoneNumber,
        userType: 'doctor' as const,
        accountStatus: doctor.accountStatus,
        profile: doctor.firstName
          ? {
              firstName: doctor.firstName,
              lastName: doctor.lastName,
            }
          : undefined,
      },
    };
  }

  // Update doctor details
  async updateDoctor(doctorId: string, data: UpdateDoctor): Promise<DoctorWithUser> {
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Check for license conflicts if updating license number
    if (data.medicalLicenseNumber) {
      const existingDoctor = await db
        .select()
        .from(doctors)
        .where(
          and(
            eq(doctors.medicalLicenseNumber, data.medicalLicenseNumber),
            sql`${doctors.doctorId} != ${doctorId}`
          )
        )
        .limit(1);

      if (existingDoctor[0]) {
        throw new ConflictError(
          `Medical license number '${data.medicalLicenseNumber}' already exists`
        );
      }
    }

    await db
      .update(doctors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(doctors.doctorId, doctorId));

    return this.getDoctor(doctorId);
  }

  // Update doctor status (activate/deactivate)
  async updateDoctorStatus(doctorId: string, data: UpdateDoctorStatus): Promise<DoctorWithUser> {
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    await db
      .update(doctors)
      .set({
        isActive: data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(doctors.doctorId, doctorId));

    return this.getDoctor(doctorId);
  }

  // Get doctor statistics
  async getDoctorStats(doctorId: string): Promise<DoctorStats> {
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    const stats = await doctorStats(doctorId);
    return {
      doctorId,
      totalAppointments: stats?.totalAppointments ?? 0,
      completedConsultations: stats?.totalConsultations ?? 0,
      totalRevenue: Number(stats?.paidRevenue ?? 0),
      averageRating: 0, // No rating feature yet
      patientCount: stats?.totalPatients ?? 0,
      upcomingAppointments: stats?.upcomingAppointments ?? 0,
    };
  }

  // Get doctor profile for public display
  async getDoctorProfile(doctorId: string): Promise<DoctorProfile> {
    const doctorData = await this.getDoctor(doctorId);
    
    return {
      doctorId: doctorData.doctorId,
      firstName: doctorData.user.profile?.firstName || '',
      lastName: doctorData.user.profile?.lastName || '',
      email: doctorData.user.email,
      phoneNumber: doctorData.user.phoneNumber,
      specialty: doctorData.specialty,
      consultationFee: doctorData.consultationFee,
      medicalLicenseNumber: doctorData.medicalLicenseNumber,
      isActive: doctorData.isActive,
      accountStatus: doctorData.user.accountStatus,
      // TODO: Add these fields to user profile schema in future
      totalExperience: undefined,
      education: undefined,
      certifications: undefined,
    };
  }

  // Search active doctors for patient booking
  async searchActiveDoctors(filters: Pick<DoctorFilters, 'specialty' | 'search' | 'page' | 'limit'>) {
    const activeFilters = {
      ...filters,
      isActive: true,
    };
    
    return this.listDoctors(activeFilters);
  }

  // Delete doctor (admin only)
  async deleteDoctor(doctorId: string): Promise<void> {
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Delete doctor record (cascading will handle user and profile)
    await db.delete(doctors).where(eq(doctors.doctorId, doctorId));
  }
}
