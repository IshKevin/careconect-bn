import { Router } from 'express';
import {
    initiatePayment,
    checkPaymentStatus,
    confirmPayment,
    mtnWebhook,
    airtelWebhook,
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// ── Authenticated payment endpoints ──────────────────────────────────────────

/**
 * POST /api/v1/payments/initiate
 * Initiate a mobile money payment for an invoice.
 * Supports MTN MoMo and Airtel Money (Rwanda)
 * Requires: { invoiceId, phoneNumber, paymentMethod: "mtn_momo"|"airtel_money", currency? }
 */
router.post('/initiate', requireAuth, initiatePayment);

/**
 * GET /api/v1/payments/status/:referenceId?paymentMethod=mtn_momo|airtel_money
 * Check the real-time status of a payment from the provider.
 */
router.get('/status/:referenceId', requireAuth, checkPaymentStatus);

/**
 * POST /api/v1/payments/confirm
 * Verify payment success and mark invoice as paid.
 * Requires: { invoiceId, referenceId, paymentMethod, financialTransactionId? }
 */
router.post('/confirm', requireAuth, confirmPayment);

// ── Public webhook endpoints (called by payment providers) ──────────────────

/**
 * POST /api/v1/payments/webhook/mtn
 * Webhook receiver for MTN MoMo notifications.
 * Should be whitelisted in your MTN developer portal.
 */
router.post('/webhook/mtn', mtnWebhook);

/**
 * POST /api/v1/payments/webhook/airtel
 * Webhook receiver for Airtel Money notifications.
 * Should be whitelisted in your Airtel developer portal.
 */
router.post('/webhook/airtel', airtelWebhook);

export default router;
