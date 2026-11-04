import { Request, Response } from 'express';
import { AppointmentService } from '../services/appointment.service';
import {
  appointmentFiltersSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  bookAppointmentSchema,
  rescheduleAppointmentSchema,
} from '../db/schemas/appointments';
import { z } from 'zod';
import { assertCanActForPatient, assertEmailVerified } from '../services/access.service';

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

export class AppointmentController {
  private appointmentService: AppointmentService;

  constructor() {
    this.appointmentService = new AppointmentService();
  }

  // Book appointment (patient)
  async bookAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = bookAppointmentSchema.parse(req.body);
      // A sponsor books for a linked patient; a patient books for themselves (or a patient they sponsor).
      const { patientUserId } = z.object({ patientUserId: z.string().uuid().optional() }).parse(req.body);
      const targetPatientId = patientUserId ?? req.user!.userId;
      await assertEmailVerified(req.user!.userId);
      await assertCanActForPatient(req.user!, targetPatientId);
      const appointment = await this.appointmentService.bookAppointment(targetPatientId, data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(201)
        .json({ success: true, data: appointment, requestId: req.requestId });
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

  // List appointments
  async listAppointments(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const filters = appointmentFiltersSchema.parse(req.query);
      const result = await this.appointmentService.listAppointments(filters);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ 
          success: true, 
          data: result.appointments, 
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

  // Get appointment by ID
  async getAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      const appointment = await this.appointmentService.getAppointment(appointmentId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: appointment, requestId: req.requestId });
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

  // Update appointment
  async updateAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      const data = updateAppointmentSchema.parse(req.body);
      const updated = await this.appointmentService.updateAppointment(appointmentId, data);
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

  // Update appointment status
  async updateAppointmentStatus(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      const data = updateAppointmentStatusSchema.parse(req.body);
      const updated = await this.appointmentService.updateAppointmentStatus(appointmentId, data);
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

  // Reschedule appointment
  async rescheduleAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      const data = rescheduleAppointmentSchema.parse(req.body);
      const updated = await this.appointmentService.rescheduleAppointment(appointmentId, data);
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

  // Cancel appointment
  async cancelAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      const updated = await this.appointmentService.cancelAppointment(appointmentId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: updated, requestId: req.requestId });
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

  // Get available time slots
  async getAvailableTimeSlots(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { doctorId, date } = req.params;
      const slots = await this.appointmentService.getAvailableTimeSlots(doctorId, date);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: slots, requestId: req.requestId });
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

  // Get patient appointments
  async getMyAppointments(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const filters = appointmentFiltersSchema.pick({ appointmentStatus: true, startDate: true, endDate: true, page: true, limit: true }).parse(req.query);
      const result = await this.appointmentService.getPatientAppointments(req.user!.userId, filters);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ 
          success: true, 
          data: result.appointments, 
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

  // Delete appointment (admin only)
  async deleteAppointment(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { appointmentId } = req.params;
      await this.appointmentService.deleteAppointment(appointmentId);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: { message: 'Appointment deleted successfully' }, requestId: req.requestId });
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
