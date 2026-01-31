// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { apiResponse } from '../../utils/apiResponse';
import { RegisterInput, LoginInput, ChangePasswordInput, GoogleLoginInput } from '../../validations/zod/auth.schema';

class AuthController {
  /**
   * @route   POST /api/auth/register
   * @desc    Register new user
   * @access  Public
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: RegisterInput = req.body;

      const result = await authService.register(data);

      res.status(201).json(
        apiResponse.success(result, 'User registered successfully', 201)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/login
   * @desc    Login user
   * @access  Public
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password }: LoginInput = req.body;

      const result = await authService.login(email, password);

      res.status(200).json(
        apiResponse.success(result, 'Login successful')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/google
   * @desc    Login with Google
   * @access  Public
   */
  async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential }: GoogleLoginInput = req.body;

      const result = await authService.loginWithGoogle(credential);

      res.status(200).json(
        apiResponse.success(result, 'Google login successful')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/refresh
   * @desc    Refresh access token
   * @access  Public
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const tokens = await authService.refreshToken(refreshToken);

      res.status(200).json(
        apiResponse.success(tokens, 'Token refreshed successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/auth/profile
   * @desc    Get current user profile
   * @access  Private
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await authService.getProfile(userId);

      res.status(200).json(
        apiResponse.success(user, 'Profile retrieved successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/change-password
   * @desc    Change user password
   * @access  Private
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { oldPassword, newPassword }: ChangePasswordInput = req.body;

      await authService.changePassword(userId, oldPassword, newPassword);

      res.status(200).json(
        apiResponse.success(null, 'Password changed successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/auth/logout
   * @desc    Logout user
   * @access  Private
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      await authService.logout(userId);

      res.status(200).json(
        apiResponse.success(null, 'Logout successful')
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
