import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../config/database';
import { config } from '../config/env';
import { appointments, consultations, doctorAvailability, doctors, facilities, invoices, patients, sponsorLinks, userProfiles, users } from '../db/schemas';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts';

// Demo accounts for showing the app: an admin, two doctors, a patient and a sponsor, with sample data
// (a verified demo clinic, doctor availability, a past consultation with an unpaid invoice, an upcoming video appointment,
// an active sponsor link). Safe to run more than once: existing accounts and data are kept.
//
//   node dist/db/seed-demo.js             create or re-activate the demo accounts
//   node dist/db/seed-demo.js --disable   suspend them (they can no longer log in); run before real launch
//
// On a production database, creating them is refused unless ALLOW_DEMO_SEED=true or SEED_DEMO_ACCOUNTS=true.
// --disable always works. With SEED_DEMO_ACCOUNTS=true every deploy runs this script automatically.

type Role = 'admin' | 'doctor' | 'patient' | 'sponsor';

const ensureUser = async (
  account: { email: string; phone: string; firstName: string; lastName: string },
  userType: Role,
  passwordHash: string,
): Promise<string> => {
  const [existing] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, account.email)).limit(1);
  if (existing) {
    await db.update(users).set({ accountStatus: 'active', passwordHash, updatedAt: new Date() }).where(eq(users.userId, existing.userId));
    return existing.userId;
  }

  const userId = randomUUID();
  await db.insert(users).values({
    userId,
    email: account.email,
    phoneNumber: account.phone,
    passwordHash,
    userType,
    accountStatus: 'active',
    emailVerified: new Date().toISOString(),
  });
  await db.insert(userProfiles).values({ profileId: randomUUID(), userId, firstName: account.firstName, lastName: account.lastName });
  return userId;
};

const DEMO_FACILITY_REG = 'DEMO-FAC-0001';

const ensureFacility = async (): Promise<string> => {
  const [existing] = await db.select({ facilityId: facilities.facilityId }).from(facilities).where(eq(facilities.registrationNumber, DEMO_FACILITY_REG)).limit(1);
  if (existing) return existing.facilityId;
  const [facility] = await db
    .insert(facilities)
    .values({ name: 'IsanoMed Demo Clinic', facilityType: 'clinic', registrationNumber: DEMO_FACILITY_REG, district: 'Gasabo', verificationStatus: 'verified' })
    .returning();
  return facility.facilityId;
};

const ensureDoctor = async (userId: string, license: string, specialty: string, fee: string, facilityId: string): Promise<string> => {
  const [existing] = await db.select({ doctorId: doctors.doctorId }).from(doctors).where(eq(doctors.userId, userId)).limit(1);
  if (existing) {
    await db.update(doctors).set({ facilityId }).where(eq(doctors.doctorId, existing.doctorId));
    return existing.doctorId;
  }

  const [doctor] = await db.insert(doctors).values({ userId, medicalLicenseNumber: license, specialty, consultationFee: fee, facilityId }).returning();
  // Monday to Friday, 08:00 to 17:00, 30-minute slots.
  await db.insert(doctorAvailability).values(
    [1, 2, 3, 4, 5].map((dayOfWeek) => ({ doctorId: doctor.doctorId, dayOfWeek, startTime: '08:00', endTime: '17:00', slotDuration: 30 })),
  );
  return doctor.doctorId;
};

// Kigali is UTC+2 all year. Returns the local date (YYYY-MM-DD) a number of days from today.
const kigaliDate = (daysFromToday: number): string =>
  new Date(Date.now() + daysFromToday * 86_400_000).toLocaleDateString('sv-SE', { timeZone: config.rwanda.timezone });

