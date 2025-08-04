import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { responseHelpers } from '../utils/response';
import { logger } from '../config/logger';

// Validation middleware to handle express-validator results
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = (req as any).requestId || '';
    
    // Format validation errors
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : error.type,
      code: error.type || 'INVALID_VALUE',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));
    
    // Log validation errors
    logger.warn('Validation failed', {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: (req as any).user?.userId,
      errors: formattedErrors,
    });
    
    // Return validation error response
    responseHelpers.validationError(res, formattedErrors, requestId);
    return;
  }
  
  next();
};

// Wrapper to run validation chains and handle results
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    validateRequest(req, res, next);
  };
};

// Custom validation helpers
export const validationHelpers = {
  // Check if value is a valid UUID
  isUUID: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  // Check if value is a valid email
  isEmail: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // Check if value is a valid phone number (Rwanda format)
  isRwandaPhone: (value: string): boolean => {
    // Rwanda phone numbers: +250XXXXXXXXX or 07XXXXXXXX or 08XXXXXXXX
    const phoneRegex = /^(\+250|0)[78]\d{8}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  },

  // Check if value is a valid date
  isValidDate: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  // Check if date is in the past
  isPastDate: (value: string): boolean => {
    const date = new Date(value);
    return date < new Date();
  },

  // Check if date is in the future
  isFutureDate: (value: string): boolean => {
    const date = new Date(value);
    return date > new Date();
  },

  // Check if value is a valid time format (HH:MM)
  isValidTime: (value: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(value);
  },

  // Check if value is a valid password
  isStrongPassword: (value: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(value);
  },

  // Check if value is a valid national ID (Rwanda format)
  isRwandaNationalId: (value: string): boolean => {
    // Rwanda National ID: 16 digits
    const nationalIdRegex = /^\d{16}$/;
    return nationalIdRegex.test(value);
  },

  // Check if value is a valid medical license number
  isMedicalLicense: (value: string): boolean => {
    // Rwanda medical license format (example: MD/2023/001234)
    const licenseRegex = /^MD\/\d{4}\/\d{6}$/;
    return licenseRegex.test(value);
  },

  // Check if value is within allowed file size
  isValidFileSize: (size: number, maxSize: number): boolean => {
    return size <= maxSize;
  },

  // Check if file type is allowed
  isAllowedFileType: (mimeType: string, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(mimeType);
  },

  // Check if value is a valid currency amount
  isValidAmount: (value: number): boolean => {
    return value >= 0 && Number.isFinite(value);
  },

  // Check if value is a valid percentage
  isValidPercentage: (value: number): boolean => {
    return value >= 0 && value <= 100;
  },

  // Check if value is a valid rating (1-5)
  isValidRating: (value: number): boolean => {
    return Number.isInteger(value) && value >= 1 && value <= 5;
  },

  // Check if value is a valid blood pressure
  isValidBloodPressure: (systolic: number, diastolic: number): boolean => {
    return (
      systolic >= 70 && systolic <= 250 &&
      diastolic >= 40 && diastolic <= 150 &&
      systolic > diastolic
    );
  },

  // Check if value is a valid heart rate
  isValidHeartRate: (value: number): boolean => {
    return value >= 30 && value <= 220;
  },

  // Check if value is a valid temperature (Celsius)
  isValidTemperature: (value: number): boolean => {
    return value >= 30 && value <= 45;
  },

  // Check if value is a valid weight (kg)
  isValidWeight: (value: number): boolean => {
    return value >= 0.5 && value <= 500;
  },

  // Check if value is a valid height (cm)
  isValidHeight: (value: number): boolean => {
    return value >= 30 && value <= 250;
  },

  // Check if value is a valid BMI
  isValidBMI: (value: number): boolean => {
    return value >= 10 && value <= 50;
  },

  // Check if value is a valid oxygen saturation
  isValidOxygenSaturation: (value: number): boolean => {
    return value >= 70 && value <= 100;
  },

  // Check if value is a valid pain scale (0-10)
  isValidPainScale: (value: number): boolean => {
    return Number.isInteger(value) && value >= 0 && value <= 10;
  },

  // Sanitize string input
  sanitizeString: (value: string): string => {
    return value.trim().replace(/[<>]/g, '');
  },

  // Normalize phone number to Rwanda format
  normalizeRwandaPhone: (value: string): string => {
    const cleaned = value.replace(/\s/g, '');
    if (cleaned.startsWith('+250')) {
      return cleaned;
    }
    if (cleaned.startsWith('0')) {
      return '+250' + cleaned.substring(1);
    }
    return '+250' + cleaned;
  },

  // Normalize email to lowercase
  normalizeEmail: (value: string): string => {
    return value.toLowerCase().trim();
  },
};
