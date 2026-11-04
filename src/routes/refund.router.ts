import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';
import { decideRefund, markRefundProcessed } from '../services/refund.service';
import { ValidationError } from '../utils/errors';

const router = Router();

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
});

// Second-admin approval. The service blocks an admin from approving their own request.
router.post('/:refundId/decision', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid decision', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })));
    const refund = await decideRefund(req.user!, req.params.refundId, parsed.data as { decision: 'approve' | 'reject'; note?: string });
    res.json({ success: true, data: refund, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// Records that an approved refund was completed by hand in the Pesapal dashboard.
router.post('/:refundId/mark-processed', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
    const refund = await markRefundProcessed(req.params.refundId, note);
    res.json({ success: true, data: refund, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

export default router;
