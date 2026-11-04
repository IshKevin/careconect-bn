import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { invoices, paymentTransactions, refunds } from '../db/schemas';
import { AuthorizationError, ConflictError, NotFoundError, PaymentError, ValidationError } from '../utils/errors';
import { PesapalClient } from './pesapal.client';

// Refund policy (default, pending owner confirmation):
//  - Only a completed Pesapal payment can be refunded.
//  - Total refunds (pending, approved and processed) cannot exceed what was paid.
//  - The admin who requests a refund cannot approve it. A second admin decides.
//  - Automatic processing through Pesapal runs only when PESAPAL_REFUNDS_ENABLED=true.
//    Otherwise an approved refund waits for manual processing, which the admin marks as done.

const toCents = (amount: string | number) => Math.round(Number(amount) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);
const pesapal = new PesapalClient();

const refundedCents = async (transactionId: string) => {
  const rows = await db
    .select({ amount: refunds.amount })
    .from(refunds)
    .where(and(eq(refunds.transactionId, transactionId), inArray(refunds.status, ['pending', 'approved', 'processed'])));
  return rows.reduce((sum, r) => sum + toCents(r.amount), 0);
};

export const requestRefund = async (
  requester: { userId: string },
  invoiceId: string,
  input: { amount: number; reason: string },
) => {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceId, invoiceId)).limit(1);
  if (!invoice) throw new NotFoundError('Invoice');

  const [tx] = await db
    .select()
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.invoiceId, invoiceId), eq(paymentTransactions.status, 'completed')))
    .orderBy(desc(paymentTransactions.completedAt))
    .limit(1);
  if (!tx) throw new ValidationError('No completed payment exists for this invoice');

  const requestedCents = toCents(input.amount);
  const remaining = toCents(tx.amount) - (await refundedCents(tx.id));
  if (requestedCents <= 0) throw new ValidationError('Refund amount must be greater than zero');
  if (requestedCents > remaining) {
    throw new ValidationError(`Refund exceeds the refundable amount of ${fromCents(remaining)} ${tx.currency}`);
  }

  const [created] = await db
    .insert(refunds)
    .values({
      invoiceId,
      transactionId: tx.id,
      amount: fromCents(requestedCents),
      currency: tx.currency,
      reason: input.reason,
      requestedBy: requester.userId,
      status: 'pending',
    })
    .returning();
  return created;
};

export const decideRefund = async (
  requester: { userId: string },
  refundId: string,
  input: { decision: 'approve' | 'reject'; note?: string },
) => {
  const [refund] = await db.select().from(refunds).where(eq(refunds.refundId, refundId)).limit(1);
  if (!refund) throw new NotFoundError('Refund');
  if (refund.status !== 'pending') throw new ConflictError(`Refund is already ${refund.status}`);
  if (refund.requestedBy === requester.userId) {
    throw new AuthorizationError('A second admin must approve or reject this refund');
  }

  if (input.decision === 'reject') {
    const [rejected] = await db
      .update(refunds)
      .set({ status: 'rejected', approvedBy: requester.userId, decisionNote: input.note ?? null, updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();
    return rejected;
  }

  const [approved] = await db
    .update(refunds)
    .set({ status: 'approved', approvedBy: requester.userId, decisionNote: input.note ?? null, updatedAt: new Date() })
    .where(eq(refunds.refundId, refundId))
    .returning();

  if (!config.pesapal.refundsEnabled) {
    return { ...approved, processing: 'manual' as const };
  }

  const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, refund.transactionId)).limit(1);
  try {
    const result = await pesapal.requestRefund({
      confirmationCode: tx.confirmationCode ?? '',
      amount: Number(refund.amount),
      username: requester.userId,
      remarks: refund.reason.slice(0, 200),
    });
    const [processed] = await db
      .update(refunds)
      .set({ status: 'processed', pesapalRefundRef: result.refund_request_id ?? null, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();
    await markInvoiceRefundedIfFullyRefunded(refund.invoiceId, tx.id);
    return { ...processed, processing: 'pesapal' as const };
  } catch (error) {
    logger.error('Pesapal refund failed', { refundId, error: (error as Error).message });
    const [failed] = await db
      .update(refunds)
      .set({ status: 'failed', failureReason: (error as Error).message.slice(0, 500), updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();
    if (error instanceof PaymentError) return { ...failed, processing: 'failed' as const };
    throw error;
  }
};

// For refunds completed by hand in the Pesapal dashboard. Any admin can record this.
export const markRefundProcessed = async (refundId: string, note?: string) => {
  const [refund] = await db.select().from(refunds).where(eq(refunds.refundId, refundId)).limit(1);
  if (!refund) throw new NotFoundError('Refund');
  if (refund.status !== 'approved') throw new ConflictError('Only an approved refund can be marked processed');

  const [processed] = await db
    .update(refunds)
    .set({ status: 'processed', processedAt: new Date(), decisionNote: note ?? refund.decisionNote, updatedAt: new Date() })
    .where(eq(refunds.refundId, refundId))
    .returning();
  await markInvoiceRefundedIfFullyRefunded(refund.invoiceId, refund.transactionId);
  return processed;
};

const markInvoiceRefundedIfFullyRefunded = async (invoiceId: string, transactionId: string) => {
  const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, transactionId)).limit(1);
  if (!tx) return;
  const processedRows = await db
    .select({ amount: refunds.amount })
    .from(refunds)
    .where(and(eq(refunds.transactionId, transactionId), eq(refunds.status, 'processed')));
  const processedCents = processedRows.reduce((sum, r) => sum + toCents(r.amount), 0);
  if (processedCents >= toCents(tx.amount)) {
    await db.update(invoices).set({ invoiceStatus: 'refunded', updatedAt: new Date() }).where(eq(invoices.invoiceId, invoiceId));
  }
};

export const listRefunds = async (status?: string) => {
  const query = db.select().from(refunds);
  return status
    ? query.where(eq(refunds.status, status as 'pending')).orderBy(desc(refunds.createdAt)).limit(200)
    : query.orderBy(desc(refunds.createdAt)).limit(200);
};

export const listInvoiceRefunds = async (invoiceId: string) =>
  db.select().from(refunds).where(eq(refunds.invoiceId, invoiceId)).orderBy(desc(refunds.createdAt));

export const getRefundTotals = async () =>
  db
    .select({ status: refunds.status, count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${refunds.amount}), 0)::text` })
    .from(refunds)
    .groupBy(refunds.status);
