import { eq, and, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors, appointments, consultations } from '../db/schemas';
import {
  ConsultationFilters,
  UpdateConsultation,
  CreateConsultationRequest,
  ConsultationWithDetails,
  ConsultationSummary,
  PatientConsultationHistory,
  DoctorConsultationSummary,
} from '../db/schemas/consultations';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../utils/errors';

// Controllers pass the signed-in user's id; appointments store the doctor record id.
const resolveDoctorId = async (userId: string): Promise<string> => {
  const [doctor] = await db.select({ doctorId: doctors.doctorId }).from(doctors).where(eq(doctors.userId, userId)).limit(1);
  if (!doctor) throw new AuthorizationError('Only doctors can perform this action');
  return doctor.doctorId;
};
import { v4 as uuidv4 } from 'uuid';

export class ConsultationService {
  // Create consultation (doctor only after appointment)
  async createConsultation(userId: string, data: CreateConsultationRequest): Promise<ConsultationWithDetails> {
    const { appointmentId, notes } = data;
    const doctorId = await resolveDoctorId(userId);

    // Verify appointment exists and is completed
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!appointment[0]) {
      throw new NotFoundError('Appointment');
    }

    if (appointment[0].doctorId !== doctorId) {
      throw new ValidationError('You can only create consultations for your own appointments');
    }

    if (appointment[0].appointmentStatus !== 'completed') {
      throw new ValidationError('Appointment must be completed before creating consultation');
    }

    // Check if consultation already exists for this appointment
    const existingConsultation = await db
      .select()
      .from(consultations)
      .where(eq(consultations.appointmentId, appointmentId))
      .limit(1);

    if (existingConsultation[0]) {
      throw new ConflictError('Consultation already exists for this appointment');
    }

