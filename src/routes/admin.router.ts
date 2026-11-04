import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { adminDashboard } from '../services/dashboard.service';
import { assignDoctorToFacility, createFacility, facilitySettlement, FacilityInput, listFacilities, updateFacility } from '../services/facility.service';
import { listRefunds } from '../services/refund.service';
import { getReconciliationRun, listReconciliationRuns, runReconciliation } from '../services/reconciliation.service';
import { ValidationError } from '../utils/errors';

const facilityFields = {
  name: z.string().min(2).max(255),
  facilityType: z.enum(['hospital', 'clinic', 'private_practice', 'health_center']),
  registrationNumber: z.string().min(3).max(100),
  district: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  settlementAccountRef: z.string().max(255).optional(),
};
const createFacilitySchema = z.object(facilityFields);
const updateFacilitySchema = z
  .object({ ...facilityFields, verificationStatus: z.enum(['pending', 'verified', 'rejected', 'suspended']) })
  .partial();
const assignDoctorSchema = z.object({ facilityId: z.string().uuid().nullable() });

const parseBody = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Invalid request', result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })));
  }
  return result.data;
};
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await fn(req, res);
    res.json({ success: true, data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
};


const router = Router();
const adminOnly = [requireAuth, requireRole(['admin', 'super_admin'])];

router.get('/users', adminOnly, AdminController.listUsers);
router.get('/users/:user_id', adminOnly, AdminController.getUser);
router.patch('/users/:user_id', adminOnly, AdminController.updateUser);
router.patch('/users/:user_id/status', adminOnly, AdminController.updateUserStatus);
router.delete('/users/:user_id', adminOnly, AdminController.deleteUser);

router.get('/metrics/overview', adminOnly, AdminController.getSystemMetrics);
router.patch('/settings', adminOnly, AdminController.updateSystemSettings);
router.get('/audit-logs', adminOnly, AdminController.getAuditLogs);
router.post('/reports/generate', adminOnly, AdminController.triggerReportGeneration);

// Admin dashboard: real counts, revenue and queues.
router.get('/dashboard', ...adminOnly, handle(() => adminDashboard()));

// Facilities (provider verification and settlement references).
router.get('/facilities', ...adminOnly, handle(() => listFacilities()));
router.post('/facilities', ...adminOnly, handle(async (req) => createFacility(parseBody(createFacilitySchema, req.body) as FacilityInput)));
router.patch('/facilities/:facilityId', ...adminOnly, handle(async (req) => updateFacility(req.params.facilityId, parseBody(updateFacilitySchema, req.body) as Partial<FacilityInput> & { verificationStatus?: 'pending' | 'verified' | 'rejected' | 'suspended' })));
router.get('/facilities/:facilityId/settlement', ...adminOnly, handle(async (req) => facilitySettlement(req.params.facilityId)));
router.put('/doctors/:doctorId/facility', ...adminOnly, handle(async (req) => assignDoctorToFacility(req.params.doctorId, (parseBody(assignDoctorSchema, req.body) as { facilityId: string | null }).facilityId)));

// Refund queue and reconciliation (PAY-07).
router.get('/refunds', ...adminOnly, handle((req) => listRefunds(typeof req.query.status === 'string' ? req.query.status : undefined)));
router.post('/reconciliation/runs', ...adminOnly, handle((req) => runReconciliation(req.user!.userId)));
router.get('/reconciliation/runs', ...adminOnly, handle(() => listReconciliationRuns()));
router.get('/reconciliation/runs/:runId', ...adminOnly, handle(async (req) => {
  const run = await getReconciliationRun(req.params.runId);
  if (!run) throw new ValidationError('Reconciliation run not found');
  return run;
}));

export default router;
