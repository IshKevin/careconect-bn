import { and, count, countDistinct, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '../config/database';
import {
  appointments,
  consultations,
  doctors,
  facilities,
  invoices,
  paymentTransactions,
  refunds,
  sponsorLinks,
  userProfiles,
  users,
} from '../db/schemas';
import { getRefundTotals, listRefunds } from './refund.service';
import { listReconciliationRuns } from './reconciliation.service';

// Dashboards use Rwanda local dates. Money is summed in cents to avoid float drift.
const KIGALI = 'Africa/Kigali';
const toCents = (amount: string | number | null) => Math.round(Number(amount ?? 0) * 100);
const money = (cents: number) => (cents / 100).toFixed(2);
const kigaliDate = (offsetDays = 0) => {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: KIGALI, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};

const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userProfiles.userId, firstName: userProfiles.firstName, lastName: userProfiles.lastName })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, userIds));
  return new Map(rows.map((r) => [r.userId, `${r.firstName} ${r.lastName}`.trim()]));
};

// ---------- Sponsor ----------
export const sponsorDashboard = async (sponsorUserId: string) => {
  const links = await db
    .select({
      linkId: sponsorLinks.linkId,
      patientUserId: sponsorLinks.patientUserId,
      relationship: sponsorLinks.relationship,
      status: sponsorLinks.status,
      medicalAccessGranted: sponsorLinks.medicalAccessGranted,
      requestedAt: sponsorLinks.requestedAt,
    })
    .from(sponsorLinks)
    .where(eq(sponsorLinks.sponsorUserId, sponsorUserId));

  const activeLinks = links.filter((l) => l.status === 'active');
  const activeIds = activeLinks.map((l) => l.patientUserId);
  const names = await namesFor(links.map((l) => l.patientUserId));
  const today = kigaliDate();

  const invoiceRows = activeIds.length
    ? await db
        .select({
          invoiceId: invoices.invoiceId,
          invoiceNumber: invoices.invoiceNumber,
          patientId: invoices.patientId,
          totalAmount: invoices.totalAmount,
          invoiceStatus: invoices.invoiceStatus,
          invoiceDate: invoices.invoiceDate,
          paidAt: invoices.paidAt,
        })
        .from(invoices)
        .where(inArray(invoices.patientId, activeIds))
        .orderBy(sql`${invoices.invoiceDate} desc`)
        .limit(50)
    : [];

  const upcoming = activeIds.length
    ? await db
        .select({
          appointmentId: appointments.appointmentId,
          patientId: appointments.patientId,
          doctorId: appointments.doctorId,
          scheduledDate: appointments.scheduledDate,
          scheduledTime: appointments.scheduledTime,
          appointmentType: appointments.appointmentType,
          appointmentStatus: appointments.appointmentStatus,
          consultationFee: appointments.consultationFee,
        })
        .from(appointments)
        .where(
          and(
            inArray(appointments.patientId, activeIds),
            gte(appointments.scheduledDate, today),
            inArray(appointments.appointmentStatus, ['scheduled', 'confirmed']),
          ),
        )
        .orderBy(appointments.scheduledDate, appointments.scheduledTime)
        .limit(10)
    : [];

  const doctorUserIds = await doctorUserIdsFor(upcoming.map((a) => a.doctorId));
  const doctorNames = await namesFor(doctorUserIds.map((d) => d.userId));
  const doctorNameById = new Map(doctorUserIds.map((d) => [d.doctorId, doctorNames.get(d.userId) ?? 'Doctor']));

  const payments = activeIds.length
    ? await db
        .select({
          txRef: paymentTransactions.txRef,
          patientId: paymentTransactions.patientId,
          invoiceId: paymentTransactions.invoiceId,
          amount: paymentTransactions.amount,
          currency: paymentTransactions.currency,
          completedAt: paymentTransactions.completedAt,
        })
        .from(paymentTransactions)
        .where(and(inArray(paymentTransactions.patientId, activeIds), eq(paymentTransactions.status, 'completed')))
        .orderBy(sql`${paymentTransactions.completedAt} desc nulls last`)
        .limit(10)
    : [];

  let pendingCents = 0;
  let paidCents = 0;
  let pendingCount = 0;
  let paidCount = 0;
  for (const inv of invoiceRows) {
    if (inv.invoiceStatus === 'pending') {
      pendingCents += toCents(inv.totalAmount);
      pendingCount += 1;
    } else if (inv.invoiceStatus === 'paid' || inv.invoiceStatus === 'refunded') {
      paidCents += toCents(inv.totalAmount);
      paidCount += 1;
    }
  }

  return {
    linkedPatients: links
      .filter((l) => l.status === 'active')
      .map((l) => ({
        linkId: l.linkId,
        patientUserId: l.patientUserId,
        name: names.get(l.patientUserId) ?? 'Patient',
        relationship: l.relationship,
        medicalAccessGranted: l.medicalAccessGranted,
      })),
    pendingRequests: links
      .filter((l) => l.status === 'pending')
      .map((l) => ({ linkId: l.linkId, patientName: names.get(l.patientUserId) ?? 'Patient', requestedAt: l.requestedAt })),
    invoices: {
      summary: { pendingCount, pendingAmount: money(pendingCents), paidCount, paidAmount: money(paidCents) },
      recent: invoiceRows.slice(0, 10).map((inv) => ({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        patientName: names.get(inv.patientId) ?? 'Patient',
        totalAmount: inv.totalAmount,
        invoiceStatus: inv.invoiceStatus,
        invoiceDate: inv.invoiceDate,
      })),
    },
    upcomingAppointments: upcoming.map((a) => ({
      appointmentId: a.appointmentId,
      patientName: names.get(a.patientId) ?? 'Patient',
      doctorName: doctorNameById.get(a.doctorId) ?? 'Doctor',
      scheduledDate: a.scheduledDate,
      scheduledTime: a.scheduledTime,
      appointmentType: a.appointmentType,
      appointmentStatus: a.appointmentStatus,
      consultationFee: a.consultationFee,
    })),
    recentPayments: payments.map((p) => ({
      txRef: p.txRef,
      patientName: names.get(p.patientId) ?? 'Patient',
      invoiceId: p.invoiceId,
      amount: p.amount,
      currency: p.currency,
      completedAt: p.completedAt,
    })),
  };
};

