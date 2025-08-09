import { Request, Response } from 'express';
import { DoctorService } from '../services/doctor.service';
import {
  doctorFiltersSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  createDoctorByAdminSchema,
} from '../db/schemas/doctors';
import { z } from 'zod';

// Define the AppError interface
interface AppError extends Error {
  statusCode: number;
  code: string;
  message: string;
  details?: any[] | any;
}

// Type guard for AppError
function isAppError(error: any): error is AppError {
  return (
    error != null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    'code' in error &&
    'message' in error
  );
}

// Transform Zod errors
const transformZodErrors = (errors: z.ZodIssue[]) => {
  return errors.map((error) => ({
    field: error.path.join('.'),
    message: error.message,
    code: error.code,
  }));
};

export class DoctorController {
  private doctorService: DoctorService;

  constructor() {
    this.doctorService = new DoctorService();
  }

  // Create doctor by admin
  async createDoctor(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = createDoctorByAdminSchema.parse(req.body);
      const doctor = await this.doctorService.createDoctor(data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(201)
        .json({ success: true, data: doctor, requestId: req.requestId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
      }
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // List doctors with filters
  async listDoctors(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const filters = doctorFiltersSchema.parse(req.query);
      const result = await this.doctorService.listDoctors(filters);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ 
          success: true, 
          data: result.doctors, 
          pagination: result.pagination, 
          requestId: req.requestId 
        });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
      }
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Get doctor by ID
  async getDoctor(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      const doctor = await this.doctorService.getDoctor(doctorId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: doctor, requestId: req.requestId });
    } catch (error) {
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Update doctor details
  async updateDoctor(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      const data = updateDoctorSchema.parse(req.body);
      const updated = await this.doctorService.updateDoctor(doctorId, data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: updated, requestId: req.requestId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
      }
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Update doctor status
  async updateDoctorStatus(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      const data = updateDoctorStatusSchema.parse(req.body);
      const updated = await this.doctorService.updateDoctorStatus(doctorId, data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: updated, requestId: req.requestId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
      }
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Get doctor statistics
  async getDoctorStats(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      const stats = await this.doctorService.getDoctorStats(doctorId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: stats, requestId: req.requestId });
    } catch (error) {
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Get doctor public profile
  async getDoctorProfile(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      const profile = await this.doctorService.getDoctorProfile(doctorId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: profile, requestId: req.requestId });
    } catch (error) {
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Search active doctors for patients
  async searchActiveDoctors(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const filters = doctorFiltersSchema.pick({ specialty: true, search: true, page: true, limit: true }).parse(req.query);
      const result = await this.doctorService.searchActiveDoctors(filters);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ 
          success: true, 
          data: result.doctors, 
          pagination: result.pagination, 
          requestId: req.requestId 
        });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, errors: transformZodErrors(error.errors), requestId: req.requestId });
      }
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }

  // Delete doctor (admin only)
  async deleteDoctor(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId } = req.params;
      await this.doctorService.deleteDoctor(doctorId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: { message: 'Doctor deleted successfully' }, requestId: req.requestId });
    } catch (error) {
      if (isAppError(error)) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(error.statusCode)
          .json({
            success: false,
            code: error.code,
            message: error.message,
            details: Array.isArray(error.details) ? error.details : [error.details],
            requestId: req.requestId,
          });
      }
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(500)
        .json({ success: false, message: 'Internal server error', requestId: req.requestId });
    }
  }
}
