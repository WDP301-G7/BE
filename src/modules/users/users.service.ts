// src/modules/users/users.service.ts
import { User } from '@prisma/client';
import { usersRepository, GetUsersFilter, PaginatedUsers } from './users.repository';
import { authRepository, CreateUserData, UpdateUserData } from '../auth/auth.repository';
import { passwordService } from '../../utils/password';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../utils/errorHandler';
import { canManageRole, Role } from '../../constants/roles';
import { uploadToSupabase, deleteFromSupabase, extractPathFromUrl, validateImageFile } from '../../utils/upload';
import { notificationsService } from '../notifications/notifications.service';

class UsersService {
  /**
   * Get all users with pagination and filters
   */
  async getUsers(filter: GetUsersFilter): Promise<PaginatedUsers> {
    return await usersRepository.getUsers(filter);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string, requesterId: string, requesterRole: Role): Promise<Omit<User, 'password'>> {
    const user = await usersRepository.findByIdWithoutPassword(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Users can only view themselves unless they're admin/manager
    if (id !== requesterId && requesterRole === 'CUSTOMER') {
      throw new ForbiddenError('You can only view your own profile');
    }

    return user;
  }

  /**
   * Create new user (Admin/Manager only)
   */
  async createUser(data: CreateUserData, creatorRole: Role): Promise<Omit<User, 'password'>> {
    // Check if creator can manage the target role
    if (data.role && !canManageRole(creatorRole, data.role as Role)) {
      throw new ForbiddenError(`You cannot create users with role: ${data.role}`);
    }

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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: UpdateUserData & { role?: string; status?: string },
    updaterId: string,
    updaterRole: Role,
    avatarFile?: Express.Multer.File
  ): Promise<Omit<User, 'password'>> {
    // Get user
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check permissions
    // Users can only update themselves
    // Admin/Manager can update others based on role hierarchy
    if (id !== updaterId) {
      if (updaterRole === 'CUSTOMER') {
        throw new ForbiddenError('You can only update your own profile');
      }

      // Check if updater can manage target user's role
      if (!canManageRole(updaterRole, user.role as Role)) {
        throw new ForbiddenError(`You cannot update users with role: ${user.role}`);
      }

      // If changing role, check if updater can assign new role
      if (data.role && !canManageRole(updaterRole, data.role as Role)) {
        throw new ForbiddenError(`You cannot assign role: ${data.role}`);
      }
    } else {
      // Users cannot change their own role
      if (data.role) {
        throw new ForbiddenError('You cannot change your own role');
      }
    }

    // Handle avatar upload if provided
    let avatarUrl = data.avatarUrl;
    if (avatarFile) {
      // Validate image file
      validateImageFile(avatarFile, 2); // 2MB max for avatars

      // Delete old avatar if exists
      if (user.avatarUrl) {
        const oldPath = extractPathFromUrl(user.avatarUrl);
        if (oldPath) {
          try {
            await deleteFromSupabase(oldPath);
          } catch (error) {
            console.error('Failed to delete old avatar:', error);
            // Continue even if deletion fails
          }
        }
      }

      // Upload new avatar
      const uploadResult = await uploadToSupabase(avatarFile, 'avatars');
      avatarUrl = uploadResult.url;
    }

    // Update user with avatar URL if uploaded
    const updateData = avatarFile ? { ...data, avatarUrl } : data;
    const updatedUser = await usersRepository.update(id, updateData as any);

    // Notify user if their account status changed
    if (data.status && data.status !== user.status) {
      if (data.status === 'BANNED') {
        notificationsService.sendToUser(id, {
          type: 'ACCOUNT_BANNED',
          title: 'Tài khoản bị khóa',
          message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ để biết thêm.',
          data: {},
        });
      } else if (data.status === 'ACTIVE') {
        notificationsService.sendToUser(id, {
          type: 'ACCOUNT_ACTIVATED',
          title: 'Tài khoản đã được mở khóa',
          message: 'Tài khoản của bạn đã được mở khóa. Chào mừng bạn trở lại!',
          data: {},
        });
      }
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Delete user
   * If user has existing data (orders, reviews, etc.), ban instead of hard delete
   * to preserve referential integrity.
   */
  async deleteUser(id: string, deleterId: string, deleterRole: Role): Promise<void> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (id === deleterId) {
      throw new ForbiddenError('You cannot delete your own account');
    }

    if (!canManageRole(deleterRole, user.role as Role)) {
      throw new ForbiddenError(`You cannot delete users with role: ${user.role}`);
    }

    // Try hard delete first; if FK constraint fires, fall back to BANNED
    try {
      await usersRepository.delete(id);
    } catch (error: any) {
      const isFkViolation =
        error?.code === 'P2003' ||
        (typeof error?.message === 'string' && error.message.toLowerCase().includes('foreign key'));

      if (isFkViolation) {
        // User has related data — ban instead of delete
        await usersRepository.update(id, { status: 'BANNED' } as any);
        notificationsService.sendToUser(id, {
          type: 'ACCOUNT_BANNED',
          title: 'Tài khoản bị khóa',
          message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ để biết thêm.',
          data: {},
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get users statistics
   */
  async getUsersStats(): Promise<{
    totalUsers: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const [totalCustomers, totalStaff, totalManagers, totalAdmins, activeUsers, inactiveUsers, bannedUsers] =
      await Promise.all([
        usersRepository.countByRole('CUSTOMER'),
        usersRepository.countByRole('STAFF'),
        usersRepository.countByRole('MANAGER'),
        usersRepository.countByRole('ADMIN'),
        usersRepository.countByStatus('ACTIVE'),
        usersRepository.countByStatus('INACTIVE'),
        usersRepository.countByStatus('BANNED'),
      ]);

    return {
      totalUsers: totalCustomers + totalStaff + totalManagers + totalAdmins,
      byRole: {
        CUSTOMER: totalCustomers,
        STAFF: totalStaff,
        MANAGER: totalManagers,
        ADMIN: totalAdmins,
      },
      byStatus: {
        ACTIVE: activeUsers,
        INACTIVE: inactiveUsers,
        BANNED: bannedUsers,
      },
    };
  }
}

export const usersService = new UsersService();
