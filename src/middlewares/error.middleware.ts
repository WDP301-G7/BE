// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler';
import { apiResponse } from '../utils/apiResponse';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let details: unknown = undefined;

  // Handle AppError (custom errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.code;
    details = err.details;
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
    details = err.errors.map((error) => ({
      path: error.path.join('.'),
      message: error.message,
    }));
  }
  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    errorCode = 'DATABASE_ERROR';

    switch (err.code) {
      case 'P2002':
        message = 'Unique constraint violation';
        details = { field: err.meta?.target };
        statusCode = 409;
        errorCode = 'CONFLICT';
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        break;
      case 'P2003':
        message = 'Foreign key constraint violation';
        break;
      default:
        message = 'Database operation failed';
    }
  }
  // Handle Prisma validation errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    errorCode = 'VALIDATION_ERROR';
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      statusCode,
      errorCode,
    });
  }

  // Send error response
  res.status(statusCode).json(
    apiResponse.error(message, statusCode, {
      code: errorCode,
      details,
    })
  );
};
