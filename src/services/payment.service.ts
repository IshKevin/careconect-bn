import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../config/database';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { invoices, paymentTransactions, userProfiles, users } from '../db/schemas';
import type { PaymentTransactionStatus } from '../db/schemas';
import { AuthorizationError, NotFoundError, PaymentError, ValidationError } from '../utils/errors';
import { PesapalClient, PesapalTransactionStatus } from './pesapal.client';
import { emailService } from './email.service';

// ─── Validation ───────────────────────────────────────────────────────────────

export const initiatePaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
});

export const pesapalIpnSchema = z.object({
  OrderTrackingId: z.string().min(1).optional(),
  OrderMerchantReference: z.string().optional(),
  OrderNotificationType: z.string().optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type PesapalIpnParams = z.infer<typeof pesapalIpnSchema>;

export interface Requester {
  userId: string;
  userType: string;
}

export interface InitiatePaymentResult {
  referenceId: string;
  redirectUrl: string;
  status: 'pending';
}

export interface PaymentStatusResult {
  referenceId: string;
  status: PaymentTransactionStatus;
  invoiceId: string;
  amount: string;
  currency: string;
  paymentMethod: string | null;
}

export interface IpnReceipt {
  orderNotificationType: string;
  orderTrackingId: string;
  orderMerchantReference: string;
  status: '200' | '400';
}

// Pesapal's payment_status_description → our status. Anything unknown stays pending.
const STATUS_MAP: Record<string, PaymentTransactionStatus> = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
  INVALID: 'invalid',
};

const toLocalDate = (date: Date): string =>
  date.toLocaleDateString('en-GB', { timeZone: config.rwanda.timezone, day: '2-digit', month: 'short', year: 'numeric' });

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  private readonly pesapal = new PesapalClient();

  /**
   * Creates a payment attempt for an invoice and returns the Pesapal checkout URL.
   * The amount always comes from the invoice, never from the client.
   */
  async initiatePayment(input: InitiatePaymentInput, requester: Requester): Promise<InitiatePaymentResult> {
    if (!config.pesapal.ipnId || !config.pesapal.callbackUrl) {
      throw new PaymentError('Pesapal is not fully configured (PESAPAL_IPN_ID and PESAPAL_CALLBACK_URL are required).');
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceId, input.invoiceId)).limit(1);
    if (!invoice) throw new NotFoundError('Invoice');

    if (requester.userType === 'patient' && invoice.patientId !== requester.userId) {
      throw new AuthorizationError('You can only pay your own invoices');
    }
    if (invoice.invoiceStatus === 'paid') throw new ValidationError('Invoice is already paid');
    if (invoice.invoiceStatus === 'cancelled') throw new ValidationError('Cannot pay a cancelled invoice');

    const amount = Number(invoice.totalAmount);
    if (!(amount > 0)) throw new ValidationError('Invoice amount must be greater than zero');

    const [patient] = await db
      .select({ email: users.email, phoneNumber: users.phoneNumber, firstName: userProfiles.firstName, lastName: userProfiles.lastName })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
      .where(eq(users.userId, invoice.patientId))
      .limit(1);
    if (!patient) throw new NotFoundError('Patient');

    const txRef = uuidv4();
    await db.insert(paymentTransactions).values({
      txRef,
      invoiceId: invoice.invoiceId,
      patientId: invoice.patientId,
      amount: invoice.totalAmount,
      currency: config.pesapal.currency,
      status: 'pending',
    });

    try {
      const order = await this.pesapal.submitOrder({
        merchantReference: txRef,
        amount,
        currency: config.pesapal.currency,
        description: `CareConnect invoice ${invoice.invoiceNumber}`,
        callbackUrl: config.pesapal.callbackUrl,
        notificationId: config.pesapal.ipnId,
        billingAddress: {
          email_address: patient.email,
          phone_number: patient.phoneNumber ?? undefined,
          first_name: patient.firstName ?? 'Patient',
          last_name: patient.lastName ?? 'CareConnect',
        },
      });

      await db
        .update(paymentTransactions)
        .set({ orderTrackingId: order.order_tracking_id, updatedAt: new Date() })
        .where(eq(paymentTransactions.txRef, txRef));

      return { referenceId: txRef, redirectUrl: order.redirect_url, status: 'pending' };
    } catch (error) {
      await db
        .update(paymentTransactions)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(paymentTransactions.txRef, txRef));
      throw error;
    }
  }

  /**
   * Returns our status for a payment. While it is still pending, asks Pesapal
   * directly so the patient sees the result even if the IPN is late.
   */
  async getPaymentStatus(txRef: string, requester: Requester): Promise<PaymentStatusResult> {
    const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.txRef, txRef)).limit(1);
    if (!tx) throw new NotFoundError('Payment');

    if (requester.userType === 'patient' && tx.patientId !== requester.userId) {
      throw new AuthorizationError('You can only view your own payments');
    }

    if (tx.status === 'pending' && tx.orderTrackingId) {
      const remote = await this.pesapal.getTransactionStatus(tx.orderTrackingId);
      await this.applyStatus(txRef, remote);
    }

    const [current] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.txRef, txRef)).limit(1);
    return {
      referenceId: current.txRef,
      status: current.status,
      invoiceId: current.invoiceId,
      amount: current.amount,
      currency: current.currency,
      paymentMethod: current.paymentMethod,
    };
  }

  /**
   * Handles a Pesapal IPN. The notification itself is not trusted: we look up the
   * real status and act only on that. Unknown or mismatched references change nothing.
   */
  async handleIpn(params: PesapalIpnParams): Promise<IpnReceipt> {
    const orderTrackingId = params.OrderTrackingId;
    const notificationType = params.OrderNotificationType ?? 'IPNCHANGE';

    if (!orderTrackingId) {
      return { orderNotificationType: notificationType, orderTrackingId: '', orderMerchantReference: '', status: '400' };
    }

    const [tx] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderTrackingId, orderTrackingId))
      .limit(1);

    if (!tx) {
      logger.warn('Pesapal IPN for unknown order tracking id', { orderTrackingId });
      return { orderNotificationType: notificationType, orderTrackingId, orderMerchantReference: params.OrderMerchantReference ?? '', status: '200' };
    }

    const remote = await this.pesapal.getTransactionStatus(orderTrackingId);
    if (remote.merchant_reference !== tx.txRef) {
      logger.error('Pesapal IPN reference mismatch; no change made', { orderTrackingId, txRef: tx.txRef });
      return { orderNotificationType: notificationType, orderTrackingId, orderMerchantReference: tx.txRef, status: '200' };
    }

    await this.applyStatus(tx.txRef, remote);

    return { orderNotificationType: notificationType, orderTrackingId, orderMerchantReference: tx.txRef, status: '200' };
  }

  /**
   * Applies a verified Pesapal status. Runs under a row lock and is idempotent:
   * a completed payment is never applied twice, and an invoice is marked paid only
   * when the amount and currency match what we charged.
   */
  private async applyStatus(txRef: string, remote: PesapalTransactionStatus): Promise<void> {
    const mapped = STATUS_MAP[remote.payment_status_description] ?? 'pending';
    let justCompleted = false;
    let invoiceNumber = '';
    let invoicePaidAmount = '';

    await db.transaction(async (trx) => {
      const [tx] = await trx
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.txRef, txRef))
        .for('update')
        .limit(1);
      if (!tx) throw new NotFoundError('Payment');
      if (tx.status === 'completed') return; // already applied

      let next: PaymentTransactionStatus = mapped;
      if (mapped === 'completed') {
        const amountMatches = Number(remote.amount) === Number(tx.amount);
        const currencyMatches = remote.currency === tx.currency;
        if (!amountMatches || !currencyMatches) {
          logger.error('Pesapal amount or currency mismatch; payment marked invalid', {
            txRef,
            expected: `${tx.amount} ${tx.currency}`,
            received: `${remote.amount} ${remote.currency}`,
          });
          next = 'invalid';
        }
      }

      const completedNow = next === 'completed';
      await trx
        .update(paymentTransactions)
        .set({
          status: next,
          confirmationCode: remote.confirmation_code ?? tx.confirmationCode,
          paymentMethod: remote.payment_method ?? tx.paymentMethod,
          rawStatus: remote as unknown as Record<string, unknown>,
          completedAt: completedNow ? new Date() : tx.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactions.txRef, txRef));

      if (!completedNow) return;

      const [invoice] = await trx.select().from(invoices).where(eq(invoices.invoiceId, tx.invoiceId)).for('update').limit(1);
      if (!invoice) throw new NotFoundError('Invoice');

      if (invoice.invoiceStatus === 'paid' || invoice.invoiceStatus === 'cancelled') {
        // Money arrived for an invoice that is already settled or cancelled. Needs manual review.
        logger.error('Payment completed for an invoice that is already settled', {
          txRef,
          invoiceId: invoice.invoiceId,
          invoiceStatus: invoice.invoiceStatus,
        });
        return;
      }

      await trx
        .update(invoices)
        .set({ invoiceStatus: 'paid', paidAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.invoiceId, invoice.invoiceId));

      justCompleted = true;
      invoiceNumber = invoice.invoiceNumber;
      invoicePaidAmount = tx.amount;
    });

    if (justCompleted) {
      const [patient] = await db.select({ email: users.email }).from(users).innerJoin(paymentTransactions, eq(paymentTransactions.patientId, users.userId)).where(eq(paymentTransactions.txRef, txRef)).limit(1);
      if (patient) {
        await emailService.sendTemplate({
          to: patient.email,
          template: 'payment-receipt',
          data: {
            invoiceNumber,
            amount: invoicePaidAmount,
            currency: config.pesapal.currency,
            paidAt: toLocalDate(new Date()),
          },
          idempotencyKey: `receipt-${txRef}`,
        });
      }
    }
  }
}

export const paymentService = new PaymentService();
