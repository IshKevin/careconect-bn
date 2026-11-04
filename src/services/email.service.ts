import { Resend } from 'resend';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { emailSuppressions } from '../db/schemas';
import { config } from '../config/env';
import { logger } from '../config/logger';

// Transactional email through Resend. Services call sendTemplate(); nothing else
// talks to the Resend SDK. Templates must never carry health details (see docs/roadmap/02-email.md).

export type EmailTemplateName = 'password-reset' | 'email-verify' | 'appointment-confirmed' | 'payment-receipt';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const layout = (title: string, bodyHtml: string): string => `<!doctype html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
    <h2 style="color: #0f766e;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <p style="color: #6b7280; font-size: 12px;">IsanoMed. This is an automated message. Do not reply with health information.</p>
  </body>
</html>`;

export const templates: Record<EmailTemplateName, (data: Record<string, string>) => RenderedEmail> = {
  'password-reset': ({ link }) => ({
    subject: 'Reset your IsanoMed password',
    html: layout(
      'Reset your password',
      `<p>We received a request to reset your password. The link below works once and expires in 30 minutes.</p>
       <p><a href="${escapeHtml(link)}">Reset password</a></p>
       <p>If you did not ask for this, you can ignore this email.</p>`,
    ),
    text: `Reset your IsanoMed password (valid 30 minutes, single use): ${link}\nIf you did not ask for this, ignore this email.`,
  }),

  'email-verify': ({ link }) => ({
    subject: 'Confirm your IsanoMed email address',
    html: layout(
      'Confirm your email',
      `<p>Please confirm your email address. The link expires in 24 hours.</p>
       <p><a href="${escapeHtml(link)}">Confirm email</a></p>`,
    ),
    text: `Confirm your IsanoMed email (valid 24 hours): ${link}`,
  }),

  'appointment-confirmed': ({ doctorName, date, time }) => ({
    subject: 'Your IsanoMed appointment is confirmed',
    html: layout(
      'Appointment confirmed',
      `<p>Your appointment with ${escapeHtml(doctorName)} is confirmed for ${escapeHtml(date)} at ${escapeHtml(time)}.</p>
       <p>Log in to IsanoMed to see the details.</p>`,
    ),
    text: `Your appointment with ${doctorName} is confirmed for ${date} at ${time}. Log in to IsanoMed to see the details.`,
  }),

  'payment-receipt': ({ invoiceNumber, amount, currency, paidAt }) => ({
    subject: `Payment received for invoice ${invoiceNumber}`,
    html: layout(
      'Payment received',
      `<p>We received your payment of ${escapeHtml(amount)} ${escapeHtml(currency)} for invoice ${escapeHtml(invoiceNumber)} on ${escapeHtml(paidAt)}.</p>`,
    ),
    text: `We received your payment of ${amount} ${currency} for invoice ${invoiceNumber} on ${paidAt}.`,
  }),
};

export interface SendTemplateOptions {
  to: string;
  template: EmailTemplateName;
  data: Record<string, string>;
  /** Stops a retry from sending the same email twice (for example, a payment reference). */
  idempotencyKey?: string;
}

export class EmailService {
  private client: Resend | null;

  constructor() {
    this.client = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;
  }

  /**
   * Sends a templated email. Failures are logged and not thrown, so a provider
   * outage never fails the user's request (password reset, payment callback).
   */
  async sendTemplate(options: SendTemplateOptions): Promise<boolean> {
    const rendered = templates[options.template](options.data);

    if (!this.client) {
      logger.warn(`Email not sent (Resend not configured): ${options.template}`);
      return false;
    }

    // Skip addresses that bounced or complained earlier (see resend-webhook.ts).
    const [suppressed] = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, options.to.toLowerCase()))
      .limit(1);
    if (suppressed) {
      logger.warn(`Email skipped (address suppressed): ${options.template}`);
      return false;
    }

    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const { error } = await this.client.emails.send(
          {
            from: config.email.fromAddress,
            to: options.to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...(config.email.replyTo ? { replyTo: config.email.replyTo } : {}),
          },
          options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
        );

        if (!error) return true;
        logger.error(`Resend error on attempt ${attempt}: ${error.message}`);
      } catch (error) {
        logger.error(`Resend request failed on attempt ${attempt}`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    return false;
  }
}

export const emailService = new EmailService();
