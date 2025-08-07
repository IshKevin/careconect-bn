import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import {
  userLoginSchema,
  userRegistrationSchema,
  changePasswordSchema,
  resetPasswordSchema,
  resetPasswordConfirmSchema,
} from '../db/schemas/users';
import { z, ZodIssue } from 'zod';

// Define the expected error shape for validation errors
interface ValidationErrorItem {
  field: string;
  message: string;
  code: string;
}

// Define the AppError interface (moved from errors.ts)
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

// Transform ZodIssue to ValidationErrorItem
const transformZodErrors = (errors: ZodIssue[]): ValidationErrorItem[] => {
  return errors.map((error) => ({
    field: error.path.join('.'),
    message: error.message,
    code: error.code,
  }));
};

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = userLoginSchema.parse(req.body);
      const result = await this.authService.login(data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: result, requestId: req.requestId });
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

  async register(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = userRegistrationSchema.parse(req.body);
      const result = await this.authService.register(data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(201)
        .json({ success: true, data: result, requestId: req.requestId });
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

  async logout(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, message: 'Token is required', requestId: req.requestId });
      }
      await this.authService.logout(token);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(204)
        .send();
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

  async refreshToken(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(400)
          .json({ success: false, message: 'Refresh token is required', requestId: req.requestId });
      }
      const result = await this.authService.refreshToken(refreshToken);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: result, requestId: req.requestId });
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

  async forgotPassword(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = resetPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: { message: 'Password reset email sent' }, requestId: req.requestId });
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

  async resetPassword(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = resetPasswordConfirmSchema.parse(req.body);
      await this.authService.resetPassword(data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: { message: 'Password reset successful' }, requestId: req.requestId });
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

  async changePassword(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const data = changePasswordSchema.parse(req.body);
      const userId = req.user?.userId; // Assuming userId is set by auth middleware
      if (!userId) {
        return res
          .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
          .status(401)
          .json({ success: false, message: 'Authentication required', requestId: req.requestId });
      }
      await this.authService.changePassword(userId, data);
      return res
        .setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
        .status(200)
        .json({ success: true, data: { message: 'Password changed successfully' }, requestId: req.requestId });
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
}