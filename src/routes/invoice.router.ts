import { Router, Request, Response, NextFunction } from 'express';
import * as InvoiceController from '../controllers/invoice.controller';
import { requireAuth, requireAdmin, requireDoctor } from '../middleware/authMiddleware';
import { assertCanActForPatient, assertCanViewInvoice, findInvoiceAccess } from '../services/access.service';
import { listInvoiceRefunds, requestRefund } from '../services/refund.service';
import { NotFoundError } from '../utils/errors';

const router = Router();

// Patients see their own invoices; sponsors see invoices for patients they have an active link to; staff see all.
const canActForPatientParam = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await assertCanActForPatient(req.user!, req.params.patientId);
    next();
  } catch (error) {
    next(error);
  }
};

// ── Specific / named routes MUST come before parameterized ones ──────────────

// Overdue invoices – must be before /:invoice_id to avoid route shadowing
router.get('/invoices/overdue', requireAuth, requireAdmin, InvoiceController.getOverdueInvoices);

// Patient invoices (owner or staff)
router.get('/invoices/patient/:patientId', requireAuth, canActForPatientParam, InvoiceController.getPatientInvoices);

// Generic invoice CRUD
router.post('/invoices', requireAuth, requireDoctor, InvoiceController.createInvoice);
router.get('/invoices', requireAuth, InvoiceController.listInvoices);
router.get('/invoices/:invoice_id', requireAuth, InvoiceController.getInvoice);
router.patch('/invoices/:invoice_id', requireAuth, requireDoctor, InvoiceController.updateInvoice);

// Money-changing actions: admin only. Patients pay through /payments/initiate.
router.patch('/invoices/:invoice_id/status', requireAuth, requireAdmin, InvoiceController.updateInvoiceStatus);
router.post('/invoices/:invoice_id/pay', requireAuth, requireAdmin, InvoiceController.processPayment);

router.get('/invoices/:invoice_id/download', requireAuth, InvoiceController.downloadInvoice);

// Refunds: an admin requests one; a second admin decides (see /refunds). Owners and staff can view them.
router.post('/invoices/:invoice_id/refunds', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const amount = Number(req.body?.amount);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!(amount > 0) || reason.length < 5) {
      return res.status(400).json({ success: false, message: 'amount (> 0) and reason (5+ characters) are required', requestId: req.requestId });
    }
    const refund = await requestRefund(req.user!, req.params.invoice_id, { amount, reason });
    res.status(201).json({ success: true, data: refund, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.get('/invoices/:invoice_id/refunds', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const access = await findInvoiceAccess(req.params.invoice_id);
    if (!access) throw new NotFoundError('Invoice');
    await assertCanViewInvoice(req.user!, access);
    const refunds = await listInvoiceRefunds(req.params.invoice_id);
    res.json({ success: true, data: refunds, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

export default router;
