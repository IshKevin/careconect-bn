import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service';

const invoiceService = new InvoiceService();

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const created = await invoiceService.createInvoice(req.body);
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invoices = await invoiceService.listInvoices(req.query as any);
        res.json(invoices);
    } catch (err) {
        next(err);
    }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invoice = await invoiceService.getInvoice(req.params.invoice_id);
        res.json(invoice);
    } catch (err) {
        next(err);
    }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await invoiceService.updateInvoice(req.params.invoice_id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const updateInvoiceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await invoiceService.updateInvoiceStatus(req.params.invoice_id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const downloadInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Download functionality not implemented yet
        res.json({ message: 'Download functionality not implemented yet' });
    } catch (err) {
        next(err);
    }
};

export const processPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for processPayment logic
        res.status(501).json({ message: 'Not Implemented: processPayment' });
    } catch (err) {
        next(err);
    }
};

export const getPatientInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getPatientInvoices logic
        res.status(501).json({ message: 'Not Implemented: getPatientInvoices' });
    } catch (err) {
        next(err);
    }
};

export const getOverdueInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getOverdueInvoices logic
        res.status(501).json({ message: 'Not Implemented: getOverdueInvoices' });
    } catch (err) {
        next(err);
    }
};