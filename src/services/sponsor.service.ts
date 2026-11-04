import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { sponsorLinks, userProfiles, users, type SponsorLinkStatus } from '../db/schemas';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { assertEmailVerified } from './access.service';

type RelationshipValue = typeof sponsorLinks.$inferInsert['relationship'];

export interface SponsorRequester {
  userId: string;
  userType: string;
}

export interface SponsorLinkView {
  linkId: string;
  sponsorUserId: string;
  patientUserId: string;
  relationship: RelationshipValue;
  status: SponsorLinkStatus;
  medicalAccessGranted: boolean;
  requestedAt: Date;
  approvedAt: Date | null;
  revokedAt: Date | null;
}

const toView = (row: typeof sponsorLinks.$inferSelect): SponsorLinkView => ({
  linkId: row.linkId,
  sponsorUserId: row.sponsorUserId,
  patientUserId: row.patientUserId,
  relationship: row.relationship,
  status: row.status,
  medicalAccessGranted: row.medicalAccessGranted,
  requestedAt: row.requestedAt,
  approvedAt: row.approvedAt,
  revokedAt: row.revokedAt,
});

/**
 * A sponsor asks to be linked to a patient by the patient's email.
 * The reply is the same whether or not the patient exists, so the endpoint cannot be used to look up accounts.
 */
export const requestSponsorLink = async (
  sponsor: SponsorRequester,
  input: { patientEmail: string; relationship: RelationshipValue },
): Promise<{ message: string; link?: SponsorLinkView }> => {
  const genericMessage = 'If a patient account matches that email, a link request has been sent for their approval.';
  await assertEmailVerified(sponsor.userId);

  const [patient] = await db
    .select({ userId: users.userId, userType: users.userType })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.patientEmail.trim().toLowerCase()}`)
    .limit(1);

  if (!patient || patient.userType !== 'patient') {
    return { message: genericMessage };
  }
  if (patient.userId === sponsor.userId) {
    throw new ValidationError('You cannot sponsor your own account');
  }

  const [existing] = await db
    .select()
    .from(sponsorLinks)
    .where(and(eq(sponsorLinks.sponsorUserId, sponsor.userId), eq(sponsorLinks.patientUserId, patient.userId)))
    .limit(1);

  if (existing) {
    if (existing.status === 'revoked') {
      const [reopened] = await db
        .update(sponsorLinks)
        .set({ status: 'pending', relationship: input.relationship, requestedAt: new Date(), revokedAt: null, updatedAt: new Date() })
        .where(eq(sponsorLinks.linkId, existing.linkId))
        .returning();
      return { message: genericMessage, link: toView(reopened) };
    }
    return { message: genericMessage, link: toView(existing) };
  }

  const [created] = await db
    .insert(sponsorLinks)
    .values({
      sponsorUserId: sponsor.userId,
      patientUserId: patient.userId,
      relationship: input.relationship,
      status: 'pending',
      medicalAccessGranted: false,
    })
    .returning();

  return { message: genericMessage, link: toView(created) };
};

// Links where the requester is the sponsor or the patient. Each link carries both parties' names,
// so a patient can see who is sponsoring them and a sponsor can see whom they sponsor.
export const listSponsorLinks = async (user: SponsorRequester): Promise<(SponsorLinkView & { sponsorName: string; patientName: string })[]> => {
  const rows = await db
    .select()
    .from(sponsorLinks)
    .where(or(eq(sponsorLinks.sponsorUserId, user.userId), eq(sponsorLinks.patientUserId, user.userId)));

  const ids = [...new Set(rows.flatMap((r) => [r.sponsorUserId, r.patientUserId]))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const profiles = await db
      .select({ userId: userProfiles.userId, firstName: userProfiles.firstName, lastName: userProfiles.lastName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, ids));
    for (const p of profiles) names.set(p.userId, `${p.firstName} ${p.lastName}`.trim());
  }

  return rows.map((row) => ({
    ...toView(row),
    sponsorName: names.get(row.sponsorUserId) ?? 'Sponsor',
    patientName: names.get(row.patientUserId) ?? 'Patient',
  }));
};

/**
 * Patient: approves a pending link, revokes it, or switches medical access on or off.
 * Sponsor: may withdraw a request or end the link. A sponsor cannot grant themselves medical access.
 */
export const updateSponsorLink = async (
  user: SponsorRequester,
  linkId: string,
  input: { status?: 'active' | 'revoked'; medicalAccessGranted?: boolean },
): Promise<SponsorLinkView> => {
  const [link] = await db.select().from(sponsorLinks).where(eq(sponsorLinks.linkId, linkId)).limit(1);
  if (!link) throw new NotFoundError('Sponsor link');

  const isPatient = link.patientUserId === user.userId;
  const isSponsor = link.sponsorUserId === user.userId;
  if (!isPatient && !isSponsor) {
    throw new AuthorizationError('You are not part of this sponsor link');
  }

  if (input.medicalAccessGranted !== undefined && !isPatient) {
    throw new AuthorizationError('Only the patient can grant or withdraw medical access');
  }
  if (input.status === 'active' && !isPatient) {
    throw new AuthorizationError('Only the patient can approve a sponsor link');
  }
  if (input.status === 'active' && link.status === 'revoked') {
    throw new ConflictError('This link was revoked. The sponsor must send a new request.');
  }
  if (input.medicalAccessGranted === true && link.status !== 'active' && input.status !== 'active') {
    throw new ValidationError('Approve the link before granting medical access');
  }

  const now = new Date();
  const updates: Partial<typeof sponsorLinks.$inferInsert> = { updatedAt: now };

  if (input.status === 'active') {
    updates.status = 'active';
    updates.approvedAt = now;
    updates.revokedAt = null;
  }
  if (input.status === 'revoked') {
    updates.status = 'revoked';
    updates.revokedAt = now;
    updates.medicalAccessGranted = false;
  }
  if (input.medicalAccessGranted !== undefined && input.status !== 'revoked') {
    updates.medicalAccessGranted = input.medicalAccessGranted;
  }

  const [updated] = await db.update(sponsorLinks).set(updates).where(eq(sponsorLinks.linkId, linkId)).returning();
  return toView(updated);
};
