import { Router, Request, Response } from 'express';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { handleResendEvent, verifyResendSignature } from '../services/resend-webhook';

const router = Router();

/**
 * POST /api/v1/webhooks/resend
 * Bounce and complaint events from Resend. Signature is verified before anything is stored.
 */
router.post('/resend', async (req: Request, res: Response) => {
  const secret = config.email.webhookSecret;
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Resend webhook is not configured' });
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
  const valid = verifyResendSignature(
    rawBody,
    {
      id: req.header('svix-id'),
      timestamp: req.header('svix-timestamp'),
      signature: req.header('svix-signature'),
    },
    secret,
  );

  if (!valid) {
    logger.warn('Rejected Resend webhook with invalid signature');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  try {
    const result = await handleResendEvent(req.body);
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    logger.error('Resend webhook processing failed', error);
    return res.status(500).json({ received: false });
  }
});

export default router;
