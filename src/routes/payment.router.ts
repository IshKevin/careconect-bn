import { Router } from 'express';
import { initiatePayment, checkPaymentStatus, pesapalWebhook } from '../controllers/payment.controller';
import { requireAuth } from '../middleware/authMiddleware';
import { paymentRateLimit } from '../middleware/rateLimit';

const router = Router();

/**
 * POST /api/v1/payments/initiate
 * Create a Pesapal payment for an invoice. Body: { invoiceId }.
 */
router.post('/initiate', requireAuth, paymentRateLimit, initiatePayment);

/**
 * GET /api/v1/payments/status/:referenceId
 * Status of one payment (owner or admin).
 */
router.get('/status/:referenceId', requireAuth, checkPaymentStatus);

/**
 * GET|POST /api/v1/payments/webhook/pesapal
 * Public IPN endpoint. Register this URL with Pesapal (RegisterIPN).
 */
router.get('/webhook/pesapal', pesapalWebhook);
router.post('/webhook/pesapal', pesapalWebhook);

export default router;
