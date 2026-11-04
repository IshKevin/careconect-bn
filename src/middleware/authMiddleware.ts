import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { responseHelpers } from '../utils/responseHelpers';
import { AuthenticationError } from '../utils/errors';
import { assertCanReadMedicalRecord } from '../services/access.service';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  if (!token) {
    return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      clockTolerance: 5, // seconds
    }) as { userId: string; userType: string; iss?: string; aud?: string };

    if (!decoded.userId || !decoded.userType) {
      return responseHelpers.unauthorized(res, new AuthenticationError('Invalid token payload').message, req.requestId);
    }

    req.user = { userId: decoded.userId, userType: decoded.userType };
    next();
  } catch (error: any) {
    const message = error?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return responseHelpers.unauthorized(res, new AuthenticationError(message).message, req.requestId);
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

// The route parameter must be the signed-in user's own id (for writes to a user's own record).
export const requireSelfParam = (param: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
    }

    if (req.params[param] !== req.user.userId) {
      return responseHelpers.forbidden(res, 'You can only change your own record', req.requestId);
    }

    next();
  };
};

// Medical records are readable only with a care relationship, staff role, patient self, or sponsor medical consent.
export const requireMedicalAccess = (param: string = 'userId') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }
      await assertCanReadMedicalRecord(req.user, req.params[param]);
      next();
    } catch (error) {
      next(error);
    }
  };
};
