import { Router } from 'express';
import * as InvoiceController from '../controllers/invoice.controller';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// ── Specific / named routes MUST come before parameterized ones ──────────────

// Overdue invoices – must be before /:invoice_id to avoid route shadowing
router.get('/invoices/overdue', requireAuth, requireAdmin, InvoiceController.getOverdueInvoices);

// Patient invoices
router.get('/invoices/patient/:patientId', requireAuth, InvoiceController.getPatientInvoices);

// Generic invoice CRUD
router.post('/invoices', requireAuth, InvoiceController.createInvoice);
router.get('/invoices', requireAuth, InvoiceController.listInvoices);
router.get('/invoices/:invoice_id', requireAuth, InvoiceController.getInvoice);
router.patch('/invoices/:invoice_id', requireAuth, InvoiceController.updateInvoice);
router.patch('/invoices/:invoice_id/status', requireAuth, InvoiceController.updateInvoiceStatus);
router.post('/invoices/:invoice_id/pay', requireAuth, InvoiceController.processPayment);
router.get('/invoices/:invoice_id/download', requireAuth, InvoiceController.downloadInvoice);

export default router;