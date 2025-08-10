import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../services/availability.service';

const availabilityService = new AvailabilityService();

export const getDoctorAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const slots = await availabilityService.getDoctorAvailability(req.params.doctor_id);
        res.json(slots);
    } catch (err) {
        next(err);
    }
};

export const addAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const slot = await availabilityService.addAvailability({
            doctorId: req.params.doctor_id,
            ...req.body
        });
        res.status(201).json(slot);
    } catch (err) {
        next(err);
    }
};

export const updateAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await availabilityService.updateAvailability(req.params.availability_id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const updateAvailabilityStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updated = await availabilityService.updateAvailabilityStatus(req.params.availability_id, req.body.status);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

export const deleteAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await availabilityService.deleteAvailability(req.params.availability_id);
        res.json({ message: 'Availability slot removed' });
    } catch (err) {
        next(err);
    }
};

export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for getAvailableSlots logic
        res.status(501).json({ message: 'Not Implemented: getAvailableSlots' });
    } catch (err) {
        next(err);
    }
};

export const bulkUpdateAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Placeholder for bulkUpdateAvailability logic
        res.status(501).json({ message: 'Not Implemented: bulkUpdateAvailability' });
    } catch (err) {
        next(err);
    }
};