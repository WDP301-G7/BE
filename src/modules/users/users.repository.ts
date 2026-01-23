// src/modules/users/users.repository.ts
import { prisma } from '../../config/database';
import { User, UserRole, UserStatus, Prisma } from '@prisma/client';

export interface GetUsersFilter {
  page: number;
  limit: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  storeId?: string;
}

export interface PaginatedUsers {
  users: Omit<User, 'password'>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class UsersRepository {
  /**
   * Get all users with pagination and filters
   * Using Prisma for simple query
   */
  async getUsers(filter: GetUsersFilter): Promise<PaginatedUsers> {
    const { page, limit, role, status, search, storeId } = filter;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (storeId) {
      where.storeId = storeId;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // Get users and total count in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          storeId: true,
          address: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user by ID
   */
  async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Get user by ID without password
   */
  async findByIdWithoutPassword(id: string): Promise<Omit<User, 'password'> | null> {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        storeId: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<User> {
    return await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<Omit<User, 'password'>[]> {
    return await prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        storeId: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get users by store
   */
  async getUsersByStore(storeId: string): Promise<Omit<User, 'password'>[]> {
    return await prisma.user.findMany({
      where: { storeId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        storeId: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count users by role
   */
  async countByRole(role: UserRole): Promise<number> {
    return await prisma.user.count({
      where: { role },
    });
  }

  /**
   * Count users by status
   */
  async countByStatus(status: UserStatus): Promise<number> {
    return await prisma.user.count({
      where: { status },
    });
  }
}

export const usersRepository = new UsersRepository();
