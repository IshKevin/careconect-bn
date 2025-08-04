import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Request ID middleware to add unique identifier to each request
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  // Check if request ID is already provided in headers
  const existingRequestId = req.get('X-Request-ID');
  
  // Generate new request ID if not provided
  const requestId = existingRequestId || uuidv4();
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  next();
};
