import { Request, Response, NextFunction } from 'express';
import * as ReportService from '../services/report.service';

export const getOverviewMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const metrics = await ReportService.getOverviewMetrics();
        res.json(metrics);
    } catch (err) {
        next(err);
    }
};

export const getActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const logs = await ReportService.getActivityLogs(req.query);
        res.json(logs);
    } catch (err) {
        next(err);
    }
};

export const getAppointmentTrends = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const trends = await ReportService.getAppointmentTrends(req.query);
        res.json(trends);
    } catch (err) {
        next(err);
    }
};

export const getInvoiceSummaries = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const summaries = await ReportService.getInvoiceSummaries(req.query);
        res.json(summaries);
    } catch (err) {
        next(err);
    }
};

export const getFinancialReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.getFinancialReports(req.query as any);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getClinicalReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.getClinicalReports(req.query as any);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getUserActivityReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.getUserActivityReports(req.query as any);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getSystemPerformanceReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.getSystemPerformanceReports();
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const generateCustomReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.generateCustomReport(req.body);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const exportReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.exportReport(req.params.reportId);
        res.json(result);
    } catch (err) {
        next(err);
    }
};