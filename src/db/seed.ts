import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { config } from '../config/env';
import { appointments, consultations, doctors, invoices, patients, userProfiles, users } from '../db/schemas';

// Test data for the combined stack. Not for production: it creates known passwords.
// Creates a doctor, a patient, a confirmed telemedicine appointment whose start time is "now"
// (so the video join window is open), a consultation, and a pending invoice.
// Run:  docker compose run --rm api node dist/db/seed.js

const DOCTOR = { email: 'doctor.test@careconnect.rw', password: 'TestDoctor#2026', phone: '+250788100001', license: 'TEST-MD-0001' };
const PATIENT = { email: 'patient.test@careconnect.rw', password: 'TestPatient#2026', phone: '+250788100002' };

// Kigali is UTC+2 year-round. Returns the local date and time as stored in the appointment row.
const kigaliNow = (): { date: string; time: string } => {
  const [date, time] = new Date().toLocaleString('sv-SE', { timeZone: config.rwanda.timezone }).split(' ');
  return { date, time };
};

const ensureUser = async (
  email: string,
  password: string,
  phoneNumber: string,
  userType: 'doctor' | 'patient',
  firstName: string,
  lastName: string,
): Promise<string> => {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing.userId;

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, config.encryption.saltRounds);
  await db.insert(users).values({ userId, email, phoneNumber, passwordHash, userType, accountStatus: 'active' });
  await db.insert(userProfiles).values({ profileId: randomUUID(), userId, firstName, lastName });
  return userId;
};

const run = async (): Promise<void> => {
  const doctorUserId = await ensureUser(DOCTOR.email, DOCTOR.password, DOCTOR.phone, 'doctor', 'Test', 'Doctor');
  const patientUserId = await ensureUser(PATIENT.email, PATIENT.password, PATIENT.phone, 'patient', 'Test', 'Patient');

  const [patientRecord] = await db.select().from(patients).where(eq(patients.userId, patientUserId)).limit(1);
  if (!patientRecord) {
    await db.insert(patients).values({ userId: patientUserId, medicalRecordNumber: `MRN-TEST-${patientUserId.slice(0, 8)}` });
  }

  let [doctor] = await db.select().from(doctors).where(eq(doctors.userId, doctorUserId)).limit(1);
  if (!doctor) {
    [doctor] = await db
      .insert(doctors)
      .values({ userId: doctorUserId, medicalLicenseNumber: DOCTOR.license, specialty: 'General Practice', consultationFee: '5000.00' })
      .returning();
  }

  const { date, time } = kigaliNow();
  const [appointment] = await db
    .insert(appointments)
    .values({
      patientId: patientUserId,
      doctorId: doctor.doctorId,
      appointmentType: 'telemedicine',
      appointmentStatus: 'confirmed',
      scheduledDate: date,
      scheduledTime: time,
      consultationFee: '5000.00',
    })
    .returning();

  const [consultation] = await db
    .insert(consultations)
    .values({
      appointmentId: appointment.appointmentId,
      patientId: patientUserId,
      doctorId: doctor.doctorId,
      notes: 'Seeded test consultation.',
    })
    .returning();

  const [invoice] = await db
    .insert(invoices)
    .values({
      consultationId: consultation.consultationId,
      patientId: patientUserId,
      doctorId: doctor.doctorId,
      invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
      totalAmount: '5000.00',
      invoiceStatus: 'pending',
    })
    .returning();

  console.log(JSON.stringify(
    {
      doctor: { email: DOCTOR.email, password: DOCTOR.password, userId: doctorUserId, doctorId: doctor.doctorId },
      patient: { email: PATIENT.email, password: PATIENT.password, userId: patientUserId },
      appointment: { appointmentId: appointment.appointmentId, scheduledDate: date, scheduledTime: time },
      invoice: { invoiceId: invoice.invoiceId, totalAmount: invoice.totalAmount, invoiceStatus: invoice.invoiceStatus },
    },
    null,
    2,
  ));
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
