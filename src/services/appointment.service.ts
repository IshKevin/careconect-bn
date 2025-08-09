import { eq, and, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors, appointments } from '../db/schemas';
import {
  AppointmentFilters,
  UpdateAppointment,
  BookAppointmentRequest,
  AppointmentWithDetails,
  UpdateAppointmentStatusRequest,
  RescheduleAppointmentRequest,
  CheckAvailabilityRequest,
} from '../db/schemas/appointments';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class AppointmentService {
  // Book appointment (patient)
  async bookAppointment(patientId: string, data: BookAppointmentRequest): Promise<AppointmentWithDetails> {
    const { doctorId, appointmentType, scheduledDate, scheduledTime } = data;

    // Verify patient exists
    const patient = await db
      .select()
      .from(users)
      .where(eq(users.userId, patientId))
      .limit(1);

    if (!patient[0] || patient[0].userType !== 'patient') {
      throw new NotFoundError('Patient');
    }

    // Verify doctor exists and is active
    const doctor = await db
      .select()
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.userId))
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0] || !doctor[0].doctors.isActive) {
      throw new NotFoundError('Active doctor');
    }

    // Check if time slot is available
    const isAvailable = await this.checkTimeSlotAvailability(doctorId, scheduledDate, scheduledTime);
    if (!isAvailable) {
      throw new ConflictError('Time slot is not available');
    }

    // Create appointment
    const appointmentId = uuidv4();
    await db.insert(appointments).values({
      appointmentId,
      patientId,
      doctorId,
      appointmentType,
      appointmentStatus: 'scheduled',
      scheduledDate,
      scheduledTime,
      consultationFee: doctor[0].doctors.consultationFee,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.getAppointment(appointmentId);
  }

  // Check time slot availability
  async checkTimeSlotAvailability(doctorId: string, scheduledDate: string, scheduledTime: string): Promise<boolean> {
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, scheduledDate),
          eq(appointments.scheduledTime, scheduledTime),
          sql`${appointments.appointmentStatus} NOT IN ('cancelled', 'no_show')`
        )
      )
      .limit(1);

    return !existingAppointment[0];
  }

  // Get available time slots for a doctor on a specific date
  async getAvailableTimeSlots(doctorId: string, date: string): Promise<string[]> {
    // Get all booked slots for the date
    const bookedSlots = await db
      .select({ scheduledTime: appointments.scheduledTime })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, date),
          sql`${appointments.appointmentStatus} NOT IN ('cancelled', 'no_show')`
        )
      );

    // Generate time slots (9 AM to 5 PM, 30-minute intervals)
    const allSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      allSlots.push(`${hour.toString().padStart(2, '0')}:00:00`);
      allSlots.push(`${hour.toString().padStart(2, '0')}:30:00`);
    }

    // Filter out booked slots
    const bookedTimes = bookedSlots.map(slot => slot.scheduledTime);
    return allSlots.filter(slot => !bookedTimes.includes(slot));
  }

  // List appointments with filters
  async listAppointments(filters: AppointmentFilters) {
    const {
      patientId,
      doctorId,
      appointmentType,
      appointmentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const baseQuery = db
      .select({
        appointmentId: appointments.appointmentId,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        appointmentType: appointments.appointmentType,
        appointmentStatus: appointments.appointmentStatus,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        consultationFee: appointments.consultationFee,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.doctorId));

    // Build conditions
    const conditions: any[] = [];

    if (patientId) {
      conditions.push(eq(appointments.patientId, patientId));
    }

    if (doctorId) {
      conditions.push(eq(appointments.doctorId, doctorId));
    }

    if (appointmentType) {
      conditions.push(eq(appointments.appointmentType, appointmentType));
    }

    if (appointmentStatus) {
      conditions.push(eq(appointments.appointmentStatus, appointmentStatus));
    }

    if (startDate) {
      conditions.push(sql`${appointments.scheduledDate} >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`${appointments.scheduledDate} <= ${endDate}`);
    }

    // Apply filters and execute query
    const offset = (page - 1) * limit;
    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).limit(limit).offset(offset).orderBy(appointments.scheduledDate, appointments.scheduledTime)
      : await baseQuery.limit(limit).offset(offset).orderBy(appointments.scheduledDate, appointments.scheduledTime);

    // Get total count
    const countQueryBase = db.select({ count: sql<number>`count(*)` }).from(appointments);
    const totalResult = conditions.length > 0
      ? await countQueryBase.where(and(...conditions))
      : await countQueryBase;
    const total = totalResult[0].count;

    return {
      appointments: results.map((appointment) => ({
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentType: appointment.appointmentType,
        appointmentStatus: appointment.appointmentStatus,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        consultationFee: appointment.consultationFee,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        patient: {
          email: appointment.patientEmail,
          phoneNumber: appointment.patientPhone,
          profile: appointment.patientFirstName
            ? {
                firstName: appointment.patientFirstName,
                lastName: appointment.patientLastName,
              }
            : undefined,
        },
        doctor: {
          specialty: appointment.doctorSpecialty,
          consultationFee: appointment.doctorConsultationFee,
          user: {
            email: '',
            profile: undefined,
          },
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

  // Get appointment by ID with full details
  async getAppointment(appointmentId: string): Promise<AppointmentWithDetails> {
    const result = await db
      .select({
        appointmentId: appointments.appointmentId,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        appointmentType: appointments.appointmentType,
        appointmentStatus: appointments.appointmentStatus,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        consultationFee: appointments.consultationFee,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.doctorId))
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError('Appointment');
    }

    const appointment = result[0];
    return {
      appointmentId: appointment.appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentType: appointment.appointmentType,
      appointmentStatus: appointment.appointmentStatus,
      scheduledDate: appointment.scheduledDate,
      scheduledTime: appointment.scheduledTime,
      consultationFee: appointment.consultationFee,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      patient: {
        email: appointment.patientEmail,
        phoneNumber: appointment.patientPhone,
        profile: appointment.patientFirstName
          ? {
              firstName: appointment.patientFirstName,
              lastName: appointment.patientLastName,
            }
          : undefined,
      },
      doctor: {
        specialty: appointment.doctorSpecialty,
        consultationFee: appointment.doctorConsultationFee,
        user: {
          email: '',
          profile: undefined,
        },
      },
    };
  }

  // Update appointment
  async updateAppointment(appointmentId: string, data: UpdateAppointment): Promise<AppointmentWithDetails> {
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    await db
      .update(appointments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(appointments.appointmentId, appointmentId));

    return this.getAppointment(appointmentId);
  }

  // Update appointment status
  async updateAppointmentStatus(appointmentId: string, data: UpdateAppointmentStatusRequest): Promise<AppointmentWithDetails> {
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    await db
      .update(appointments)
      .set({
        appointmentStatus: data.appointmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(appointments.appointmentId, appointmentId));

    return this.getAppointment(appointmentId);
  }

  // Reschedule appointment
  async rescheduleAppointment(appointmentId: string, data: RescheduleAppointmentRequest): Promise<AppointmentWithDetails> {
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    // Check new time slot availability
    const isAvailable = await this.checkTimeSlotAvailability(
      appointment[0].doctorId, 
      data.scheduledDate, 
      data.scheduledTime
    );
    
    if (!isAvailable) {
      throw new ConflictError('New time slot is not available');
    }

    await db
      .update(appointments)
      .set({
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        appointmentStatus: 'rescheduled',
        updatedAt: new Date(),
      })
      .where(eq(appointments.appointmentId, appointmentId));

    return this.getAppointment(appointmentId);
  }

  // Cancel appointment
  async cancelAppointment(appointmentId: string): Promise<AppointmentWithDetails> {
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    await db
      .update(appointments)
      .set({
        appointmentStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(appointments.appointmentId, appointmentId));

    return this.getAppointment(appointmentId);
  }

  // Get patient's appointments
  async getPatientAppointments(patientId: string, filters: Pick<AppointmentFilters, 'appointmentStatus' | 'startDate' | 'endDate' | 'page' | 'limit'>) {
    return this.listAppointments({
      ...filters,
      patientId,
    });
  }

  // Get doctor's appointments  
  async getDoctorAppointments(doctorId: string, filters: Pick<AppointmentFilters, 'appointmentStatus' | 'startDate' | 'endDate' | 'page' | 'limit'>) {
    return this.listAppointments({
      ...filters,
      doctorId,
    });
  }

  // Delete appointment (admin only)
  async deleteAppointment(appointmentId: string): Promise<void> {
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    await db.delete(appointments).where(eq(appointments.appointmentId, appointmentId));
  }
}
