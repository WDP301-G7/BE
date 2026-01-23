// src/modules/auth/auth.repository.ts
import { prisma } from '../../config/database';
import { User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserData {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  address?: string;
  role?: UserRole;
  status?: UserStatus;
  storeId?: string;
}

export interface UpdateUserData {
  fullName?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  status?: UserStatus;
}

class AuthRepository {
  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by phone
   */
  async findByPhone(phone: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Create new user
   */
  async create(data: CreateUserData): Promise<User> {
    return await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        address: data.address,
        role: data.role || UserRole.CUSTOMER,
        status: data.status || UserStatus.ACTIVE,
        storeId: data.storeId,
      },
    });
  }

  /**
   * Update user by ID
   */
  async update(id: string, data: UpdateUserData): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  /**
   * Update user status
   */
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete user (soft delete if needed, or hard delete)
   */
  async delete(id: string): Promise<User> {
    // Hard delete (nếu cần soft delete, thêm deletedAt field)
    return await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * Check if phone exists
   */
  async phoneExists(phone: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { phone },
    });
    return count > 0;
  }
}

export const authRepository = new AuthRepository();
