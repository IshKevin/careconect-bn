import { Request, Response, NextFunction } from 'express';
import { ConsultationService } from '../services/consultation.service';
import { videoService } from '../services/video.service';
import {
  assertCanActForPatient,
  assertCanReadMedicalRecord,
  assertCanViewConsultation,
  getDoctorIdForUser,
} from '../services/access.service';
import { AuthorizationError } from '../utils/errors';

const isStaff = (userType: string) => userType === 'admin' || userType === 'super_admin';

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
        const filters: any = { ...(req.query as any) };
        const user = req.user!;
        if (user.userType === 'patient' || user.userType === 'sponsor') {
            // Patients and sponsors list consultations only for a patient they may read.
            const patientId = filters.patientId ?? (user.userType === 'patient' ? user.userId : undefined);
            if (!patientId) throw new AuthorizationError('patientId is required');
            await assertCanReadMedicalRecord(user, patientId);
            filters.patientId = patientId;
        } else if (user.userType === 'doctor') {
            const doctorId = await getDoctorIdForUser(user.userId);
            if (!doctorId) throw new AuthorizationError('No doctor profile for this account');
            filters.doctorId = doctorId;
        }
        const consultations = await consultationService.listConsultations(filters);
        res.json(consultations);
    } catch (err) {
        next(err);
    }
};

export const getConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const consultation = await consultationService.getConsultation(req.params.consultation_id);
        await assertCanViewConsultation(req.user!, consultation);
        res.json(consultation);
    } catch (err) {
        next(err);
    }
};

export const updateConsultation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const current = await consultationService.getConsultation(req.params.consultation_id);
        const doctorId = await getDoctorIdForUser(req.user!.userId);
        if (!isStaff(req.user!.userType) && doctorId !== current.doctorId) {
            throw new AuthorizationError('Only the treating doctor can update this consultation');
        }
        const updated = await consultationService.updateConsultation(req.params.consultation_id, req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

// completeConsultation removed as createConsultation handles "completing" the medical interaction by creating the record

export const getPatientConsultationHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await assertCanReadMedicalRecord(req.user!, req.params.patientId);
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
        if (!isStaff(req.user!.userType)) {
            const ownDoctorId = req.user!.userType === 'doctor' ? await getDoctorIdForUser(req.user!.userId) : null;
            if (!ownDoctorId || ownDoctorId !== req.params.doctorId) {
                throw new AuthorizationError('You can only view your own consultations');
            }
        }
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
        const consultation = await consultationService.getConsultation(req.params.consultation_id);
        await assertCanViewConsultation(req.user!, consultation);
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