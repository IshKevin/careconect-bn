import { globalSearch as globalSearchService, getSearchSuggestions as getSearchSuggestionsService } from '../services/search.service';
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
        const term = String(req.query.q ?? '').trim();
        if (term.length < 2) {
            return res.status(400).json({ success: false, message: 'Search term must be at least 2 characters' });
        }
        const results = await globalSearchService(term, req.user);
        res.json({ success: true, data: results, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getSearchSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const term = String(req.query.q ?? '').trim();
        if (term.length < 2) {
            return res.json({ success: true, data: { specialties: [], doctors: [] }, requestId: req.requestId });
        }
        const suggestions = await getSearchSuggestionsService(term);
        res.json({ success: true, data: suggestions, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};

export const getSearchHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Search history is not stored yet (no table). Returns an empty list until it is added.
        res.json({ success: true, data: [], requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};