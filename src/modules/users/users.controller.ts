// src/modules/users/users.controller.ts
import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { apiResponse } from '../../utils/apiResponse';
import { Role } from '../../constants/roles';
import { CreateUserInput, UpdateUserInput, GetUsersQuery } from '../../validations/zod/users.schema';

class UsersController {
  /**
   * @route   GET /api/users
   * @desc    Get all users with pagination
   * @access  Private (Admin, Manager)
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // After validation middleware, query params are already transformed
      const query = req.query as any as GetUsersQuery;

      const result = await usersService.getUsers(query);

      res.status(200).json(
        apiResponse.success(result, 'Users retrieved successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/users/:id
   * @desc    Get user by ID
   * @access  Private
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const requesterId = req.user!.userId;
      const requesterRole = req.user!.role as Role;

      const user = await usersService.getUserById(userId, requesterId, requesterRole);

      res.status(200).json(
        apiResponse.success(user, 'User retrieved successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/users
   * @desc    Create new user
   * @access  Private (Admin, Manager)
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateUserInput = req.body;
      const creatorRole = req.user!.role as Role;

      const user = await usersService.createUser(data, creatorRole);

      res.status(201).json(
        apiResponse.success(user, 'User created successfully', 201)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/users/:id
   * @desc    Update user
   * @access  Private
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const data: UpdateUserInput = req.body;
      const updaterId = req.user!.userId;
      const updaterRole = req.user!.role as Role;

      const user = await usersService.updateUser(userId, data, updaterId, updaterRole);

      res.status(200).json(
        apiResponse.success(user, 'User updated successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/users/:id
   * @desc    Delete user
   * @access  Private (Admin, Manager)
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const deleterId = req.user!.userId;
      const deleterRole = req.user!.role as Role;

      await usersService.deleteUser(userId, deleterId, deleterRole);

      res.status(200).json(
        apiResponse.success(null, 'User deleted successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/users/stats
   * @desc    Get users statistics
   * @access  Private (Admin, Manager)
   */
  async getUsersStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await usersService.getUsersStats();

      res.status(200).json(
        apiResponse.success(stats, 'Statistics retrieved successfully')
      );
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
