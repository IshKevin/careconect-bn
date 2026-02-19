import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service';

const invoiceService = new InvoiceService();

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const created = await invoiceService.createInvoice(req.body);
        res.status(201).json({ success: true, data: created, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await invoiceService.listInvoices(req.query as any);
        res.json({ success: true, data: result.invoices, pagination: result.pagination, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invoice = await invoiceService.getInvoice(req.params.invoice_id);
        res.json({ success: true, data: invoice, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await invoiceService.updateInvoice(req.params.invoice_id, req.body);
        res.json({ success: true, data: updated, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const updateInvoiceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await invoiceService.updateInvoiceStatus(req.params.invoice_id, req.body);
        res.json({ success: true, data: updated, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

/**
 * processPayment — marks invoice as paid manually (cash/card/insurance).
 * For mobile money, use the dedicated /api/v1/payments/initiate endpoint.
 */
export const processPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { invoice_id } = req.params;
        const { paymentMethod, paidAt } = req.body;

        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: 'paymentMethod is required', requestId: req.requestId });
        }

        const updated = await invoiceService.markInvoiceAsPaid(invoice_id, {
            paymentMethod,
            paidAt: paidAt ? new Date(paidAt) : undefined,
        });

        res.json({ success: true, data: updated, message: 'Invoice marked as paid', requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getPatientInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { patientId } = req.params;
        const filters = {
            invoiceStatus: req.query.invoiceStatus as any,
            startDate: req.query.startDate as string | undefined,
            endDate: req.query.endDate as string | undefined,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
        };
        const result = await invoiceService.getPatientInvoices(patientId, filters);
        res.json({ success: true, data: result.invoices, pagination: result.pagination, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getOverdueInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = {
            daysOverdue: req.query.daysOverdue ? Number(req.query.daysOverdue) : 30,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
        };
        const result = await invoiceService.getOverdueInvoices(filters);
        res.json({ success: true, data: result.invoices, pagination: result.pagination, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const downloadInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invoice = await invoiceService.getInvoiceSummary(req.params.invoice_id);

        // Return a structured JSON summary – PDF generation can be plugged in later
        res.json({
            success: true,
            data: {
                ...invoice,
                downloadNote: 'PDF generation can be added by integrating a PDF library (e.g., PDFKit or Puppeteer).',
            },
            requestId: req.requestId,
        });
    } catch (err) {
        next(err);
    }
};