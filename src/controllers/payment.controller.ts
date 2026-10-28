import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger';
import {
  paymentService,
  initiatePaymentSchema,
  pesapalIpnSchema,
} from '../services/payment.service';

const transformZodErrors = (errors: z.ZodIssue[]) =>
  errors.map((e) => ({ field: e.path.join('.'), message: e.message, code: e.code }));

const requesterOf = (req: Request) => {
  if (!req.user) throw new Error('Authenticated request expected');
  return req.user;
};

/**
 * POST /api/v1/payments/initiate
 * Body: { invoiceId }. Returns the Pesapal checkout URL the frontend redirects to.
 */
export const initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = initiatePaymentSchema.parse(req.body);
    const result = await paymentService.initiatePayment(input, requesterOf(req));

    res.status(201).json({
      success: true,
      data: result,
      message: 'Redirect the patient to the checkout URL to complete payment',
      requestId: req.requestId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
    }
    next(error);
  }
};

/**
 * GET /api/v1/payments/status/:referenceId
 * Our status for a payment, refreshed from Pesapal while it is pending.
 */
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPaymentStatus(req.params.referenceId, requesterOf(req));
    res.json({ success: true, data: result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
};

/**
 * GET or POST /api/v1/payments/webhook/pesapal
 * Pesapal IPN. Public, so the handler never trusts the body: it re-checks the status
 * with Pesapal. Replies with the JSON receipt Pesapal expects. Returns 500 on a
 * transient failure so Pesapal retries.
 */
export const pesapalWebhook = async (req: Request, res: Response) => {
  const raw = req.method === 'GET' ? req.query : req.body;
  const parsed = pesapalIpnSchema.safeParse(raw ?? {});

  if (!parsed.success) {
    return res.status(400).json({ status: '400', message: 'Invalid IPN payload' });
  }

  try {
    const receipt = await paymentService.handleIpn(parsed.data);
    return res.status(200).json(receipt);
  } catch (error) {
    logger.error('Pesapal IPN processing failed', error);
    return res.status(500).json({ status: '500', message: 'Processing failed; retry' });
  }
};
