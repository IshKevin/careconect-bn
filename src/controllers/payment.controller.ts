import { Request, Response, NextFunction } from 'express';
import { PaymentService, initiateMomoPaymentSchema, verifyPaymentSchema } from '../services/payment.service';
import { z } from 'zod';

const paymentService = new PaymentService();

// Helper to transform Zod errors
const transformZodErrors = (errors: z.ZodIssue[]) =>
    errors.map((e) => ({ field: e.path.join('.'), message: e.message, code: e.code }));

/**
 * POST /api/v1/payments/initiate
 * Initiate a mobile money payment (MTN MoMo or Airtel Money).
 * Body: { invoiceId, phoneNumber, paymentMethod, currency? }
 */
export const initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = initiateMomoPaymentSchema.parse(req.body);
        const result = await paymentService.initiatePayment(data);
        res.status(201).json({
            success: true,
            data: result,
            message: result.message,
            requestId: req.requestId,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: transformZodErrors(error.errors),
                requestId: req.requestId,
            });
        }
        next(error);
    }
};

/**
 * GET /api/v1/payments/status/:referenceId?paymentMethod=mtn_momo|airtel_money
 * Check real-time payment status from the provider.
 */
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { referenceId } = req.params;
        const { paymentMethod } = req.query;

        if (!referenceId) {
            return res.status(400).json({ success: false, message: 'referenceId is required', requestId: req.requestId });
        }

        if (!paymentMethod || !['mtn_momo', 'airtel_money'].includes(paymentMethod as string)) {
            return res.status(400).json({
                success: false,
                message: 'paymentMethod query param must be mtn_momo or airtel_money',
                requestId: req.requestId,
            });
        }

        const result = await paymentService.checkPaymentStatus(
            referenceId,
            paymentMethod as 'mtn_momo' | 'airtel_money',
        );

        res.json({ success: true, data: result, requestId: req.requestId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/payments/confirm
 * Confirm a payment and mark the invoice as paid.
 * Body: { invoiceId, referenceId, paymentMethod, financialTransactionId? }
 */
export const confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const confirmSchema = z.object({
            invoiceId: z.string().uuid('Invalid invoice ID'),
            referenceId: z.string().min(1, 'Reference ID is required'),
            paymentMethod: z.enum(['mtn_momo', 'airtel_money']),
            financialTransactionId: z.string().optional(),
        });

        const data = confirmSchema.parse(req.body);

        const result = await paymentService.confirmAndMarkInvoicePaid(
            data.invoiceId,
            data.referenceId,
            data.paymentMethod,
            data.financialTransactionId,
        );

        res.json({
            success: true,
            data: result,
            message: 'Payment confirmed and invoice marked as paid',
            requestId: req.requestId,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: transformZodErrors(error.errors),
                requestId: req.requestId,
            });
        }
        next(error);
    }
};

/**
 * POST /api/v1/payments/webhook/mtn
 * Webhook endpoint for MTN MoMo payment notifications.
 * This endpoint should be publicly accessible but secured via signature verification.
 */
export const mtnWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // In production: verify the webhook signature from MTN
        // For now we process the payload directly
        const payload = req.body;

        // Map MTN webhook format to our internal format
        const normalizedPayload = {
            referenceId: payload.externalId || payload.referenceId,
            status: payload.status as 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'EXPIRED',
            financialTransactionId: payload.financialTransactionId,
            externalId: payload.externalId,
            amount: payload.amount,
            currency: payload.currency,
            payer: payload.payer,
        };

        const result = await paymentService.handleWebhook('mtn', normalizedPayload);

        // Always return 200 to acknowledge the webhook
        res.status(200).json({ received: true, processed: result.processed });
    } catch (error) {
        // Log the error but still return 200 to prevent retries
        console.error('[MTN Webhook Error]', error);
        res.status(200).json({ received: true, processed: false });
    }
};

/**
 * POST /api/v1/payments/webhook/airtel
 * Webhook endpoint for Airtel Money payment notifications.
 */
export const airtelWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = req.body;

        // Map Airtel webhook format to internal format
        const txStatus = payload.transaction?.status;
        const statusMap: Record<string, 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'EXPIRED'> = {
            TS: 'SUCCESSFUL',
            TF: 'FAILED',
            TP: 'PENDING',
            TIP: 'PENDING',
        };

        const normalizedPayload = {
            referenceId: payload.transaction?.id,
            status: txStatus ? statusMap[txStatus] || ('FAILED' as const) : ('FAILED' as const),
            financialTransactionId: payload.transaction?.airtel_money_id,
        };

        const result = await paymentService.handleWebhook('airtel', normalizedPayload);

        res.status(200).json({ received: true, processed: result.processed });
    } catch (error) {
        console.error('[Airtel Webhook Error]', error);
        res.status(200).json({ received: true, processed: false });
    }
};