const doctorUserIdsFor = async (doctorIds: string[]) => {
  if (doctorIds.length === 0) return [] as { doctorId: string; userId: string }[];
  return db
    .select({ doctorId: doctors.doctorId, userId: doctors.userId })
    .from(doctors)
    .where(inArray(doctors.doctorId, doctorIds));
};

// ---------- Provider (doctor, and the facility they belong to) ----------
export const providerDashboard = async (doctorId: string) => {
  const [doctor] = await db
    .select({
      doctorId: doctors.doctorId,
      userId: doctors.userId,
      specialty: doctors.specialty,
      consultationFee: doctors.consultationFee,
      facilityId: doctors.facilityId,
      facilityName: facilities.name,
      facilityStatus: facilities.verificationStatus,
    })
    .from(doctors)
    .leftJoin(facilities, eq(facilities.facilityId, doctors.facilityId))
    .where(eq(doctors.doctorId, doctorId))
    .limit(1);
  if (!doctor) return null;

  const today = kigaliDate();
  const weekEnd = kigaliDate(7);
  const names = await namesFor([doctor.userId]);

  const [appt] = await db
    .select({
      today: sql<number>`count(*) filter (where ${appointments.scheduledDate} = ${today} and ${appointments.appointmentStatus} in ('scheduled','confirmed','in_progress'))::int`,
      nextSevenDays: sql<number>`count(*) filter (where ${appointments.scheduledDate} > ${today} and ${appointments.scheduledDate} <= ${weekEnd} and ${appointments.appointmentStatus} in ('scheduled','confirmed'))::int`,
      completed: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'completed')::int`,
      noShow: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'no_show')::int`,
      cancelled: sql<number>`count(*) filter (where ${appointments.appointmentStatus} = 'cancelled')::int`,
    })
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId));

  const [patientRow] = await db
    .select({ n: countDistinct(appointments.patientId) })
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId));

  const [consultRow] = await db.select({ n: count() }).from(consultations).where(eq(consultations.doctorId, doctorId));

  const invoiceRows = await db
    .select({ status: invoices.invoiceStatus, total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)::text`, n: count() })
    .from(invoices)
    .where(eq(invoices.doctorId, doctorId))
    .groupBy(invoices.invoiceStatus);

  const [refundRow] = await db
    .select({ total: sql<string>`coalesce(sum(${refunds.amount}), 0)::text` })
    .from(refunds)
    .innerJoin(invoices, eq(invoices.invoiceId, refunds.invoiceId))
    .where(and(eq(invoices.doctorId, doctorId), eq(refunds.status, 'processed')));

  const upcoming = await db
    .select({
      appointmentId: appointments.appointmentId,
      patientId: appointments.patientId,
      scheduledDate: appointments.scheduledDate,
      scheduledTime: appointments.scheduledTime,
      appointmentType: appointments.appointmentType,
      appointmentStatus: appointments.appointmentStatus,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        gte(appointments.scheduledDate, today),
        inArray(appointments.appointmentStatus, ['scheduled', 'confirmed', 'in_progress']),
      ),
    )
    .orderBy(appointments.scheduledDate, appointments.scheduledTime)
    .limit(10);
  const patientNames = await namesFor(upcoming.map((a) => a.patientId));

  const invoiceSummary = { pendingCount: 0, pendingAmount: '0.00', paidCount: 0, paidAmount: '0.00', refundedAmount: refundRow?.total ?? '0.00' };
  let pendingCents = 0;
  let paidCents = 0;
  for (const row of invoiceRows) {
    if (row.status === 'pending') {
      invoiceSummary.pendingCount = row.n;
      pendingCents = toCents(row.total);
    } else if (row.status === 'paid' || row.status === 'refunded') {
      invoiceSummary.paidCount += row.n;
      paidCents += toCents(row.total);
    }
  }
  invoiceSummary.pendingAmount = money(pendingCents);
  invoiceSummary.paidAmount = money(paidCents);

  return {
    doctor: {
      doctorId: doctor.doctorId,
      name: names.get(doctor.userId) ?? 'Doctor',
      specialty: doctor.specialty,
      consultationFee: doctor.consultationFee,
      facility: doctor.facilityId
        ? { facilityId: doctor.facilityId, name: doctor.facilityName, verificationStatus: doctor.facilityStatus }
        : null,
    },
    appointments: {
      today: appt?.today ?? 0,
      nextSevenDays: appt?.nextSevenDays ?? 0,
      completed: appt?.completed ?? 0,
      noShow: appt?.noShow ?? 0,
      cancelled: appt?.cancelled ?? 0,
    },
    patients: { total: patientRow?.n ?? 0 },
    consultations: { total: consultRow?.n ?? 0 },
    invoices: invoiceSummary,
    upcomingAppointments: upcoming.map((a) => ({
      appointmentId: a.appointmentId,
      patientName: patientNames.get(a.patientId) ?? 'Patient',
      scheduledDate: a.scheduledDate,
      scheduledTime: a.scheduledTime,
      appointmentType: a.appointmentType,
      appointmentStatus: a.appointmentStatus,
    })),
  };
};

// Used by the doctor stats endpoint (FEAT-01), so it no longer returns mock numbers.
export const doctorStats = async (doctorId: string) => {
  const dash = await providerDashboard(doctorId);
  if (!dash) return null;
  return {
    doctorId,
    totalAppointments: dash.appointments.completed + dash.appointments.noShow + dash.appointments.cancelled + dash.appointments.today + dash.appointments.nextSevenDays,
    completedAppointments: dash.appointments.completed,
    upcomingAppointments: dash.appointments.today + dash.appointments.nextSevenDays,
    totalConsultations: dash.consultations.total,
    totalPatients: dash.patients.total,
    paidRevenue: dash.invoices.paidAmount,
    pendingRevenue: dash.invoices.pendingAmount,
    refundedRevenue: dash.invoices.refundedAmount,
  };
};

// ---------- Admin ----------
export const adminDashboard = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const today = kigaliDate();
  const fourteenDaysAgo = kigaliDate(-13);

  const userRows = await db.select({ userType: users.userType, n: count() }).from(users).groupBy(users.userType);
  const [userExtra] = await db
    .select({
      newLast30Days: sql<number>`count(*) filter (where ${users.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz)::int`,
      unverifiedEmails: sql<number>`count(*) filter (where ${users.emailVerified} is null)::int`,
      suspended: sql<number>`count(*) filter (where ${users.accountStatus} = 'suspended')::int`,
    })
    .from(users);

  const apptRows = await db.select({ status: appointments.appointmentStatus, n: count() }).from(appointments).groupBy(appointments.appointmentStatus);
  const apptDaily = await db
    .select({ date: appointments.scheduledDate, n: count() })
    .from(appointments)
    .where(and(gte(appointments.scheduledDate, fourteenDaysAgo), lte(appointments.scheduledDate, today)))
    .groupBy(appointments.scheduledDate)
    .orderBy(appointments.scheduledDate);

  const invRows = await db
    .select({ status: invoices.invoiceStatus, n: count(), total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)::text` })
    .from(invoices)
    .groupBy(invoices.invoiceStatus);

  const revenueDaily = await db
    .select({
      date: sql<string>`to_char(${invoices.paidAt} at time zone 'Africa/Kigali', 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)::text`,
      n: count(),
    })
    .from(invoices)
    .where(and(inArray(invoices.invoiceStatus, ['paid', 'refunded']), gte(invoices.paidAt, thirtyDaysAgo)))
    .groupBy(sql`to_char(${invoices.paidAt} at time zone 'Africa/Kigali', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${invoices.paidAt} at time zone 'Africa/Kigali', 'YYYY-MM-DD')`);

  const payRows = await db
    .select({ status: paymentTransactions.status, n: count(), total: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text` })
    .from(paymentTransactions)
    .groupBy(paymentTransactions.status);

  const refundRows = await getRefundTotals();
  const pendingRefunds = await listRefunds('pending');

  const linkRows = await db.select({ status: sponsorLinks.status, n: count() }).from(sponsorLinks).groupBy(sponsorLinks.status);
  const sponsorsWithMedical = await db
    .select({ n: count() })
    .from(sponsorLinks)
    .where(and(eq(sponsorLinks.status, 'active'), eq(sponsorLinks.medicalAccessGranted, true)));

  const facilityRows = await db.select({ status: facilities.verificationStatus, n: count() }).from(facilities).groupBy(facilities.verificationStatus);
  const facilitiesToReview = await db
    .select({ facilityId: facilities.facilityId, name: facilities.name, facilityType: facilities.facilityType, createdAt: facilities.createdAt })
    .from(facilities)
    .where(eq(facilities.verificationStatus, 'pending'))
    .orderBy(facilities.createdAt)
    .limit(10);

  const [lastRun] = await listReconciliationRuns(1);

  const toMap = <T extends { n: number }>(rows: (T & { status?: string | null; userType?: string })[], key: 'status' | 'userType') =>
    Object.fromEntries(rows.map((r) => [r[key] ?? 'unknown', r.n]));

  return {
    users: {
      byType: toMap(userRows, 'userType'),
      total: userRows.reduce((sum, r) => sum + r.n, 0),
      ...userExtra,
    },
    appointments: {
      byStatus: toMap(apptRows, 'status'),
      daily: apptDaily.map((d) => ({ date: d.date, count: d.n })),
    },
    invoices: {
      byStatus: Object.fromEntries(invRows.map((r) => [r.status, { count: r.n, amount: money(toCents(r.total)) }])),
      revenueDaily: revenueDaily.map((d) => ({ date: d.date, count: d.n, amount: money(toCents(d.total)) })),
    },
    payments: {
      byStatus: Object.fromEntries(payRows.map((r) => [r.status, { count: r.n, amount: money(toCents(r.total)) }])),
    },
    refunds: {
      byStatus: Object.fromEntries(refundRows.map((r) => [r.status, { count: r.count, amount: money(toCents(r.total)) }])),
      pendingApprovals: pendingRefunds.length,
    },
    sponsorship: {
      byStatus: toMap(linkRows, 'status'),
      activeWithMedicalAccess: sponsorsWithMedical[0]?.n ?? 0,
    },
    facilities: {
      byStatus: toMap(facilityRows, 'status'),
      toReview: facilitiesToReview,
    },
    reconciliation: lastRun
      ? {
          lastRunId: lastRun.runId,
          lastRunAt: lastRun.startedAt,
          status: lastRun.status,
          mismatchCount: lastRun.mismatchCount,
          resolvedCount: lastRun.resolvedCount,
        }
      : null,
  };
};

// Patients a doctor has seen (appointments with this doctor). Contact and name only, no medical data.
// Returned in the same shape as the admin user list, so the frontend lists can reuse it.
export const providerPatients = async (doctorId: string, search?: string) => {
  const rows = await db
    .select({
      patientId: appointments.patientId,
      appointmentCount: count(),
      lastVisit: sql<string>`max(${appointments.scheduledDate})::text`,
    })
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId))
    .groupBy(appointments.patientId);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.patientId);
  const people = await db
    .select({
      userId: users.userId,
      email: users.email,
      phoneNumber: users.phoneNumber,
      accountStatus: users.accountStatus,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
    .where(inArray(users.userId, ids));

  const term = search?.trim().toLowerCase();
  const byId = new Map(rows.map((r) => [r.patientId, r]));
  return people
    .map((p) => {
      const visit = byId.get(p.userId);
      return {
        userId: p.userId,
        email: p.email,
        phoneNumber: p.phoneNumber,
        userType: 'patient' as const,
        accountStatus: p.accountStatus,
        emailVerified: p.emailVerified,
        createdAt: p.createdAt,
        profile: { firstName: p.firstName ?? '', lastName: p.lastName ?? '' },
        appointmentCount: visit?.appointmentCount ?? 0,
        lastVisit: visit?.lastVisit ?? null,
      };
    })
    .filter((p) => !term || `${p.profile.firstName} ${p.profile.lastName} ${p.email}`.toLowerCase().includes(term))
    .sort((a, b) => `${a.profile.firstName} ${a.profile.lastName}`.localeCompare(`${b.profile.firstName} ${b.profile.lastName}`));
};
