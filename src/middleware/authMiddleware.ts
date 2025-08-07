import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { responseHelpers } from '../utils/responseHelpers';
import { AuthenticationError } from '../utils/errors';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; userType: string };
    req.user = { userId: decoded.userId, userType: decoded.userType };
    next();
  } catch (error) {
    return responseHelpers.unauthorized(res, new AuthenticationError('Invalid token').message, req.requestId);
  }
};

// Export alias for backward compatibility
export const requireAuth = authMiddleware;

// Role-based middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
    }

    if (!roles.includes(req.user.userType)) {
      return responseHelpers.forbidden(res, 'Insufficient permissions', req.requestId);
    }

    next();
  };
};

// Specific role middleware
export const requireAdmin = requireRole(['admin', 'super_admin']);
export const requireSuperAdmin = requireRole(['super_admin']);
export const requireDoctor = requireRole(['doctor', 'admin', 'super_admin']);
export const requirePatient = requireRole(['patient', 'doctor', 'admin', 'super_admin']);
