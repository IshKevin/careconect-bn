import * as jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { config } from '../config/env';
import { users } from '../db/schemas';
import { AuthenticationError, NotFoundError } from '../utils/errors';
import { emailService } from './email.service';

// Verification tokens use their own audience and the access-token secret, so a password-reset
// token or a login token cannot be replayed as a verification token, or the reverse.
const AUDIENCE = 'isanomed-email-verify';
const TOKEN_LIFETIME = '24h';

export const requestEmailVerification = async (userId: string): Promise<{ alreadyVerified: boolean }> => {
  const [user] = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
  if (!user) throw new NotFoundError('User');
  if (user.emailVerified) return { alreadyVerified: true };

  const token = jwt.sign({ userId, email: user.email, purpose: 'email_verify' }, config.jwt.secret, {
    expiresIn: TOKEN_LIFETIME,
    issuer: config.jwt.issuer,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
  const link = `${config.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  // Send failures are logged by the email service and must not reveal whether the account exists.
  await emailService.sendTemplate({ to: user.email, template: 'email-verify', data: { link } });
  return { alreadyVerified: false };
};

export const confirmEmailVerification = async (token: string): Promise<{ verified: true }> => {
  let decoded: { userId: string; email: string; purpose: string };
  try {
    decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: AUDIENCE,
    }) as typeof decoded;
  } catch {
    throw new AuthenticationError('Invalid or expired verification link');
  }
  if (decoded.purpose !== 'email_verify') {
    throw new AuthenticationError('Invalid or expired verification link');
  }

  const [user] = await db.select().from(users).where(eq(users.userId, decoded.userId)).limit(1);
  if (!user || user.email !== decoded.email) {
    throw new AuthenticationError('Invalid or expired verification link');
  }

  if (!user.emailVerified) {
    await db
      .update(users)
      .set({ emailVerified: new Date().toISOString(), updatedAt: new Date() })
      .where(eq(users.userId, user.userId));
  }
  return { verified: true };
};
