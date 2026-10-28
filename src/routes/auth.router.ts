import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/authMiddleware';
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

export { router as authRouter };