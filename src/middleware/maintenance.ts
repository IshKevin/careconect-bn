import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { getSettings } from '../services/settings.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Requests that must keep working during maintenance: signing in and out, and provider callbacks
// (a payment confirmed by Pesapal must still be recorded).
const ALWAYS_ALLOWED = [/\/auth\/(login|refresh|logout|forgot-password|reset-password)$/, /\/payments\/webhook\//, /\/webhooks\//];

const isAdminToken = (req: Request): boolean => {
  const header = req.header('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const decoded = jwt.verify(header.substring(7).trim(), config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as { userType?: string };
    return decoded.userType === 'admin' || decoded.userType === 'super_admin';
  } catch {
    return false;
  }
};

/** While maintenance mode is on, refuse changes from everyone except admins. Reads keep working. */
export const maintenanceGuard = async (req: Request, res: Response, next: NextFunction) => {
  if (READ_METHODS.has(req.method) || ALWAYS_ALLOWED.some((pattern) => pattern.test(req.path))) return next();

  const settings = await getSettings();
  if (!settings.maintenanceMode || isAdminToken(req)) return next();

  return res.status(503).json({
    success: false,
    error: { code: 'MAINTENANCE', message: settings.maintenanceMessage, supportContact: settings.supportEmail },
    requestId: req.requestId,
  });
};
