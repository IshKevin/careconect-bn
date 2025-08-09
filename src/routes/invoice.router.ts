import { Router } from 'express';
import * as InvoiceController from '../controllers/invoice.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/invoices', requireAuth, InvoiceController.createInvoice);
router.get('/invoices', requireAuth, InvoiceController.listInvoices);
router.get('/invoices/:invoice_id', requireAuth, InvoiceController.getInvoice);
router.patch('/invoices/:invoice_id', requireAuth, InvoiceController.updateInvoice);
router.patch('/invoices/:invoice_id/status', requireAuth, InvoiceController.updateInvoiceStatus);
router.get('/invoices/:invoice_id/download', requireAuth, InvoiceController.downloadInvoice);

router.post('/invoices/:invoiceId/pay', requireAuth, InvoiceController.processPayment);
router.get('/invoices/patient/:patientId', requireAuth, InvoiceController.getPatientInvoices);
router.get('/invoices/overdue', requireAuth, InvoiceController.getOverdueInvoices);

export default router;