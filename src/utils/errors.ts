import { StatusCodes } from 'http-status-codes';
import { AppError } from '../types';

// Base application error class
export class BaseError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
export class ValidationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(message, StatusCodes.UNAUTHORIZED, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access denied') {
    super(message, StatusCodes.FORBIDDEN, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ConflictError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, StatusCodes.TOO_MANY_REQUESTS, 'RATE_LIMIT_ERROR');
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR', true, details);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      `External service error (${service}): ${message}`,
      StatusCodes.BAD_GATEWAY,
      'EXTERNAL_SERVICE_ERROR',
      true,
      details
    );
  }
}

export class PaymentError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.PAYMENT_REQUIRED, 'PAYMENT_ERROR', true, details);
  }
}

export class FileUploadError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'FILE_UPLOAD_ERROR', true, details);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'BUSINESS_LOGIC_ERROR', true, details);
  }
}

// Medical-specific errors
export class MedicalRecordError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'MEDICAL_RECORD_ERROR', true, details);
  }
}

export class AppointmentError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'APPOINTMENT_ERROR', true, details);
  }
}

export class PrescriptionError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'PRESCRIPTION_ERROR', true, details);
  }
}

// Security-specific errors
export class SecurityError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, 'SECURITY_ERROR', true, details);
  }
}

export class MfaError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.UNAUTHORIZED, 'MFA_ERROR', true, details);
  }
}

export class SessionError extends BaseError {
  constructor(message: string = 'Session expired or invalid') {
    super(message, StatusCodes.UNAUTHORIZED, 'SESSION_ERROR');
  }
}

// Compliance-specific errors
export class ComplianceError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, 'COMPLIANCE_ERROR', true, details);
  }
}

export class DataPrivacyError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, 'DATA_PRIVACY_ERROR', true, details);
  }
}

// Error factory functions
export const createValidationError = (field: string, message: string, value?: unknown): ValidationError => {
  return new ValidationError(`Validation failed for field '${field}': ${message}`, {
    field,
    message,
    value,
  });
};

export const createNotFoundError = (resource: string, identifier?: string): NotFoundError => {
  const message = identifier 
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;
  return new NotFoundError(message);
};

export const createConflictError = (resource: string, field: string, value: string): ConflictError => {
  return new ConflictError(`${resource} with ${field} '${value}' already exists`);
};

export const createBusinessLogicError = (operation: string, reason: string): BusinessLogicError => {
  return new BusinessLogicError(`Cannot ${operation}: ${reason}`);
};

// Error type guards
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof BaseError;
};

export const isOperationalError = (error: unknown): boolean => {
  return isAppError(error) && error.isOperational;
};

// Error severity levels
export const getErrorSeverity = (error: AppError): 'low' | 'medium' | 'high' | 'critical' => {
  if (error.statusCode >= 500) return 'critical';
  if (error.statusCode >= 400) return 'medium';
  if (error.statusCode >= 300) return 'low';
  return 'low';
};

// Error categorization
export const getErrorCategory = (error: AppError): string => {
  if (error instanceof ValidationError) return 'validation';
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) return 'security';
  if (error instanceof DatabaseError) return 'database';
  if (error instanceof ExternalServiceError) return 'external_service';
  if (error instanceof PaymentError) return 'payment';
  if (error instanceof MedicalRecordError || error instanceof AppointmentError || error instanceof PrescriptionError) return 'medical';
  if (error instanceof ComplianceError || error instanceof DataPrivacyError) return 'compliance';
  return 'general';
};