const create = async (): Promise<void> => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.encryption.saltRounds);

  await ensureUser(DEMO_ACCOUNTS.admin, 'admin', passwordHash);
  const doctorUserId = await ensureUser(DEMO_ACCOUNTS.doctor, 'doctor', passwordHash);
  const doctorTwoUserId = await ensureUser(DEMO_ACCOUNTS.doctorTwo, 'doctor', passwordHash);
  const patientUserId = await ensureUser(DEMO_ACCOUNTS.patient, 'patient', passwordHash);
  const sponsorUserId = await ensureUser(DEMO_ACCOUNTS.sponsor, 'sponsor', passwordHash);

  const facilityId = await ensureFacility();
  const doctorId = await ensureDoctor(doctorUserId, 'DEMO-MD-0001', 'General Practice', '5000.00', facilityId);
  await ensureDoctor(doctorTwoUserId, 'DEMO-MD-0002', 'Pediatrics', '7000.00', facilityId);

  const [patientRecord] = await db.select({ patientId: patients.patientId }).from(patients).where(eq(patients.userId, patientUserId)).limit(1);
  if (!patientRecord) {
    await db.insert(patients).values({ userId: patientUserId, medicalRecordNumber: `MRN-DEMO-${patientUserId.slice(0, 8)}` });
  }

  const [link] = await db
    .select({ linkId: sponsorLinks.linkId })
    .from(sponsorLinks)
    .where(and(eq(sponsorLinks.sponsorUserId, sponsorUserId), eq(sponsorLinks.patientUserId, patientUserId)))
    .limit(1);
  if (!link) {
    await db.insert(sponsorLinks).values({ sponsorUserId, patientUserId, relationship: 'sibling', status: 'active', approvedAt: new Date() });
  }

  // Sample history only on the first run, so repeated runs do not pile up appointments.
  const [anyAppointment] = await db.select({ id: appointments.appointmentId }).from(appointments).where(eq(appointments.patientId, patientUserId)).limit(1);
  if (!anyAppointment) {
    const [past] = await db
      .insert(appointments)
      .values({
        patientId: patientUserId,
        doctorId,
        appointmentType: 'consultation',
        appointmentStatus: 'completed',
        scheduledDate: kigaliDate(-3),
        scheduledTime: '10:00:00',
        consultationFee: '5000.00',
      })
      .returning();
    const [consultation] = await db
      .insert(consultations)
      .values({ appointmentId: past.appointmentId, patientId: patientUserId, doctorId, notes: 'Demo consultation: routine check-up, no concerns.' })
      .returning();
    await db.insert(invoices).values({
      consultationId: consultation.consultationId,
      patientId: patientUserId,
      doctorId,
      invoiceNumber: `DEMO-${Date.now().toString().slice(-8)}`,
      totalAmount: '5000.00',
      invoiceStatus: 'pending',
    });

    await db.insert(appointments).values({
      patientId: patientUserId,
      doctorId,
      appointmentType: 'telemedicine',
      appointmentStatus: 'confirmed',
      scheduledDate: kigaliDate(1),
      scheduledTime: '10:00:00',
      consultationFee: '5000.00',
    });
  }

  console.log('Demo accounts ready (password for all: see DEMO_PASSWORD in src/db/demo-accounts.ts):');
  for (const [role, account] of Object.entries(DEMO_ACCOUNTS)) console.log(`  ${role.padEnd(10)} ${account.email}`);
};

const disable = async (): Promise<void> => {
  const emails = Object.values(DEMO_ACCOUNTS).map((account) => account.email);
  const updated = await db
    .update(users)
    .set({ accountStatus: 'suspended', updatedAt: new Date() })
    .where(inArray(users.email, emails))
    .returning({ email: users.email });
  console.log(`Suspended ${updated.length} demo account(s). Run without --disable to re-activate them.`);
};

const disabling = process.argv.includes('--disable');

// SEED_DEMO_ACCOUNTS=true is the deploy-time switch (docker-compose runs this script after migrating).
const allowed = process.env['ALLOW_DEMO_SEED'] === 'true' || process.env['SEED_DEMO_ACCOUNTS'] === 'true';

if (!disabling && config.env === 'production' && !allowed) {
  console.error('Refusing to create demo accounts: NODE_ENV is production. Set ALLOW_DEMO_SEED=true for this command if you want them.');
  process.exit(1);
}

(disabling ? disable() : create())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  });
