import { Request, Response, NextFunction } from 'express';
import * as AdminService from '../services/admin.service';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await AdminService.listUsers(req.query);
        res.json(users);
    } catch (err) {
        next(err);
    }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await AdminService.getUser(req.params.user_id);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await AdminService.updateUser(req.params.user_id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await AdminService.updateUserStatus(req.params.user_id, req.body.status);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AdminService.deleteUser(req.params.user_id);
        res.json({ message: 'User deleted' });
    } catch (err) {
        next(err);
    }
};

export const getSystemMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getSystemMetrics logic
        res.status(501).json({ message: 'Not Implemented: getSystemMetrics' });
    } catch (err) {
        next(err);
    }
};

export const updateSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for updateSystemSettings logic
        res.status(501).json({ message: 'Not Implemented: updateSystemSettings' });
    } catch (err) {
        next(err);
    }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getAuditLogs logic
        res.status(501).json({ message: 'Not Implemented: getAuditLogs' });
    } catch (err) {
        next(err);
    }
};

export const triggerReportGeneration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for triggerReportGeneration logic
        res.status(501).json({ message: 'Not Implemented: triggerReportGeneration' });
    } catch (err) {
        next(err);
    }
};