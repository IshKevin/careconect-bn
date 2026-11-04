import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/authMiddleware';
import { z } from 'zod';
import { requestEmailVerification, confirmEmailVerification } from '../services/email-verification.service';
import { ValidationError } from '../utils/errors';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();
const authController = new AuthController();

router.post('/login', authRateLimit, authController.login.bind(authController));
router.post('/register', authRateLimit, authController.register.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.post('/forgot-password', authRateLimit, authController.forgotPassword.bind(authController));
router.post('/reset-password', authRateLimit, authController.resetPassword.bind(authController));
router.post('/change-password', authMiddleware, authController.changePassword.bind(authController));

// EML-04: email verification. Request needs sign-in; confirm uses the emailed link.
router.post('/email-verification/request', authMiddleware, async (req, res, next) => {
  try {
    const result = await requestEmailVerification(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/email-verification/confirm', authRateLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Verification token is required');
    const result = await confirmEmailVerification(parsed.data.token);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };