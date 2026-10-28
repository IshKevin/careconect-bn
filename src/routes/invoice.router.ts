import { Router, Request, Response, NextFunction } from 'express';
import * as InvoiceController from '../controllers/invoice.controller';
import { requireAuth, requireAdmin, requireDoctor } from '../middleware/authMiddleware';
import { AuthorizationError } from '../utils/errors';

const router = Router();

// A patient may read only their own invoices. Doctors, admins, and super admins are not limited here.
const ownPatientOrStaff = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.userType === 'patient' && req.user.userId !== req.params.patientId) {
    return next(new AuthorizationError('You can only view your own invoices'));
  }
  next();
};

// ── Specific / named routes MUST come before parameterized ones ──────────────

// Overdue invoices – must be before /:invoice_id to avoid route shadowing
router.get('/invoices/overdue', requireAuth, requireAdmin, InvoiceController.getOverdueInvoices);

// Patient invoices (owner or staff)
router.get('/invoices/patient/:patientId', requireAuth, ownPatientOrStaff, InvoiceController.getPatientInvoices);

// Generic invoice CRUD
router.post('/invoices', requireAuth, requireDoctor, InvoiceController.createInvoice);
router.get('/invoices', requireAuth, InvoiceController.listInvoices);
router.get('/invoices/:invoice_id', requireAuth, InvoiceController.getInvoice);
router.patch('/invoices/:invoice_id', requireAuth, requireDoctor, InvoiceController.updateInvoice);

// Money-changing actions: admin only. Patients pay through /payments/initiate.
router.patch('/invoices/:invoice_id/status', requireAuth, requireAdmin, InvoiceController.updateInvoiceStatus);
router.post('/invoices/:invoice_id/pay', requireAuth, requireAdmin, InvoiceController.processPayment);

router.get('/invoices/:invoice_id/download', requireAuth, InvoiceController.downloadInvoice);

export default router;
