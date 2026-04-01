// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errorHandler';
import { tokenService } from '../utils/token';
import { prisma } from '../config/database';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware - Verifies JWT token and checks user status
 */
export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = tokenService.verifyAccessToken(token);

    // Check user status in DB — reject if BANNED or INACTIVE
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { status: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedError('Tài khoản chưa được kích hoạt.');
    }

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
