import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { doctors, facilities, invoices, refunds } from '../db/schemas';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

export interface FacilityInput {
  name: string;
  facilityType: 'hospital' | 'clinic' | 'private_practice' | 'health_center';
  registrationNumber: string;
  district?: string;
  contactEmail?: string;
  contactPhone?: string;
  settlementAccountRef?: string;
}

export const listFacilities = async () => {
  const rows = await db.select().from(facilities).orderBy(facilities.name);
  const counts = await db
    .select({ facilityId: doctors.facilityId, doctorCount: sql<number>`count(*)::int` })
    .from(doctors)
    .groupBy(doctors.facilityId);
  const byFacility = new Map(counts.map((c) => [c.facilityId, c.doctorCount]));
  return rows.map((row) => ({ ...row, doctorCount: byFacility.get(row.facilityId) ?? 0 }));
};

const uniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';

export const createFacility = async (input: FacilityInput) => {
  try {
    const [created] = await db.insert(facilities).values(input).returning();
    return created;
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError('A facility with this registration number already exists');
    throw error;
  }
};

export const updateFacility = async (
  facilityId: string,
  input: Partial<FacilityInput> & { verificationStatus?: 'pending' | 'verified' | 'rejected' | 'suspended' },
) => {
  const [updated] = await db
    .update(facilities)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(facilities.facilityId, facilityId))
    .returning();
  if (!updated) throw new NotFoundError('Facility');
  return updated;
};

// Only verified facilities can receive doctors, so settlement always goes to an approved provider.
export const assignDoctorToFacility = async (doctorId: string, facilityId: string | null) => {
  if (facilityId) {
    const [facility] = await db.select().from(facilities).where(eq(facilities.facilityId, facilityId)).limit(1);
    if (!facility) throw new NotFoundError('Facility');
    if (facility.verificationStatus !== 'verified') {
      throw new ValidationError('Only a verified facility can be assigned doctors');
    }
  }
  const [doctor] = await db
    .update(doctors)
    .set({ facilityId, updatedAt: new Date() })
    .where(eq(doctors.doctorId, doctorId))
    .returning({ doctorId: doctors.doctorId, facilityId: doctors.facilityId });
  if (!doctor) throw new NotFoundError('Doctor');
  return doctor;
};

// Gross paid invoices for the facility's doctors, minus processed refunds. Money in, money out.
export const facilitySettlement = async (facilityId: string) => {
  const [facility] = await db.select().from(facilities).where(eq(facilities.facilityId, facilityId)).limit(1);
  if (!facility) throw new NotFoundError('Facility');

  const doctorRows = await db
    .select({ doctorId: doctors.doctorId })
    .from(doctors)
    .where(eq(doctors.facilityId, facilityId));
  const doctorIds = doctorRows.map((d) => d.doctorId);

  const empty = { facility, invoicedCount: 0, paidGross: '0.00', refunded: '0.00', netSettlable: '0.00', pendingInvoices: '0.00', byDoctor: [] as unknown[] };
  if (doctorIds.length === 0) return empty;

  const invoiceRows = await db
    .select({
      doctorId: invoices.doctorId,
      invoiceId: invoices.invoiceId,
      status: invoices.invoiceStatus,
      total: invoices.totalAmount,
    })
    .from(invoices)
    .where(inArray(invoices.doctorId, doctorIds));

  const refundRows = await db
    .select({ invoiceId: refunds.invoiceId, amount: refunds.amount })
    .from(refunds)
    .where(eq(refunds.status, 'processed'));
  const refundedByInvoice = new Map<string, number>();
  for (const r of refundRows) {
    refundedByInvoice.set(r.invoiceId, (refundedByInvoice.get(r.invoiceId) ?? 0) + Number(r.amount));
  }

  const toCents = (n: number) => Math.round(n * 100);
  let paidGross = 0;
  let refunded = 0;
  let pending = 0;
  const perDoctor = new Map<string, { doctorId: string; paidGross: number; refunded: number }>();
  for (const inv of invoiceRows) {
    const total = Number(inv.total);
    const entry = perDoctor.get(inv.doctorId) ?? { doctorId: inv.doctorId, paidGross: 0, refunded: 0 };
    if (inv.status === 'paid' || inv.status === 'refunded') {
      paidGross += total;
      entry.paidGross += total;
      const r = refundedByInvoice.get(inv.invoiceId) ?? 0;
      refunded += r;
      entry.refunded += r;
    }
    if (inv.status === 'pending') pending += total;
    perDoctor.set(inv.doctorId, entry);
  }

  const money = (cents: number) => (cents / 100).toFixed(2);
  return {
    facility,
    invoicedCount: invoiceRows.length,
    paidGross: money(toCents(paidGross)),
    refunded: money(toCents(refunded)),
    netSettlable: money(toCents(paidGross) - toCents(refunded)),
    pendingInvoices: money(toCents(pending)),
    byDoctor: [...perDoctor.values()].map((d) => ({
      doctorId: d.doctorId,
      paidGross: money(toCents(d.paidGross)),
      refunded: money(toCents(d.refunded)),
      net: money(toCents(d.paidGross) - toCents(d.refunded)),
    })),
  };
};
