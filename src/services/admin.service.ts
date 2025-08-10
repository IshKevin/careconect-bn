import { db } from '../config/database';
import { users } from '../db/schemas/users';
import { appointments } from '../db/schemas/appointments';
import { invoices } from '../db/schemas/invoices';
import { sql, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from './user.service';

const userService = new UserService();

export const listUsers = async (query: any) => {
    const filters = {
        userType: query.userType,
        accountStatus: query.accountStatus,
        search: query.search,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        page: query.page ? parseInt(String(query.page), 10) : 1,
        limit: query.limit ? parseInt(String(query.limit), 10) : 10,
    } as any;
    return userService.searchUsers(filters);
};

export const getUser = async (userId: string) => {
    return userService.getUserProfile(userId);
};

export const updateUser = async (userId: string, data: any) => {
    return userService.updateUserProfile(userId, data);
};

export const updateUserStatus = async (userId: string, status: string) => {
    const allowed = ['active', 'inactive', 'suspended', 'pending_verification'];
    if (!allowed.includes(status)) {
        throw new Error('Invalid status');
    }
    return userService.updateUserStatus(userId, { accountStatus: status as any });
};

export const deleteUser = async (userId: string) => {
    await userService.deleteUser(userId);
};

export const getSystemMetrics = async () => {
    const [totalUsers, totalPatients, totalDoctors, activeUsers, pendingVerification] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userType, 'patient')),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.userType, 'doctor')),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountStatus, 'active')),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountStatus, 'pending_verification')),
    ]);

    const [totalAppointments, completedAppointments, scheduledAppointments] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(appointments),
        db
            .select({ count: sql<number>`count(*)` })
            .from(appointments)
            .where(eq(appointments.appointmentStatus, 'completed')),
        db
            .select({ count: sql<number>`count(*)` })
            .from(appointments)
            .where(eq(appointments.appointmentStatus, 'scheduled')),
    ]);

    const [invoiceTotal, invoicePaid, invoicePending] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(invoices),
        db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.invoiceStatus, 'paid')),
        db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.invoiceStatus, 'pending')),
    ]);

    return {
        users: {
            total: totalUsers[0].count,
            patients: totalPatients[0].count,
            doctors: totalDoctors[0].count,
            active: activeUsers[0].count,
            pendingVerification: pendingVerification[0].count,
            inactive: totalUsers[0].count - activeUsers[0].count,
        },
        appointments: {
            total: totalAppointments[0].count,
            completed: completedAppointments[0].count,
            scheduled: scheduledAppointments[0].count,
        },
        invoices: {
            total: invoiceTotal[0].count,
            paid: invoicePaid[0].count,
            pending: invoicePending[0].count,
        },
        generatedAt: new Date().toISOString(),
    };
};

// No persistent settings store available; echo back payload for now
export const updateSystemSettings = async (settings: any) => {
    return { updated: true, settings, updatedAt: new Date().toISOString() };
};

// No audit table present; return empty list with pagination
export const getAuditLogs = async (_query: any) => {
    return { logs: [], pagination: { page: 1, limit: 10, count: 0 } };
};

export const triggerReportGeneration = async (_payload: any) => {
    return { jobId: uuidv4(), status: 'queued', queuedAt: new Date().toISOString() };
};