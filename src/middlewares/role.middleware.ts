// src/middlewares/role.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errorHandler';
import { Role, hasPermission } from '../constants/roles';

/**
 * Role-based access control middleware
 * Checks if authenticated user has required role
 */
export const roleMiddleware = (allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const userRole = req.user.role as Role;

      if (!allowedRoles.includes(userRole)) {
        throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based access control middleware
 * Checks if authenticated user has required permission
 */
export const permissionMiddleware = (requiredPermission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const userRole = req.user.role as Role;

      if (!hasPermission(userRole, requiredPermission)) {
        throw new ForbiddenError(`Access denied. Required permission: ${requiredPermission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
