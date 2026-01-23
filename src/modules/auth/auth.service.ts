// src/modules/auth/auth.service.ts
import { User } from '@prisma/client';
import { authRepository, CreateUserData } from './auth.repository';
import { passwordService } from '../../utils/password';
import { tokenService } from '../../utils/token';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from '../../utils/errorHandler';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  tokens: AuthTokens;
}

class AuthService {
  /**
   * Register new user
   */
  async register(data: CreateUserData): Promise<AuthResponse> {
    // Check if email already exists
    const existingEmail = await authRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    // Check if phone already exists
    if (data.phone) {
      const existingPhone = await authRepository.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictError('Phone number already registered');
      }
    }

    // Validate password strength
    const passwordValidation = passwordService.validateStrength(data.password);
    if (!passwordValidation.isValid) {
      throw new BadRequestError('Weak password', passwordValidation.errors);
    }

    // Hash password
    const hashedPassword = await passwordService.hash(data.password);

    // Create user
    const user = await authRepository.create({
      ...data,
      password: hashedPassword,
    });

    // Generate tokens
    const tokens = tokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    // Find user by email
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(`Account is ${user.status.toLowerCase()}`);
    }

    // Verify password
    const isPasswordValid = await passwordService.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = tokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = tokenService.verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      const user = await authRepository.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedError('Account is not active');
      }

      // Generate new tokens
      const tokens = tokenService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await passwordService.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedError('Old password is incorrect');
    }

    // Check if new password is same as old
    if (oldPassword === newPassword) {
      throw new BadRequestError('New password must be different from old password');
    }

    // Validate new password strength
    const passwordValidation = passwordService.validateStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestError('Weak password', passwordValidation.errors);
    }

    // Hash new password
    const hashedPassword = await passwordService.hash(newPassword);

    // Update password
    await authRepository.updatePassword(userId, hashedPassword);
  }

  /**
   * Logout (can be extended to blacklist tokens)
   */
  async logout(userId: string): Promise<void> {
    // TODO: Implement token blacklisting if needed
    // For now, just validate user exists
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
  }
}

export const authService = new AuthService();
