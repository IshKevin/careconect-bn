import { Request, Response, NextFunction } from 'express';
import * as SearchService from '../services/search.service';

export const searchDoctors = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await SearchService.searchDoctors(req.user, req.query);
        res.json(results);
    } catch (err) {
        next(err);
    }
};

export const searchAppointments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await SearchService.searchAppointments(req.user, req.query);
        res.json(results);
    } catch (err) {
        next(err);
    }
};

export const searchInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await SearchService.searchInvoices(req.user, req.query);
        res.json(results);
    } catch (err) {
        next(err);
    }
};

export const globalSearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for globalSearch logic
        res.status(501).json({ message: 'Not Implemented: globalSearch' });
    } catch (err) {
        next(err);
    }
};

export const getSearchSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getSearchSuggestions logic
        res.status(501).json({ message: 'Not Implemented: getSearchSuggestions' });
    } catch (err) {
        next(err);
    }
};

export const getSearchHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getSearchHistory logic
        res.status(501).json({ message: 'Not Implemented: getSearchHistory' });
    } catch (err) {
        next(err);
    }
};