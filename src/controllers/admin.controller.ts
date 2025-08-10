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
        const metrics = await AdminService.getSystemMetrics();
        res.json(metrics);
    } catch (err) {
        next(err);
    }
};

export const updateSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await AdminService.updateSystemSettings(req.body);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const logs = await AdminService.getAuditLogs(req.query);
        res.json(logs);
    } catch (err) {
        next(err);
    }
};

export const triggerReportGeneration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await AdminService.triggerReportGeneration(req.body);
        res.json(job);
    } catch (err) {
        next(err);
    }
};