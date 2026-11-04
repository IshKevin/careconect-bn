import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import { listSponsorLinks, requestSponsorLink, updateSponsorLink } from '../services/sponsor.service';
import { sponsorDashboard } from '../services/dashboard.service';
import { ValidationError } from '../utils/errors';

const router = Router();

const relationshipSchema = z.enum(['parent', 'child', 'spouse', 'sibling', 'guardian', 'other']);
type SponsorRelationship = z.infer<typeof relationshipSchema>;

const requestSchema = z.object({
  patientEmail: z.string().email('Invalid email format'),
  relationship: relationshipSchema,
});

const updateSchema = z
  .object({
    status: z.enum(['active', 'revoked']).optional(),
    medicalAccessGranted: z.boolean().optional(),
  })
  .refine((body) => body.status !== undefined || body.medicalAccessGranted !== undefined, {
    message: 'Provide status or medicalAccessGranted',
  });

const parseBody = <S extends z.ZodTypeAny>(schema: S, body: unknown) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid request', result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })));
  }
  return result.data;
};

// Sponsor dashboard: linked patients, invoices, upcoming visits and recent payments. No medical data.
router.get('/dashboard', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await sponsorDashboard(req.user!.userId);
    res.json({ success: true, data: dashboard, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// Sponsor asks to be linked to a patient. The patient must approve before any access exists.
router.post('/links', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseBody(requestSchema, req.body) as { patientEmail: string; relationship: SponsorRelationship };
    const result = await requestSponsorLink(req.user!, input);
    res.status(202).json({ success: true, message: result.message, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// Links where the caller is the sponsor or the patient.
router.get('/links', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await listSponsorLinks(req.user!);
    res.json({ success: true, data: links, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// Patient: approve, revoke, or set medical access. Sponsor: withdraw or end the link.
router.patch('/links/:linkId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseBody(updateSchema, req.body) as { status?: 'active' | 'revoked'; medicalAccessGranted?: boolean };
    const link = await updateSponsorLink(req.user!, req.params.linkId, input);
    res.json({ success: true, data: link, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

export default router;
