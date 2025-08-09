import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/authMiddleware';
import { requireOwnershipOrAdmin } from '../middleware/roleMiddleware';

const router = Router();
const userController = new UserController();

// Current user profile endpoints
router.get('/profile', requireAuth, userController.getMe.bind(userController));
router.put('/profile', requireAuth, userController.updateMe.bind(userController));
router.delete('/profile', requireAuth, userController.deleteMe.bind(userController));

// Profile completeness check
router.get('/profile/completeness', requireAuth, userController.getProfileCompleteness.bind(userController));

// User existence check (public endpoint for registration validation)
router.get('/exists', userController.checkUserExists.bind(userController));

// Admin endpoints - User management
router.get('/search', requireAuth, requireAdmin, userController.searchUsers.bind(userController));
router.get('/list', requireAuth, requireAdmin, userController.listUsers.bind(userController));
router.post('/', requireAuth, requireAdmin, userController.createUser.bind(userController));

// Get users by type (useful for getting all doctors or patients)
router.get('/type/:userType', requireAuth, requireAdmin, userController.getUsersByType.bind(userController));
router.get('/doctors', requireAuth, requireAdmin, userController.getDoctors.bind(userController));
router.get('/patients', requireAuth, requireAdmin, userController.getPatients.bind(userController));

// User statistics (admin dashboard)
router.get('/stats', requireAuth, requireAdmin, userController.getUserStats.bind(userController));

// Specific user management (admin)
router.get('/:userId/profile', requireAuth, requireAdmin, userController.getUserProfile.bind(userController));
router.put('/:userId/profile', requireAuth, requireAdmin, userController.updateUserProfile.bind(userController));
router.put('/:userId/status', requireAuth, requireAdmin, userController.updateUserStatus.bind(userController));
router.post('/:userId/unlock', requireAuth, requireAdmin, userController.unlockUser.bind(userController));
router.post('/:userId/reset-password', requireAuth, requireSuperAdmin, userController.resetUserPassword.bind(userController));
router.delete('/:userId', requireAuth, requireSuperAdmin, userController.deleteUser.bind(userController));

// Legacy endpoints for backward compatibility
router.get('/me', requireAuth, userController.getMe.bind(userController));
router.patch('/me', requireAuth, userController.updateMe.bind(userController));
router.delete('/me', requireAuth, userController.deleteMe.bind(userController));

export default router;