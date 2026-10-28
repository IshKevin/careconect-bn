import { and, asc, desc, eq, gte, lte, like, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import {
    users,
    userProfiles,
    doctors,
    appointments,
    invoices,
} from '../db/schemas';

type Pagination = { page?: number; limit?: number };

// Search doctors by specialty, name, license, active status
export const searchDoctors = async (
    _user: any,
    query: {
        specialty?: string;
        search?: string; // name or license or email
        isActive?: boolean;
        minFee?: number;
        maxFee?: number;
        page?: number;
        limit?: number;
    }
) => {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.specialty) {
        conditions.push(eq(doctors.specialty, query.specialty));
    }
    if (typeof query.isActive === 'boolean') {
        conditions.push(eq(doctors.isActive, query.isActive));
    }
    if (typeof query.minFee === 'number') {
        conditions.push(sql`${doctors.consultationFee} >= ${query.minFee}`);
    }
    if (typeof query.maxFee === 'number') {
        conditions.push(sql`${doctors.consultationFee} <= ${query.maxFee}`);
    }
    if (query.search) {
        const search = `%${query.search}%`;
        conditions.push(
            or(
                like(userProfiles.firstName, search),
                like(userProfiles.lastName, search),
                like(doctors.medicalLicenseNumber, search),
                like(users.email, search)
            )
        );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [rows] = await Promise.all([
        db
            .select({
                doctorId: doctors.doctorId,
                userId: doctors.userId,
                medicalLicenseNumber: doctors.medicalLicenseNumber,
                specialty: doctors.specialty,
                consultationFee: doctors.consultationFee,
                isActive: doctors.isActive,
                firstName: userProfiles.firstName,
                lastName: userProfiles.lastName,
                email: users.email,
            })
            .from(doctors)
            .leftJoin(users, eq(doctors.userId, users.userId))
            .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
            .where(whereClause as any)
            .orderBy(asc(userProfiles.firstName))
            .limit(limit)
            .offset(offset),
    ]);

    return {
        doctors: rows,
        pagination: { page, limit, count: rows.length },
    };
};

// Search appointments by patient/doctor, status, type, date range
export const searchAppointments = async (
    user: { userId: string; userType: string },
    query: {
        patientId?: string;
        doctorId?: string;
        appointmentStatus?: string;
        appointmentType?: string;
        startDate?: string;
        endDate?: string;
        search?: string; // doctor's name or patient name
    } & Pagination
) => {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.patientId) conditions.push(eq(appointments.patientId, query.patientId));
    if (query.doctorId) conditions.push(eq(appointments.doctorId, query.doctorId));
    if (query.appointmentStatus) conditions.push(eq(appointments.appointmentStatus, query.appointmentStatus as any));
    if (query.appointmentType) conditions.push(eq(appointments.appointmentType, query.appointmentType as any));
    if (query.startDate) conditions.push(gte(appointments.scheduledDate, query.startDate));
    if (query.endDate) conditions.push(lte(appointments.scheduledDate, query.endDate));

    if (query.search) {
        const search = `%${query.search}%`;
        conditions.push(
            or(
                like(userProfiles.firstName, search),
                like(userProfiles.lastName, search)
            )
        );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
        .select({
            appointmentId: appointments.appointmentId,
            patientId: appointments.patientId,
            doctorId: appointments.doctorId,
            appointmentType: appointments.appointmentType,
            appointmentStatus: appointments.appointmentStatus,
            scheduledDate: appointments.scheduledDate,
            scheduledTime: appointments.scheduledTime,
            consultationFee: appointments.consultationFee,
            patientFirstName: userProfiles.firstName,
            patientLastName: userProfiles.lastName,
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.patientId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(whereClause as any)
        .orderBy(desc(appointments.scheduledDate), desc(appointments.scheduledTime))
        .limit(limit)
        .offset(offset);

    // Access control: patients only see their own; doctors only their own
    let doctorIdForUser: string | null = null;
    if (user.userType === 'doctor') {
        const mapping = await db
            .select({ doctorId: doctors.doctorId })
            .from(doctors)
            .where(eq(doctors.userId, user.userId))
            .limit(1);
        doctorIdForUser = mapping[0]?.doctorId ?? null;
    }

    const filtered = rows.filter((row) => {
        if (user.userType === 'patient') return row.patientId === user.userId;
        if (user.userType === 'doctor') return !!doctorIdForUser && row.doctorId === doctorIdForUser;
        return true;
    });

    return {
        appointments: filtered,
        pagination: { page, limit, count: filtered.length },
    };
};

// Search invoices by number, status, user, date/amount ranges
export const searchInvoices = async (
    user: { userId: string; userType: string },
    query: {
        invoiceNumber?: string;
        invoiceStatus?: 'pending' | 'paid' | 'cancelled';
        patientId?: string;
        doctorId?: string;
        startDate?: string;
        endDate?: string;
        minAmount?: number;
        maxAmount?: number;
    } & Pagination
) => {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.invoiceNumber) conditions.push(like(invoices.invoiceNumber, `%${query.invoiceNumber}%`));
    if (query.invoiceStatus) conditions.push(eq(invoices.invoiceStatus, query.invoiceStatus));
    if (query.patientId) conditions.push(eq(invoices.patientId, query.patientId));
    if (query.doctorId) conditions.push(eq(invoices.doctorId, query.doctorId));
    if (query.startDate) conditions.push(gte(invoices.invoiceDate, query.startDate));
    if (query.endDate) conditions.push(lte(invoices.invoiceDate, query.endDate));
    if (typeof query.minAmount === 'number') conditions.push(sql`${invoices.totalAmount} >= ${query.minAmount}`);
    if (typeof query.maxAmount === 'number') conditions.push(sql`${invoices.totalAmount} <= ${query.maxAmount}`);

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
        .select({
            invoiceId: invoices.invoiceId,
            invoiceNumber: invoices.invoiceNumber,
            patientId: invoices.patientId,
            doctorId: invoices.doctorId,
            totalAmount: invoices.totalAmount,
            invoiceStatus: invoices.invoiceStatus,
            invoiceDate: invoices.invoiceDate,
            paidAt: invoices.paidAt,
        })
        .from(invoices)
        .where(whereClause as any)
        .orderBy(desc(invoices.invoiceDate))
        .limit(limit)
        .offset(offset);

    // Access control: patients see own; doctors see own; admins see all
    let doctorIdForUser: string | null = null;
    if (user.userType === 'doctor') {
        const mapping = await db
            .select({ doctorId: doctors.doctorId })
            .from(doctors)
            .where(eq(doctors.userId, user.userId))
            .limit(1);
        doctorIdForUser = mapping[0]?.doctorId ?? null;
    }

    const filtered = rows.filter((row) => {
        if (user.userType === 'patient') return row.patientId === user.userId;
        if (user.userType === 'doctor') return !!doctorIdForUser && row.doctorId === doctorIdForUser;
        return true;
    });

    return {
        invoices: filtered,
        pagination: { page, limit, count: filtered.length },
    };
};
// ─── Global search, suggestions, history ────────────────────────────────────

export interface SearchRequester {
    userId: string;
    userType: string;
}

const pattern = (term: string) => `%${term.replace(/[%_]/g, (c) => `\\${c}`)}%`;

/** Doctors by name or specialty, and invoices by number. Patients see only their own invoices. */
export const globalSearch = async (term: string, requester: SearchRequester) => {
    const like_ = pattern(term);

    const matchedDoctors = await db
        .select({
            doctorId: doctors.doctorId,
            specialty: doctors.specialty,
            consultationFee: doctors.consultationFee,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
        })
        .from(doctors)
        .innerJoin(users, eq(users.userId, doctors.userId))
        .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
        .where(
            and(
                eq(doctors.isActive, true),
                or(
                    like(doctors.specialty, like_),
                    like(userProfiles.firstName, like_),
                    like(userProfiles.lastName, like_),
                ),
            ),
        )
        .limit(5);

    const invoiceFilter =
        requester.userType === 'patient'
            ? and(like(invoices.invoiceNumber, like_), eq(invoices.patientId, requester.userId))
            : like(invoices.invoiceNumber, like_);

    const matchedInvoices = await db
        .select({
            invoiceId: invoices.invoiceId,
            invoiceNumber: invoices.invoiceNumber,
            totalAmount: invoices.totalAmount,
            invoiceStatus: invoices.invoiceStatus,
        })
        .from(invoices)
        .where(invoiceFilter)
        .limit(5);

    return { doctors: matchedDoctors, invoices: matchedInvoices };
};

/** Short list of specialties and doctor names that start with or contain the term. */
export const getSearchSuggestions = async (term: string) => {
    const like_ = pattern(term);

    const specialties = await db
        .selectDistinct({ specialty: doctors.specialty })
        .from(doctors)
        .where(and(eq(doctors.isActive, true), like(doctors.specialty, like_)))
        .limit(5);

    const names = await db
        .select({ firstName: userProfiles.firstName, lastName: userProfiles.lastName })
        .from(doctors)
        .innerJoin(users, eq(users.userId, doctors.userId))
        .innerJoin(userProfiles, eq(userProfiles.userId, users.userId))
        .where(and(eq(doctors.isActive, true), or(like(userProfiles.firstName, like_), like(userProfiles.lastName, like_))))
        .limit(5);

    return {
        specialties: specialties.map((row) => row.specialty),
        doctors: names.map((row) => `Dr. ${row.firstName} ${row.lastName}`),
    };
};
