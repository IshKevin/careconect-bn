
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import {
  UserFilters,
  UpdateUserProfile,
  UpdateUser,
  UpdateUserStatus,
  CreateUserByAdmin,
  UserType,
  AccountStatus,
} from '../db/schemas/users';

// Define the AppError interface
interface AppError extends Error {
  statusCode: number;
  code: string;
  message: string;
  details?: any[] | any;
}

// Validation Error class
class ValidationError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any[] | any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // Get current user profile
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const user = await this.userService.getMe(userId);

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Check if user exists by email or phone (public)
  checkUserExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = (req.query.email as string | undefined) || undefined;
      const phoneNumber = (req.query.phoneNumber as string | undefined) || undefined;

      if (!email && !phoneNumber) {
        throw new ValidationError('Provide at least one of email or phoneNumber');
      }

      const exists = await this.userService.checkUserExists(email, phoneNumber);

      res.status(200).json({
        success: true,
        message: 'User existence checked successfully',
        data: { exists },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get users by type (admin)
  getUsersByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userType } = req.params as { userType: string };
      if (!['patient', 'doctor', 'admin', 'super_admin'].includes(userType)) {
        throw new ValidationError('Invalid user type');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const accountStatus = req.query.accountStatus as AccountStatus | undefined;
      const search = req.query.search as string | undefined;
      const createdFrom = (req.query.createdFrom as string | undefined) || undefined;
      const createdTo = (req.query.createdTo as string | undefined) || undefined;

      const result = await this.userService.getUsersByType(userType as UserType, {
        page,
        limit,
        accountStatus,
        search,
        createdFrom,
        createdTo,
      });

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get all doctors (admin)
  getDoctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const accountStatus = req.query.accountStatus as AccountStatus | undefined;
      const search = req.query.search as string | undefined;
      const createdFrom = (req.query.createdFrom as string | undefined) || undefined;
      const createdTo = (req.query.createdTo as string | undefined) || undefined;

      const result = await this.userService.getDoctors({
        page,
        limit,
        accountStatus,
        search,
        createdFrom,
        createdTo,
      });

      res.status(200).json({
        success: true,
        message: 'Doctors retrieved successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get all patients (admin)
  getPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const accountStatus = req.query.accountStatus as AccountStatus | undefined;
      const search = req.query.search as string | undefined;
      const createdFrom = (req.query.createdFrom as string | undefined) || undefined;
      const createdTo = (req.query.createdTo as string | undefined) || undefined;

      const result = await this.userService.getPatients({
        page,
        limit,
        accountStatus,
        search,
        createdFrom,
        createdTo,
      });

      res.status(200).json({
        success: true,
        message: 'Patients retrieved successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user stats (admin)
  getUserStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.userService.getUserStats();
      res.status(200).json({
        success: true,
        message: 'User stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  // Update current user profile
  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const updateData: UpdateUserProfile = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      // Basic validation
      if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
        throw new ValidationError('Invalid email format');
      }

      if (updateData.phoneNumber && !/^\+?[\d\s-()]+$/.test(updateData.phoneNumber)) {
        throw new ValidationError('Invalid phone number format');
      }

      const user = await this.userService.updateMe(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete current user account (deactivate)
  deleteMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      await this.userService.deleteMe(userId);

      res.status(200).json({
        success: true,
        message: 'Account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get profile completeness
  getProfileCompleteness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const completeness = await this.userService.getProfileCompleteness(userId);

      res.status(200).json({
        success: true,
        message: 'Profile completeness retrieved successfully',
        data: completeness,
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin endpoints

  // Get specific user profile (admin only)
  getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      // Validate UUID format to avoid accidental matches like '/users/patient/profile'
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      const user = await this.userService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Update user profile (admin only)
  updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const updateData: UpdateUser = req.body;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Basic validation
      if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
        throw new ValidationError('Invalid email format');
      }

      if (updateData.phoneNumber && !/^\+?[\d\s-()]+$/.test(updateData.phoneNumber)) {
        throw new ValidationError('Invalid phone number format');
      }

      if (updateData.accountStatus && !['active', 'inactive', 'suspended', 'pending_verification'].includes(updateData.accountStatus)) {
        throw new ValidationError('Invalid account status');
      }

      const user = await this.userService.updateUserProfile(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'User profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Search users (admin only)
  searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userTypeParam = req.query.userType as string | undefined;
      const accountStatusParam = req.query.accountStatus as string | undefined;

      const filters: UserFilters = {
        userType:
          userTypeParam && ['patient', 'doctor', 'admin', 'super_admin'].includes(userTypeParam)
            ? (userTypeParam as UserType)
            : undefined,
        accountStatus:
          accountStatusParam && ['active', 'inactive', 'suspended', 'pending_verification'].includes(accountStatusParam)
            ? (accountStatusParam as AccountStatus)
            : undefined,
        search: req.query.search as string,
        createdFrom: (req.query.createdFrom as string | undefined) || undefined,
        createdTo: (req.query.createdTo as string | undefined) || undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      };

      // Validation
      if (filters.page && (filters.page < 1 || !Number.isInteger(filters.page))) {
        throw new ValidationError('Page must be a positive integer');
      }

      if (filters.limit && (filters.limit < 1 || filters.limit > 100 || !Number.isInteger(filters.limit))) {
        throw new ValidationError('Limit must be a positive integer between 1 and 100');
      }

      if (filters.userType && !['patient', 'doctor', 'admin', 'super_admin'].includes(filters.userType)) {
        throw new ValidationError('Invalid user type filter');
      }

      if (filters.accountStatus && !['active', 'inactive', 'suspended', 'pending_verification'].includes(filters.accountStatus)) {
        throw new ValidationError('Invalid account status filter');
      }

      const result = await this.userService.searchUsers(filters);

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // List all users (admin only)
  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: UserFilters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      };

      // Validation
      if (filters.page && (filters.page < 1 || !Number.isInteger(filters.page))) {
        throw new ValidationError('Page must be a positive integer');
      }

      if (filters.limit && (filters.limit < 1 || filters.limit > 100 || !Number.isInteger(filters.limit))) {
        throw new ValidationError('Limit must be a positive integer between 1 and 100');
      }

      const result = await this.userService.listUsers(filters);

      res.status(200).json({
        success: true,
        message: 'Users listed successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // Create user by admin
  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: CreateUserByAdmin = req.body;

      // Validation
      if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        throw new ValidationError('Valid email is required');
      }

      if (!userData.phoneNumber || !/^\+?[\d\s-()]+$/.test(userData.phoneNumber)) {
        throw new ValidationError('Valid phone number is required');
      }

      if (!userData.password || userData.password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      if (!userData.userType || !['patient', 'doctor', 'admin', 'super_admin'].includes(userData.userType)) {
        throw new ValidationError('Valid user type is required');
      }

      if (!userData.firstName || userData.firstName.trim().length === 0) {
        throw new ValidationError('First name is required');
      }

      if (!userData.lastName || userData.lastName.trim().length === 0) {
        throw new ValidationError('Last name is required');
      }

      if (userData.accountStatus && !['active', 'inactive', 'suspended', 'pending_verification'].includes(userData.accountStatus)) {
        throw new ValidationError('Invalid account status');
      }

      const user = await this.userService.createUser(userData);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Update user status (admin only)
  updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const statusData: UpdateUserStatus = req.body;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      if (!statusData.accountStatus || !['active', 'inactive', 'suspended', 'pending_verification'].includes(statusData.accountStatus)) {
        throw new ValidationError('Valid account status is required');
      }

      const user = await this.userService.updateUserStatus(userId, statusData);

      res.status(200).json({
        success: true,
        message: 'User status updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Unlock user account (admin only)
  unlockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      const user = await this.userService.unlockUser(userId);

      res.status(200).json({
        success: true,
        message: 'User account unlocked successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // Reset user password (admin only)
  resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }

      await this.userService.resetUserPassword(userId, newPassword);

      res.status(200).json({
        success: true,
        message: 'User password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete user permanently (admin only)
  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new ValidationError('User ID parameter is required');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!isUuid.test(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      await this.userService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: 'User deleted permanently',
      });
    } catch (error) {
      next(error);
    }
  };
}