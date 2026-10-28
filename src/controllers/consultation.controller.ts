import { Request, Response, NextFunction } from 'express';
import { ConsultationService } from '../services/consultation.service';
import { videoService } from '../services/video.service';

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

// completeConsultation removed as createConsultation handles "completing" the medical interaction by creating the record

export const getPatientConsultationHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const history = await consultationService.getPatientConsultationHistory(req.params.patientId, {
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
            includeNotes: req.query.includeNotes === 'true'
        });
        res.json(history);
    } catch (err) {
        next(err);
    }
};

export const getDoctorConsultations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const history = await consultationService.getDoctorConsultations(req.params.doctorId, {
            startDate: req.query.startDate as string,
            endDate: req.query.endDate as string,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10
        });
        res.json(history);
    } catch (err) {
        next(err);
    }
};

export const getConsultationSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const summary = await consultationService.getConsultationSummary(req.params.consultation_id);
        res.json(summary);
    } catch (err) {
        next(err);
    }
};

export const joinVideoCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const joined = await videoService.joinConsultation(req.params.appointmentId, req.user);
        res.json({ success: true, data: joined, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};