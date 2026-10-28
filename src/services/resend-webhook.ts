import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../config/database';
import { emailSuppressions } from '../db/schemas';
import { logger } from '../config/logger';

// Resend signs webhooks with Svix. Signed content is "<svix-id>.<svix-timestamp>.<raw body>",
// HMAC-SHA256 with the base64-decoded part of the "whsec_" secret, base64 encoded.
const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

export const verifyResendSignature = (rawBody: Buffer, headers: SvixHeaders, secret: string): boolean => {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();

  // The header may carry several signatures ("v1,<sig> v1,<sig>") during key rotation.
  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
};

interface ResendEvent {
  type: string;
  data?: { to?: string[] | string };
}

/** Records bounced and complained addresses so later transactional mail is skipped. */
export const handleResendEvent = async (event: ResendEvent): Promise<{ suppressed: number }> => {
  const reason = event.type === 'email.bounced' ? 'bounced' : event.type === 'email.complained' ? 'complained' : null;
  if (!reason) return { suppressed: 0 };

  const recipients = Array.isArray(event.data?.to) ? event.data!.to : event.data?.to ? [event.data.to] : [];
  for (const email of recipients) {
    await db
      .insert(emailSuppressions)
      .values({ email: email.toLowerCase(), reason })
      .onConflictDoNothing();
  }
  logger.info('Email suppression recorded', { reason, count: recipients.length });
  return { suppressed: recipients.length };
};
