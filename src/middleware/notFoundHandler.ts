import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '@/config/logger';
import { createErrorResponse } from '@/utils/response';

// 404 Not Found handler middleware
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  // Log the 404 error
  logger.warn('Route not found', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId,
  });

  // Create error response
  const response = createErrorResponse(
    'NOT_FOUND',
    `Route ${req.method} ${req.url} not found`,
    [
      {
        method: req.method,
        path: req.url,
        suggestion: 'Check the API documentation for available endpoints',
      },
    ],
    requestId,
    'https://docs.api.healthsystem.rw/endpoints',
    'api-support@healthsystem.rw'
  );

  res.status(StatusCodes.NOT_FOUND).json(response);
};
