import { db } from '../config/database';
import { users } from '../db/schemas/users';
import { appointments } from '../db/schemas/appointments';
import { invoices } from '../db/schemas/invoices';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export const getOverviewMetrics = async () => {
    const [totalUsers, totalAppointments, totalInvoices, paidInvoices, scheduledAppointments, completedAppointments] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(appointments),
        db.select({ count: sql<number>`count(*)` }).from(invoices),
        db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.invoiceStatus, 'paid')),
        db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.appointmentStatus, 'scheduled')),
        db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.appointmentStatus, 'completed')),
    ]);

    const totalRevenue = await db
        .select({ amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text` })
        .from(invoices)
        .where(eq(invoices.invoiceStatus, 'paid'));

    return {
        users: { total: totalUsers[0].count },
        appointments: {
            total: totalAppointments[0].count,
            scheduled: scheduledAppointments[0].count,
            completed: completedAppointments[0].count,
        },
        invoices: {
            total: totalInvoices[0].count,
            paid: paidInvoices[0].count,
            totalRevenue: totalRevenue[0].amount,
        },
        generatedAt: new Date().toISOString(),
    };
};

export const getActivityLogs = async (_query: any) => {
    // No audit table in schema; return empty list with pagination
    return { logs: [], pagination: { page: 1, limit: 10, count: 0 } };
};

type TrendQuery = { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };

export const getAppointmentTrends = async (query: TrendQuery) => {
    const { startDate, endDate } = query;
    const granularity = query.groupBy || 'day';
    const trunc = granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day';

    const conditions = [] as any[];
    if (startDate) conditions.push(gte(appointments.scheduledDate, startDate));
    if (endDate) conditions.push(lte(appointments.scheduledDate, endDate));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
        .select({
            bucket: sql<string>`date_trunc(${sql.raw(`'${trunc}'`)}, ${appointments.scheduledDate}::timestamp)::date::text`,
            count: sql<number>`count(*)`,
            completed: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'completed')`,
            cancelled: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'cancelled')`,
            scheduled: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'scheduled')`,
        })
        .from(appointments)
        .where(whereClause as any)
        .groupBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${appointments.scheduledDate}::timestamp)`)
        .orderBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${appointments.scheduledDate}::timestamp)`);

    return { granularity, trends: rows };
};

type InvoiceSummaryQuery = { startDate?: string; endDate?: string; groupBy?: 'day' | 'month' | 'status' };

export const getInvoiceSummaries = async (query: InvoiceSummaryQuery) => {
    const { startDate, endDate } = query;
    const groupBy = query.groupBy || 'day';

    const conditions = [] as any[];
    if (startDate) conditions.push(gte(invoices.invoiceDate, startDate));
    if (endDate) conditions.push(lte(invoices.invoiceDate, endDate));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    if (groupBy === 'status') {
        const rows = await db
            .select({
                status: invoices.invoiceStatus,
                count: sql<number>`count(*)`,
                totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`,
            })
            .from(invoices)
            .where(whereClause as any)
            .groupBy(invoices.invoiceStatus);
        return { groupBy, summaries: rows };
    }

    const trunc = groupBy === 'month' ? 'month' : 'day';
    const rows = await db
        .select({
            bucket: sql<string>`date_trunc(${sql.raw(`'${trunc}'`)}, ${invoices.invoiceDate}::timestamp)::date::text`,
            count: sql<number>`count(*)`,
            paid: sql<number>`count(*) filter (where ${invoices.invoiceStatus} = 'paid')`,
            pending: sql<number>`count(*) filter (where ${invoices.invoiceStatus} = 'pending')`,
            cancelled: sql<number>`count(*) filter (where ${invoices.invoiceStatus} = 'cancelled')`,
            totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`,
        })
        .from(invoices)
        .where(whereClause as any)
        .groupBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${invoices.invoiceDate}::timestamp)`)
        .orderBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${invoices.invoiceDate}::timestamp)`);

    return { groupBy, summaries: rows };
};

