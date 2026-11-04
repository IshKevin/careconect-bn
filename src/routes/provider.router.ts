import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { getDoctorIdForUser } from '../services/access.service';
import { providerDashboard, providerPatients } from '../services/dashboard.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// Provider dashboard: a doctor sees their own practice. Admins pass ?doctorId to view any provider.
router.get('/dashboard', requireAuth, requireRole(['doctor', 'admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let doctorId: string | null = null;
    if (req.user!.userType === 'doctor') {
      doctorId = await getDoctorIdForUser(req.user!.userId);
    } else {
      doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : null;
      if (!doctorId) throw new ValidationError('doctorId is required for admin views');
    }
    if (!doctorId) throw new ValidationError('No doctor profile for this account');

    const dashboard = await providerDashboard(doctorId);
    if (!dashboard) return res.status(404).json({ success: false, message: 'Doctor not found', requestId: req.requestId });
    res.json({ success: true, data: dashboard, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// Patients under this provider's care (doctor), or any provider for admins with ?doctorId=.
router.get('/patients', requireAuth, requireRole(['doctor', 'admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let doctorId: string | null = null;
    if (req.user!.userType === 'doctor') {
      doctorId = await getDoctorIdForUser(req.user!.userId);
    } else {
      doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : null;
      if (!doctorId) throw new ValidationError('doctorId is required for admin views');
    }
    if (!doctorId) throw new ValidationError('No doctor profile for this account');
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const patients = await providerPatients(doctorId, search);
    res.json({ success: true, data: patients, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

export default router;
