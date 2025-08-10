import { Request, Response, NextFunction } from 'express';
import * as MiscService from '../services/misc.service';

export const getSpecialties = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const specialties = await MiscService.getSpecialties();
        res.json(specialties);
    } catch (err) {
        next(err);
    }
};

export const getTimezones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timezones = await MiscService.getTimezones();
        res.json(timezones);
    } catch (err) {
        next(err);
    }
};

export const getHealthCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const health = await MiscService.getHealth();
        res.json(health);
    } catch (err) {
        next(err);
    }
};

export const getConfiguration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await MiscService.getConfig();
        res.json(config);
    } catch (err) {
        next(err);
    }
};

export const uploadFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await MiscService.upload(req.body?.file || null);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const sendNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await MiscService.notify({
            to: req.body?.to,
            subject: req.body?.subject,
            message: req.body?.message,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
};