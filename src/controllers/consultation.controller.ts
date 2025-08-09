import { Request, Response, NextFunction } from 'express';
import { ConsultationService } from '../services/consultation.service';

const consultationService = new ConsultationService();

export const createConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const created = await consultationService.createConsultation(req.user.userId, req.body);
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
};

export const listConsultations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const consultations = await consultationService.listConsultations(req.query as any);
        res.json(consultations);
    } catch (err) {
        next(err);
    }
};

export const getConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const consultation = await consultationService.getConsultation(req.params.consultation_id);
        res.json(consultation);
    } catch (err) {
        next(err);
    }
};

export const updateConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await consultationService.updateConsultation(req.params.consultation_id, req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const completeConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for completeConsultation logic
        res.status(501).json({ message: 'Not Implemented: completeConsultation' });
    } catch (err) {
        next(err);
    }
};

export const getPatientConsultationHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getPatientConsultationHistory logic
        res.status(501).json({ message: 'Not Implemented: getPatientConsultationHistory' });
    } catch (err) {
        next(err);
    }
};

export const getDoctorConsultations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getDoctorConsultations logic
        res.status(501).json({ message: 'Not Implemented: getDoctorConsultations' });
    } catch (err) {
        next(err);
    }
};

export const getConsultationSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getConsultationSummary logic
        res.status(501).json({ message: 'Not Implemented: getConsultationSummary' });
    } catch (err) {
        next(err);
    }
};