    // Create consultation
    const consultationId = uuidv4();
    await db.insert(consultations).values({
      consultationId,
      appointmentId,
      patientId: appointment[0].patientId,
      doctorId,
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.getConsultation(consultationId);
  }

  // List consultations with filters
  async listConsultations(filters: ConsultationFilters) {
    const {
      patientId,
      doctorId,
      appointmentId,
      startDate,
      endDate,
      searchNotes,
      page = 1,
      limit = 10,
    } = filters;

    const baseQuery = db
      .select({
        consultationId: consultations.consultationId,
        appointmentId: consultations.appointmentId,
        patientId: consultations.patientId,
        doctorId: consultations.doctorId,
        notes: consultations.notes,
        createdAt: consultations.createdAt,
        updatedAt: consultations.updatedAt,
        // Appointment info
        appointmentType: appointments.appointmentType,
        appointmentStatus: appointments.appointmentStatus,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        consultationFee: appointments.consultationFee,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
      })
      .from(consultations)
      .leftJoin(appointments, eq(consultations.appointmentId, appointments.appointmentId))
      .leftJoin(users, eq(consultations.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(consultations.doctorId, doctors.doctorId));

    // Build conditions
    const conditions: any[] = [];

    if (patientId) {
      conditions.push(eq(consultations.patientId, patientId));
    }

    if (doctorId) {
      conditions.push(eq(consultations.doctorId, doctorId));
    }

    if (appointmentId) {
      conditions.push(eq(consultations.appointmentId, appointmentId));
    }

    if (startDate) {
      conditions.push(sql`${consultations.createdAt}::date >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`${consultations.createdAt}::date <= ${endDate}`);
    }

    if (searchNotes) {
      conditions.push(like(consultations.notes, `%${searchNotes}%`));
    }

    // Apply filters and execute query
    const offset = (page - 1) * limit;
    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).limit(limit).offset(offset).orderBy(consultations.createdAt)
      : await baseQuery.limit(limit).offset(offset).orderBy(consultations.createdAt);

    // Get total count
    const countQueryBase = db.select({ count: sql<number>`count(*)` }).from(consultations);
    const totalResult = conditions.length > 0
      ? await countQueryBase.where(and(...conditions))
      : await countQueryBase;
    const total = totalResult[0].count;

    return {
      consultations: results.map((consultation) => ({
        consultationId: consultation.consultationId,
        appointmentId: consultation.appointmentId,
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        notes: consultation.notes,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
        appointment: {
          appointmentType: consultation.appointmentType,
          appointmentStatus: consultation.appointmentStatus,
          scheduledDate: consultation.scheduledDate,
          scheduledTime: consultation.scheduledTime,
          consultationFee: consultation.consultationFee,
        },
        patient: {
          email: consultation.patientEmail,
          phoneNumber: consultation.patientPhone,
          profile: consultation.patientFirstName
            ? {
                firstName: consultation.patientFirstName,
                lastName: consultation.patientLastName,
              }
            : undefined,
        },
        doctor: {
          specialty: consultation.doctorSpecialty,
          consultationFee: consultation.doctorConsultationFee,
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

  // Get consultation by ID with full details
  async getConsultation(consultationId: string): Promise<ConsultationWithDetails> {
    const result = await db
      .select({
        consultationId: consultations.consultationId,
        appointmentId: consultations.appointmentId,
        patientId: consultations.patientId,
        doctorId: consultations.doctorId,
        notes: consultations.notes,
        createdAt: consultations.createdAt,
        updatedAt: consultations.updatedAt,
        // Appointment info
        appointmentType: appointments.appointmentType,
        appointmentStatus: appointments.appointmentStatus,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        consultationFee: appointments.consultationFee,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
      })
      .from(consultations)
      .leftJoin(appointments, eq(consultations.appointmentId, appointments.appointmentId))
      .leftJoin(users, eq(consultations.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(consultations.doctorId, doctors.doctorId))
      .where(eq(consultations.consultationId, consultationId))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError('Consultation');
    }

    const consultation = result[0];
    return {
      consultationId: consultation.consultationId,
      appointmentId: consultation.appointmentId,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      notes: consultation.notes,
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
      appointment: {
        appointmentType: consultation.appointmentType,
        appointmentStatus: consultation.appointmentStatus,
        scheduledDate: consultation.scheduledDate,
        scheduledTime: consultation.scheduledTime,
        consultationFee: consultation.consultationFee,
      },
      patient: {
        email: consultation.patientEmail,
        phoneNumber: consultation.patientPhone,
        profile: consultation.patientFirstName
          ? {
              firstName: consultation.patientFirstName,
              lastName: consultation.patientLastName,
            }
          : undefined,
      },
      doctor: {
        specialty: consultation.doctorSpecialty,
        consultationFee: consultation.doctorConsultationFee,
        user: {
          email: '',
          profile: undefined,
        },
      },
    };
  }

  // Update consultation notes (doctor only)
  async updateConsultation(consultationId: string, userId: string, data: UpdateConsultation): Promise<ConsultationWithDetails> {
    const doctorId = await resolveDoctorId(userId);
    const consultation = await db
      .select()
      .from(consultations)
      .where(eq(consultations.consultationId, consultationId))
      .limit(1);

    if (!consultation[0]) {
      throw new NotFoundError('Consultation');
    }

    if (consultation[0].doctorId !== doctorId) {
      throw new ValidationError('You can only update your own consultations');
    }

    await db
      .update(consultations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(consultations.consultationId, consultationId));

    return this.getConsultation(consultationId);
  }

  // Get patient consultation history
  async getPatientConsultationHistory(patientId: string, filters: Pick<PatientConsultationHistory, 'page' | 'limit' | 'includeNotes'>) {
    return this.listConsultations({
      patientId,
      page: filters.page,
      limit: filters.limit,
    });
  }

  // Get doctor's consultations
  async getDoctorConsultations(doctorId: string, filters: Pick<DoctorConsultationSummary, 'startDate' | 'endDate' | 'page' | 'limit'>) {
    return this.listConsultations({
      doctorId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit,
    });
  }

  // Get consultation summary for reports
  async getConsultationSummary(consultationId: string): Promise<ConsultationSummary> {
    const consultation = await this.getConsultation(consultationId);
    
    return {
      consultationId: consultation.consultationId,
      appointmentId: consultation.appointmentId,
      appointmentType: consultation.appointment.appointmentType,
      scheduledDate: consultation.appointment.scheduledDate,
      scheduledTime: consultation.appointment.scheduledTime,
      doctorName: consultation.doctor.user.profile 
        ? `${consultation.doctor.user.profile.firstName} ${consultation.doctor.user.profile.lastName}`
        : 'Unknown Doctor',
      doctorSpecialty: consultation.doctor.specialty,
      notesPreview: consultation.notes.length > 200 
        ? consultation.notes.substring(0, 200) + '...'
        : consultation.notes,
      createdAt: consultation.createdAt,
    };
  }

  // Delete consultation (admin only)
  async deleteConsultation(consultationId: string): Promise<void> {
    const consultation = await db
      .select()
      .from(consultations)
      .where(eq(consultations.consultationId, consultationId))
      .limit(1);

    if (!consultation[0]) {
      throw new NotFoundError('Consultation');
    }

    await db.delete(consultations).where(eq(consultations.consultationId, consultationId));
  }
}
