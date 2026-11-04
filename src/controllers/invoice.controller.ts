import { generateInvoiceSchema } from '../db/schemas/invoices';
import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { AuthorizationError } from '../utils/errors';
import { assertCanActForPatient, assertCanViewInvoice, findInvoiceAccess, getDoctorIdForUser } from '../services/access.service';
import { NotFoundError } from '../utils/errors';
import { renderInvoicePdf } from '../services/invoice-pdf.service';

const invoiceService = new InvoiceService();

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = generateInvoiceSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                errors: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message, code: e.code })),
                requestId: req.requestId,
            });
        }
        const created = await invoiceService.createInvoice(parsed.data, req.user);
        res.status(201).json({ success: true, data: created, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};


export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = { ...(req.query as any) };
        const user = req.user!;
        if (user.userType === 'patient' || user.userType === 'sponsor') {
            // Patients see their own invoices; sponsors must name a patient they have an active link to.
            const patientId = filters.patientId ?? (user.userType === 'patient' ? user.userId : undefined);
            if (!patientId) throw new AuthorizationError('patientId is required');
            await assertCanActForPatient(user, patientId);
            filters.patientId = patientId;
        } else if (user.userType === 'doctor') {
            const doctorId = await getDoctorIdForUser(user.userId);
            if (!doctorId) throw new AuthorizationError('No doctor profile for this account');
            filters.doctorId = doctorId;
        }
        const result = await invoiceService.listInvoices(filters);
        res.json({ success: true, data: result.invoices, pagination: result.pagination, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const invoice = await invoiceService.getInvoice(req.params.invoice_id);
        await assertCanViewInvoice(req.user!, invoice);
        res.json({ success: true, data: invoice, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // A doctor may edit only invoices they issued. Staff may edit any invoice.
        const access = await findInvoiceAccess(req.params.invoice_id);
        if (!access) throw new NotFoundError('Invoice');
        if (req.user?.userType === 'doctor') {
            const doctorId = await getDoctorIdForUser(req.user.userId);
            if (!doctorId || doctorId !== access.doctorId) {
                throw new AuthorizationError('Doctors can only edit invoices they issued');
            }
        }
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
        const owner = await invoiceService.getInvoice(req.params.invoice_id);
        await assertCanViewInvoice(req.user!, owner);
        const invoice = await invoiceService.getInvoiceSummary(req.params.invoice_id);
        const pdf = await renderInvoicePdf(invoice);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
        res.setHeader('Content-Length', pdf.length.toString());
        res.send(pdf);
    } catch (err) {
        next(err);
    }
};