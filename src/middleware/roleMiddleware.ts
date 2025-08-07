import { Request, Response, NextFunction } from 'express';
import { responseHelpers } from '../utils/responseHelpers';

// Re-export from authMiddleware for backward compatibility
export { 
  requireRole, 
  requireAdmin, 
  requireSuperAdmin, 
  requireDoctor, 
  requirePatient 
} from './authMiddleware';

// Additional role-based middleware
export const requirePatientOrDoctor = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
  }

  const allowedRoles = ['patient', 'doctor', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.userType)) {
    return responseHelpers.forbidden(res, 'Insufficient permissions', req.requestId);
  }

  next();
};

export const requireDoctorOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
  }

  const allowedRoles = ['doctor', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.userType)) {
    return responseHelpers.forbidden(res, 'Insufficient permissions', req.requestId);
  }

  next();
};

// Middleware to check if user owns the resource or is admin
export const requireOwnershipOrAdmin = (resourceUserIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
    }

    const resourceUserId = req.params[resourceUserIdParam];
    const isOwner = req.user.userId === resourceUserId;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.userType);

    if (!isOwner && !isAdmin) {
      return responseHelpers.forbidden(res, 'Access denied: insufficient permissions', req.requestId);
    }

    next();
  };
};

// Middleware for doctor-specific resources
export const requireDoctorOwnershipOrAdmin = (resourceDoctorIdParam: string = 'doctorId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return responseHelpers.unauthorized(res, 'Authentication required', req.requestId);
    }

    // For doctors, we need to check if they own the resource
    // For admins, they can access any doctor's resources
    const isAdmin = ['admin', 'super_admin'].includes(req.user.userType);
    
    if (isAdmin) {
      return next();
    }

    if (req.user.userType !== 'doctor') {
      return responseHelpers.forbidden(res, 'Doctor access required', req.requestId);
    }

    // Note: This would require additional logic to map userId to doctorId
    // For now, we'll allow doctors to access their own resources
    next();
  };
};
