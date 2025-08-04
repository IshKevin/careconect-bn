import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { BaseError, isAppError, getErrorSeverity, getErrorCategory } from '@/utils/errors';
import { createErrorResponse } from '../utils/response';
// import { ValidationError } from 'express-validator'; // Not used directly

// Error handler middleware
export const errorHandler = (
  error: Error | BaseError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  // Log the error
  const errorInfo = {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };

  // Handle different types of errors
  if (isAppError(error)) {
    // Application errors
    const severity = getErrorSeverity(error);
    const category = getErrorCategory(error);
    
    logger.log(severity === 'critical' ? 'error' : 'warn', 'Application error', {
      ...errorInfo,
      severity,
      category,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      details: error.details,
    });

    const response = createErrorResponse(
      error.code,
      error.message,
      error.details ? [error.details] : undefined,
      requestId
    );

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle validation errors from express-validator
  if (error.name === 'ValidationError' || (error as any).array) {
    const validationErrors = (error as any).array ? (error as any).array() : [];
    const details = validationErrors.map((err: any) => ({
      field: err.param || err.path || err.location,
      code: err.type || 'INVALID_VALUE',
      message: err.msg,
      value: err.value,
    }));

    logger.warn('Validation error', {
      ...errorInfo,
      validationErrors: details,
    });

    const response = createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid input parameters',
      details,
      requestId
    );

    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    logger.warn('JSON parsing error', errorInfo);

    const response = createErrorResponse(
      'INVALID_JSON',
      'Invalid JSON in request body',
      undefined,
      requestId
    );

    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  // Handle database connection errors
  if (error.message.includes('connect ECONNREFUSED') || error.message.includes('Connection terminated')) {
    logger.error('Database connection error', errorInfo);

    const response = createErrorResponse(
      'DATABASE_CONNECTION_ERROR',
      'Database connection failed',
      undefined,
      requestId
    );

    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(response);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    logger.warn('JWT error', errorInfo);

    const response = createErrorResponse(
      'INVALID_TOKEN',
      'Invalid authentication token',
      undefined,
      requestId
    );

    res.status(StatusCodes.UNAUTHORIZED).json(response);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    logger.warn('JWT expired error', errorInfo);

    const response = createErrorResponse(
      'TOKEN_EXPIRED',
      'Authentication token has expired',
      undefined,
      requestId
    );

    res.status(StatusCodes.UNAUTHORIZED).json(response);
    return;
  }

  // Handle multer file upload errors
  if (error.name === 'MulterError') {
    logger.warn('File upload error', errorInfo);

    let message = 'File upload error';
    let code = 'FILE_UPLOAD_ERROR';

    switch ((error as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE';
        break;
    }

    const response = createErrorResponse(code, message, undefined, requestId);
    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  // Handle rate limiting errors
  if (error.message.includes('Too many requests')) {
    logger.warn('Rate limit error', errorInfo);

    const response = createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later',
      undefined,
      requestId
    );

    res.status(StatusCodes.TOO_MANY_REQUESTS).json(response);
    return;
  }

  // Handle CORS errors
  if (error.message.includes('CORS')) {
    logger.warn('CORS error', errorInfo);

    const response = createErrorResponse(
      'CORS_ERROR',
      'Cross-origin request blocked',
      undefined,
      requestId
    );

    res.status(StatusCodes.FORBIDDEN).json(response);
    return;
  }

  // Handle timeout errors
  if (error.message.includes('timeout') || error.name === 'TimeoutError') {
    logger.error('Request timeout error', errorInfo);

    const response = createErrorResponse(
      'REQUEST_TIMEOUT',
      'Request timeout',
      undefined,
      requestId
    );

    res.status(StatusCodes.REQUEST_TIMEOUT).json(response);
    return;
  }

  // Handle unknown/unexpected errors
  logger.error('Unexpected error', {
    ...errorInfo,
    severity: 'critical',
    category: 'unknown',
  });

  // Don't expose internal error details in production
  const message = config.env === 'production' 
    ? 'An unexpected error occurred' 
    : error.message;

  const response = createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    message,
    config.env === 'development' ? [{ stack: error.stack }] : undefined,
    requestId
  );

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Process-level error handlers
export const setupProcessErrorHandlers = (): void => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      severity: 'critical',
    });

    // Graceful shutdown
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection', {
      reason,
      promise,
      severity: 'critical',
    });

    // Graceful shutdown
    process.exit(1);
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  // Handle SIGINT
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};
