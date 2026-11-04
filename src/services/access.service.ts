import { and, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { appointments, consultations, doctors, invoices, sponsorLinks, users } from '../db/schemas';
import { AuthorizationError } from '../utils/errors';

// Central rules for who may act for, or read data about, a patient.
// Routes call these helpers; they do not repeat the logic.
//
//  - Booking, paying and invoice access: the patient, staff, or a sponsor with an ACTIVE link.
//  - Medical records and consultation notes: the patient, staff, a doctor who has treated
//    the patient, or a sponsor whose link is active AND who was granted medical access
//    by the patient. Payment alone never opens medical data.

export interface AccessRequester {
  userId: string;
  userType: string;
}

const isStaff = (user: AccessRequester) => user.userType === 'admin' || user.userType === 'super_admin';

export const getDoctorIdForUser = async (userId: string): Promise<string | null> => {
  const [row] = await db.select({ doctorId: doctors.doctorId }).from(doctors).where(eq(doctors.userId, userId)).limit(1);
  return row?.doctorId ?? null;
};

export const getSponsorLink = async (sponsorUserId: string, patientUserId: string) => {
  const [link] = await db
    .select()
    .from(sponsorLinks)
    .where(and(eq(sponsorLinks.sponsorUserId, sponsorUserId), eq(sponsorLinks.patientUserId, patientUserId)))
    .limit(1);
  return link ?? null;
};

export const hasActiveSponsorLink = async (sponsorUserId: string, patientUserId: string): Promise<boolean> => {
  const link = await getSponsorLink(sponsorUserId, patientUserId);
  return link?.status === 'active';
};

// True when the doctor has an appointment or consultation with this patient.
export const hasCareRelationship = async (doctorId: string, patientUserId: string): Promise<boolean> => {
  const [appt] = await db
    .select({ id: appointments.appointmentId })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientUserId)))
    .limit(1);
  if (appt) return true;

  const [consult] = await db
    .select({ id: consultations.consultationId })
    .from(consultations)
    .where(and(eq(consultations.doctorId, doctorId), eq(consultations.patientId, patientUserId)))
    .limit(1);
  return Boolean(consult);
};

// Booking, payments, invoices and appointment lists.
export const canActForPatient = async (user: AccessRequester, patientUserId: string): Promise<boolean> => {
  if (isStaff(user)) return true;
  if (user.userType === 'patient' && user.userId === patientUserId) return true;
  if (user.userType === 'sponsor' || user.userType === 'patient') {
    return hasActiveSponsorLink(user.userId, patientUserId);
  }
  return false;
};

// Medical records, clinical summaries, consultation notes.
export const canReadMedicalRecord = async (user: AccessRequester, patientUserId: string): Promise<boolean> => {
  if (isStaff(user)) return true;
  if (user.userType === 'patient' && user.userId === patientUserId) return true;
  if (user.userType === 'doctor') {
    const doctorId = await getDoctorIdForUser(user.userId);
    return doctorId ? hasCareRelationship(doctorId, patientUserId) : false;
  }
  if (user.userType === 'sponsor' || user.userType === 'patient') {
    const link = await getSponsorLink(user.userId, patientUserId);
    return link?.status === 'active' && link.medicalAccessGranted;
  }
  return false;
};

export const assertCanActForPatient = async (user: AccessRequester, patientUserId: string): Promise<void> => {
  if (!(await canActForPatient(user, patientUserId))) {
    throw new AuthorizationError('You do not have permission to act for this patient');
  }
};

export const assertCanReadMedicalRecord = async (user: AccessRequester, patientUserId: string): Promise<void> => {
  if (!(await canReadMedicalRecord(user, patientUserId))) {
    throw new AuthorizationError('You do not have permission to view this patient’s medical records');
  }
};

// Invoices: patient, staff, sponsor with an active link, or the doctor who issued the invoice.
export const canViewInvoice = async (
  user: AccessRequester,
  invoice: { patientId?: string | null; doctorId?: string | null },
): Promise<boolean> => {
  if (isStaff(user)) return true;
  if (user.userType === 'doctor') {
    const doctorId = await getDoctorIdForUser(user.userId);
    return Boolean(doctorId) && doctorId === invoice.doctorId;
  }
  if (!invoice.patientId) return false;
  return canActForPatient(user, invoice.patientId);
};

export const assertCanViewInvoice = async (
  user: AccessRequester,
  invoice: { patientId?: string | null; doctorId?: string | null },
): Promise<void> => {
  if (!(await canViewInvoice(user, invoice))) {
    throw new AuthorizationError('You can only view your own invoices');
  }
};

// Consultations: patient, treating doctor, staff, or sponsor with medical access.
export const canViewConsultation = async (
  user: AccessRequester,
  consultation: { patientId?: string | null; doctorId?: string | null },
): Promise<boolean> => {
  if (isStaff(user)) return true;
  if (user.userType === 'doctor') {
    const doctorId = await getDoctorIdForUser(user.userId);
    return Boolean(doctorId) && doctorId === consultation.doctorId;
  }
  if (!consultation.patientId) return false;
  return canReadMedicalRecord(user, consultation.patientId);
};

export const assertCanViewConsultation = async (
  user: AccessRequester,
  consultation: { patientId?: string | null; doctorId?: string | null },
): Promise<void> => {
  if (!(await canViewConsultation(user, consultation))) {
    throw new AuthorizationError('You do not have permission to view this consultation');
  }
};

// Patients a sponsor may act for right now (active links only). Used to filter lists.
export const getActiveSponsoredPatientIds = async (sponsorUserId: string): Promise<string[]> => {
  const rows = await db
    .select({ patientUserId: sponsorLinks.patientUserId })
    .from(sponsorLinks)
    .where(and(eq(sponsorLinks.sponsorUserId, sponsorUserId), eq(sponsorLinks.status, 'active')));
  return rows.map((row) => row.patientUserId);
};

// Money-moving and booking actions need a verified email address (EML-04).
export const assertEmailVerified = async (userId: string): Promise<void> => {
  const [row] = await db.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.userId, userId)).limit(1);
  if (!row?.emailVerified) {
    throw new AuthorizationError('EMAIL_NOT_VERIFIED: verify your email address before this action');
  }
};

// One account can hold more than one role. The primary type is the user_type; a sponsor role is
// added when the account has sponsored a patient. Roles are computed, not stored, so they cannot drift.
export const computeRoles = async (user: AccessRequester): Promise<string[]> => {
  const roles = [user.userType];
  const [link] = await db
    .select({ id: sponsorLinks.linkId })
    .from(sponsorLinks)
    .where(eq(sponsorLinks.sponsorUserId, user.userId))
    .limit(1);
  if (link && !roles.includes('sponsor')) roles.push('sponsor');
  return roles;
};

export const findInvoiceAccess = async (invoiceId: string): Promise<{ patientId: string; doctorId: string } | null> => {
  const [row] = await db
    .select({ patientId: invoices.patientId, doctorId: invoices.doctorId })
    .from(invoices)
    .where(eq(invoices.invoiceId, invoiceId))
    .limit(1);
  return row ?? null;
};
