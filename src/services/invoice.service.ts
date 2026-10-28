import { eq, and, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors, consultations, appointments, invoices } from '../db/schemas';
import {
  InvoiceFilters,
  UpdateInvoice,
  CreateInvoiceRequest,
  InvoiceWithDetails,
  UpdateInvoiceStatusRequest,
  InvoiceSummary,
  MarkInvoiceAsPaid,
  GenerateInvoice,
  OverDueInvoices,
} from '../db/schemas/invoices';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class InvoiceService {
  // Generate invoice number
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `INV-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
  }

  // Create invoice from consultation
  async createInvoice(data: GenerateInvoice, requester?: { userId: string; userType: string }): Promise<InvoiceWithDetails> {
    const { consultationId, customAmount, additionalCharges, notes } = data;

    // Verify consultation exists
    const consultation = await db
      .select({
        consultationId: consultations.consultationId,
        patientId: consultations.patientId,
        doctorId: consultations.doctorId,
        appointmentId: consultations.appointmentId,
      })
      .from(consultations)
      .leftJoin(appointments, eq(consultations.appointmentId, appointments.appointmentId))
      .where(eq(consultations.consultationId, consultationId))
      .limit(1);

    if (!consultation[0]) {
      throw new NotFoundError('Consultation');
    }

    if (requester?.userType === 'doctor') {
      const [self] = await db.select({ doctorId: doctors.doctorId }).from(doctors).where(eq(doctors.userId, requester.userId)).limit(1);
      if (!self || self.doctorId !== consultation[0].doctorId) {
        throw new AuthorizationError('You can only invoice your own consultations');
      }
    }

    // Check if invoice already exists for this consultation
    const existingInvoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.consultationId, consultationId))
      .limit(1);

    if (existingInvoice[0]) {
      throw new ConflictError('Invoice already exists for this consultation');
    }

    // Get doctor's consultation fee
    const doctor = await db
      .select({ consultationFee: doctors.consultationFee })
      .from(doctors)
      .where(eq(doctors.doctorId, consultation[0].doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Calculate total amount
    let totalAmount = customAmount || parseFloat(doctor[0].consultationFee);
    
    if (additionalCharges) {
      const additionalTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      totalAmount += additionalTotal;
    }

    // Create invoice
    const invoiceId = uuidv4();
    const invoiceNumber = this.generateInvoiceNumber();
    
    await db.insert(invoices).values({
      invoiceId,
      consultationId,
      patientId: consultation[0].patientId,
      doctorId: consultation[0].doctorId,
      invoiceNumber,
      totalAmount: totalAmount.toFixed(2),
      invoiceStatus: 'pending',
      invoiceDate: new Date().toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.getInvoice(invoiceId);
  }

  // List invoices with filters
  async listInvoices(filters: InvoiceFilters) {
    const {
      patientId,
      doctorId,
      invoiceStatus,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
    } = filters;

    const baseQuery = db
      .select({
        invoiceId: invoices.invoiceId,
        consultationId: invoices.consultationId,
        patientId: invoices.patientId,
        doctorId: invoices.doctorId,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
        invoiceStatus: invoices.invoiceStatus,
        invoiceDate: invoices.invoiceDate,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
        // Consultation info
        consultationNotes: consultations.notes,
        appointmentId: consultations.appointmentId,
      })
      .from(invoices)
      .leftJoin(consultations, eq(invoices.consultationId, consultations.consultationId))
      .leftJoin(appointments, eq(consultations.appointmentId, appointments.appointmentId))
      .leftJoin(users, eq(invoices.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(invoices.doctorId, doctors.doctorId));

    // Build conditions
    const conditions: any[] = [];

    if (patientId) {
      conditions.push(eq(invoices.patientId, patientId));
    }

    if (doctorId) {
      conditions.push(eq(invoices.doctorId, doctorId));
    }

    if (invoiceStatus) {
      conditions.push(eq(invoices.invoiceStatus, invoiceStatus));
    }

    if (startDate) {
      conditions.push(sql`${invoices.invoiceDate} >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`${invoices.invoiceDate} <= ${endDate}`);
    }

    if (minAmount) {
      conditions.push(sql`CAST(${invoices.totalAmount} AS DECIMAL) >= ${minAmount}`);
    }

    if (maxAmount) {
      conditions.push(sql`CAST(${invoices.totalAmount} AS DECIMAL) <= ${maxAmount}`);
    }

    // Apply filters and execute query
    const offset = (page - 1) * limit;
    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).limit(limit).offset(offset).orderBy(invoices.createdAt)
      : await baseQuery.limit(limit).offset(offset).orderBy(invoices.createdAt);

    // Get total count
    const countQueryBase = db.select({ count: sql<number>`count(*)` }).from(invoices);
    const totalResult = conditions.length > 0
      ? await countQueryBase.where(and(...conditions))
      : await countQueryBase;
    const total = totalResult[0].count;

    return {
      invoices: results.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        consultationId: invoice.consultationId,
        patientId: invoice.patientId,
        doctorId: invoice.doctorId,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        invoiceStatus: invoice.invoiceStatus,
        invoiceDate: invoice.invoiceDate,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        consultation: {
          appointmentId: invoice.appointmentId,
          notes: invoice.consultationNotes,
          appointment: {
            appointmentType: 'consultation' as const,
            scheduledDate: '',
            scheduledTime: '',
          },
        },
        patient: {
          email: invoice.patientEmail,
          phoneNumber: invoice.patientPhone,
          profile: invoice.patientFirstName
            ? {
                firstName: invoice.patientFirstName,
                lastName: invoice.patientLastName,
              }
            : undefined,
        },
        doctor: {
          specialty: invoice.doctorSpecialty,
          consultationFee: invoice.doctorConsultationFee,
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

  // Get invoice by ID with full details
  async getInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
    const result = await db
      .select({
        invoiceId: invoices.invoiceId,
        consultationId: invoices.consultationId,
        patientId: invoices.patientId,
        doctorId: invoices.doctorId,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
        invoiceStatus: invoices.invoiceStatus,
        invoiceDate: invoices.invoiceDate,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        // Patient info
        patientEmail: users.email,
        patientPhone: users.phoneNumber,
        patientFirstName: userProfiles.firstName,
        patientLastName: userProfiles.lastName,
        // Doctor info
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
        // Consultation info
        consultationNotes: consultations.notes,
        appointmentId: consultations.appointmentId,
      })
      .from(invoices)
      .leftJoin(consultations, eq(invoices.consultationId, consultations.consultationId))
      .leftJoin(users, eq(invoices.patientId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(doctors, eq(invoices.doctorId, doctors.doctorId))
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError('Invoice');
    }

    const invoice = result[0];
    return {
      invoiceId: invoice.invoiceId,
      consultationId: invoice.consultationId,
      patientId: invoice.patientId,
      doctorId: invoice.doctorId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      invoiceStatus: invoice.invoiceStatus,
      invoiceDate: invoice.invoiceDate,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      consultation: {
        appointmentId: invoice.appointmentId,
        notes: invoice.consultationNotes,
        appointment: {
          appointmentType: 'consultation' as const,
          scheduledDate: '',
          scheduledTime: '',
        },
      },
      patient: {
        email: invoice.patientEmail,
        phoneNumber: invoice.patientPhone,
        profile: invoice.patientFirstName
          ? {
              firstName: invoice.patientFirstName,
              lastName: invoice.patientLastName,
            }
          : undefined,
      },
      doctor: {
        specialty: invoice.doctorSpecialty,
        consultationFee: invoice.doctorConsultationFee,
        user: {
          email: '',
          profile: undefined,
        },
      },
    };
  }

  // Update invoice details
  async updateInvoice(invoiceId: string, data: UpdateInvoice): Promise<InvoiceWithDetails> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      throw new NotFoundError('Invoice');
    }

    if (invoice[0].invoiceStatus === 'paid') {
      throw new ValidationError('Cannot update a paid invoice');
    }

    await db
      .update(invoices)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(invoices.invoiceId, invoiceId));

    return this.getInvoice(invoiceId);
  }

  // Update invoice status
  async updateInvoiceStatus(invoiceId: string, data: UpdateInvoiceStatusRequest): Promise<InvoiceWithDetails> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      throw new NotFoundError('Invoice');
    }

    await db
      .update(invoices)
      .set({
        invoiceStatus: data.invoiceStatus,
        paidAt: data.paidAt || (data.invoiceStatus === 'paid' ? new Date() : null),
        updatedAt: new Date(),
      })
      .where(eq(invoices.invoiceId, invoiceId));

    return this.getInvoice(invoiceId);
  }

  // Mark invoice as paid
  async markInvoiceAsPaid(invoiceId: string, data: MarkInvoiceAsPaid): Promise<InvoiceWithDetails> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      throw new NotFoundError('Invoice');
    }

    if (invoice[0].invoiceStatus === 'paid') {
      throw new ValidationError('Invoice is already paid');
    }

    if (invoice[0].invoiceStatus === 'cancelled') {
      throw new ValidationError('Cannot pay a cancelled invoice');
    }

    await db
      .update(invoices)
      .set({
        invoiceStatus: 'paid',
        paidAt: data.paidAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.invoiceId, invoiceId));

    return this.getInvoice(invoiceId);
  }

  // Cancel invoice
  async cancelInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      throw new NotFoundError('Invoice');
    }

    if (invoice[0].invoiceStatus === 'paid') {
      throw new ValidationError('Cannot cancel a paid invoice');
    }

    await db
      .update(invoices)
      .set({
        invoiceStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(invoices.invoiceId, invoiceId));

    return this.getInvoice(invoiceId);
  }

  // Get patient invoices
  async getPatientInvoices(patientId: string, filters: Pick<InvoiceFilters, 'invoiceStatus' | 'startDate' | 'endDate' | 'page' | 'limit'>) {
    return this.listInvoices({
      ...filters,
      patientId,
    });
  }

  // Get doctor invoices
  async getDoctorInvoices(doctorId: string, filters: Pick<InvoiceFilters, 'invoiceStatus' | 'startDate' | 'endDate' | 'page' | 'limit'>) {
    return this.listInvoices({
      ...filters,
      doctorId,
    });
  }

  // Get overdue invoices
  async getOverdueInvoices(filters: OverDueInvoices) {
    const { daysOverdue = 30, page = 1, limit = 10 } = filters;
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);
    
    return this.listInvoices({
      invoiceStatus: 'pending',
      endDate: overdueDate.toISOString().split('T')[0],
      page,
      limit,
    });
  }

  // Get invoice summary for reports
  async getInvoiceSummary(invoiceId: string): Promise<InvoiceSummary> {
    const invoiceData = await this.getInvoice(invoiceId);
    
    return {
      invoiceId: invoiceData.invoiceId,
      invoiceNumber: invoiceData.invoiceNumber,
      patientName: invoiceData.patient.profile 
        ? `${invoiceData.patient.profile.firstName} ${invoiceData.patient.profile.lastName}`
        : 'Unknown Patient',
      doctorName: invoiceData.doctor.user.profile
        ? `${invoiceData.doctor.user.profile.firstName} ${invoiceData.doctor.user.profile.lastName}`
        : 'Unknown Doctor',
      totalAmount: invoiceData.totalAmount,
      invoiceStatus: invoiceData.invoiceStatus,
      invoiceDate: invoiceData.invoiceDate,
      paidAt: invoiceData.paidAt,
    };
  }

  // Delete invoice (admin only)
  async deleteInvoice(invoiceId: string): Promise<void> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceId, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      throw new NotFoundError('Invoice');
    }

    if (invoice[0].invoiceStatus === 'paid') {
      throw new ValidationError('Cannot delete a paid invoice');
    }

    await db.delete(invoices).where(eq(invoices.invoiceId, invoiceId));
  }
}
