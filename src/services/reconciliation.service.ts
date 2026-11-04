import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { invoices, paymentTransactions, reconciliationRuns, refunds } from '../db/schemas';
import { paymentService } from './payment.service';

// PAY-07. Compares our records with each other and re-checks old pending payments with Pesapal.
// Read-only apart from resolving stale pending payments through the same path the IPN uses.
// Every run is stored with its findings so an admin can review them.

const STALE_PENDING_HOURS = 2;
const MAX_FINDINGS = 500;

export interface Finding {
  type:
    | 'stale_pending_resolved'
    | 'stale_pending_unresolved'
    | 'payment_without_paid_invoice'
    | 'amount_mismatch'
    | 'paid_invoice_without_payment'
    | 'over_refund'
    | 'refund_failed';
  reference: string;
  detail: string;
}

export const runReconciliation = async (triggeredBy: string) => {
  const startedAt = new Date();
  const findings: Finding[] = [];
  let resolvedCount = 0;

  try {
    // 1. Pending payments older than the cut-off: ask Pesapal for the real status.
    const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000);
    const stale = await db
      .select({ txRef: paymentTransactions.txRef })
      .from(paymentTransactions)
      .where(and(eq(paymentTransactions.status, 'pending'), lt(paymentTransactions.createdAt, cutoff)))
      .limit(200);

    for (const tx of stale) {
      try {
        const result = await paymentService.getPaymentStatus(tx.txRef, { userId: triggeredBy, userType: 'super_admin' });
        if (result.status === 'pending') {
          findings.push({ type: 'stale_pending_unresolved', reference: tx.txRef, detail: 'Still pending at Pesapal' });
        } else {
          resolvedCount += 1;
          findings.push({ type: 'stale_pending_resolved', reference: tx.txRef, detail: `Now ${result.status}` });
        }
      } catch (error) {
        findings.push({ type: 'stale_pending_unresolved', reference: tx.txRef, detail: `Pesapal check failed: ${(error as Error).message.slice(0, 160)}` });
      }
    }

    // 2. Completed payments whose invoice is not marked paid (or refunded).
    const completedRows = await db
      .select({
        txRef: paymentTransactions.txRef,
        txAmount: paymentTransactions.amount,
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceStatus: invoices.invoiceStatus,
        invoiceTotal: invoices.totalAmount,
      })
      .from(paymentTransactions)
      .innerJoin(invoices, eq(invoices.invoiceId, paymentTransactions.invoiceId))
      .where(eq(paymentTransactions.status, 'completed'));

    for (const row of completedRows) {
      if (!['paid', 'refunded'].includes(row.invoiceStatus)) {
        findings.push({ type: 'payment_without_paid_invoice', reference: row.txRef, detail: `Invoice ${row.invoiceNumber} is ${row.invoiceStatus}` });
      }
      if (Math.round(Number(row.txAmount) * 100) !== Math.round(Number(row.invoiceTotal) * 100)) {
        findings.push({
          type: 'amount_mismatch',
          reference: row.txRef,
          detail: `Paid ${row.txAmount} against invoice total ${row.invoiceTotal}`,
        });
      }
    }

    // 3. Invoices marked paid with no completed Pesapal payment. Cash, card-terminal and insurance
    //    payments recorded by an admin also show here, so the admin reviews each one.
    const paidInvoices = await db
      .select({ invoiceId: invoices.invoiceId, invoiceNumber: invoices.invoiceNumber, total: invoices.totalAmount })
      .from(invoices)
      .where(inArray(invoices.invoiceStatus, ['paid', 'refunded']));
    const completedInvoiceIds = new Set(completedRows.map((r) => r.invoiceId));
    for (const inv of paidInvoices) {
      if (!completedInvoiceIds.has(inv.invoiceId)) {
        findings.push({
          type: 'paid_invoice_without_payment',
          reference: inv.invoiceNumber,
          detail: `Invoice of ${inv.total} is marked paid with no completed Pesapal payment (check for a manual payment)`,
        });
      }
    }

    // 4. Refunds that together exceed the payment, and refunds that failed at Pesapal.
    const refundTotals = await db
      .select({
        transactionId: refunds.transactionId,
        refunded: sql<string>`coalesce(sum(${refunds.amount}) filter (where ${refunds.status} in ('pending','approved','processed')), 0)::text`,
      })
      .from(refunds)
      .groupBy(refunds.transactionId);
    if (refundTotals.length > 0) {
      const txs = await db
        .select({ id: paymentTransactions.id, txRef: paymentTransactions.txRef, amount: paymentTransactions.amount })
        .from(paymentTransactions)
        .where(inArray(paymentTransactions.id, refundTotals.map((r) => r.transactionId)));
      const amountById = new Map(txs.map((t) => [t.id, t]));
      for (const r of refundTotals) {
        const tx = amountById.get(r.transactionId);
        if (tx && Math.round(Number(r.refunded) * 100) > Math.round(Number(tx.amount) * 100)) {
          findings.push({ type: 'over_refund', reference: tx.txRef, detail: `Refunds ${r.refunded} exceed payment ${tx.amount}` });
        }
      }
    }
    const failedRefunds = await db.select({ refundId: refunds.refundId, reason: refunds.failureReason }).from(refunds).where(eq(refunds.status, 'failed'));
    for (const f of failedRefunds) {
      findings.push({ type: 'refund_failed', reference: f.refundId, detail: f.reason ?? 'Refund failed at Pesapal' });
    }

    const counts = await db
      .select({ pending: sql<number>`count(*) filter (where ${paymentTransactions.status} = 'pending')::int`, completed: sql<number>`count(*) filter (where ${paymentTransactions.status} = 'completed')::int` })
      .from(paymentTransactions);

    const [run] = await db
      .insert(reconciliationRuns)
      .values({
        triggeredBy,
        status: 'completed',
        startedAt,
        finishedAt: new Date(),
        checkedTransactions: (counts[0]?.pending ?? 0) + (counts[0]?.completed ?? 0),
        checkedInvoices: paidInvoices.length + (await countOpenInvoices()),
        resolvedCount,
        mismatchCount: findings.length,
        findings: findings.slice(0, MAX_FINDINGS),
      })
      .returning();
    logger.info('Reconciliation run completed', { runId: run.runId, mismatches: findings.length, resolved: resolvedCount });
    return run;
  } catch (error) {
    const [failed] = await db
      .insert(reconciliationRuns)
      .values({ triggeredBy, status: 'failed', startedAt, finishedAt: new Date(), error: (error as Error).message.slice(0, 500) })
      .returning();
    logger.error('Reconciliation run failed', { runId: failed.runId, error: (error as Error).message });
    throw error;
  }
};

const countOpenInvoices = async () => {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.invoiceStatus, 'pending'));
  return row?.n ?? 0;
};

export const listReconciliationRuns = async (limit = 20) =>
  db.select().from(reconciliationRuns).orderBy(sql`${reconciliationRuns.startedAt} desc`).limit(limit);

export const getReconciliationRun = async (runId: string) => {
  const [run] = await db.select().from(reconciliationRuns).where(eq(reconciliationRuns.runId, runId)).limit(1);
  return run ?? null;
};