export const getFinancialReports = async (query: { startDate?: string; endDate?: string }) => {
    const conditions = [] as any[];
    if (query.startDate) conditions.push(gte(invoices.invoiceDate, query.startDate));
    if (query.endDate) conditions.push(lte(invoices.invoiceDate, query.endDate));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [totals, paid, pending, cancelled] = await Promise.all([
        db
            .select({ amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`, count: sql<number>`count(*)` })
            .from(invoices)
            .where(whereClause as any),
        db
            .select({ amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`, count: sql<number>`count(*)` })
            .from(invoices)
            .where(and(eq(invoices.invoiceStatus, 'paid'), whereClause || sql`true` as any)),
        db
            .select({ amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`, count: sql<number>`count(*)` })
            .from(invoices)
            .where(and(eq(invoices.invoiceStatus, 'pending'), whereClause || sql`true` as any)),
        db
            .select({ amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)::text`, count: sql<number>`count(*)` })
            .from(invoices)
            .where(and(eq(invoices.invoiceStatus, 'cancelled'), whereClause || sql`true` as any)),
    ]);

    return {
        totals: totals[0],
        paid: paid[0],
        pending: pending[0],
        cancelled: cancelled[0],
        generatedAt: new Date().toISOString(),
    };
};

export const getClinicalReports = async (query: { startDate?: string; endDate?: string }) => {
    const conditions = [] as any[];
    if (query.startDate) conditions.push(gte(appointments.scheduledDate, query.startDate));
    if (query.endDate) conditions.push(lte(appointments.scheduledDate, query.endDate));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
        .select({
            type: appointments.appointmentType,
            count: sql<number>`count(*)`,
            completed: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'completed')`,
            cancelled: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'cancelled')`,
        })
        .from(appointments)
        .where(whereClause as any)
        .groupBy(appointments.appointmentType);

    return { summaries: rows };
};

export const getUserActivityReports = async (query: { startDate?: string; endDate?: string; groupBy?: 'day' | 'month' }) => {
    const granularity = query.groupBy || 'day';
    const trunc = granularity === 'month' ? 'month' : 'day';
    const conditions = [] as any[];
    if (query.startDate) conditions.push(gte(users.createdAt, query.startDate as any));
    if (query.endDate) conditions.push(lte(users.createdAt, query.endDate as any));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
        .select({
            bucket: sql<string>`date_trunc(${sql.raw(`'${trunc}'`)}, ${users.createdAt}::timestamp)::date::text`,
            total: sql<number>`count(*)`,
        })
        .from(users)
        .where(whereClause as any)
        .groupBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${users.createdAt}::timestamp)`)
        .orderBy(sql`date_trunc(${sql.raw(`'${trunc}'`)}, ${users.createdAt}::timestamp)`);

    return { granularity, trends: rows };
};

export const getSystemPerformanceReports = async () => {
    // No infra metrics wired; return static structure
    return {
        status: 'ok',
        uptimeSeconds: process.uptime(),
        generatedAt: new Date().toISOString(),
    };
};

export const generateCustomReport = async (payload: { type: string; filters?: Record<string, any> }) => {
    const reportId = cryptoRandomId();
    let data: any = null;
    switch (payload.type) {
        case 'appointments':
            data = await getAppointmentTrends(payload.filters || {});
            break;
        case 'invoices':
            data = await getInvoiceSummaries(payload.filters || {});
            break;
        case 'financial':
            data = await getFinancialReports(payload.filters || {});
            break;
        case 'users':
            data = await getUserActivityReports(payload.filters || {});
            break;
        default:
            data = { message: 'Unknown report type' };
    }
    return { reportId, type: payload.type, data };
};

export const exportReport = async (_reportId: string) => {
    // Return a stub URL; real implementation would stream a file
    return { url: 'https://example.com/reports/export.pdf', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
};

function cryptoRandomId() {
    // Simple random id generator
    return 'rpt_' + Math.random().toString(36).slice(2, 10);
}