// src/utils/apiResponse.ts
interface ApiResponseFormat<T = unknown> {
  statusCode: number;
  message: string;
  data: T | null;
  error: ErrorDetails | null;
}

interface ErrorDetails {
  code: string;
  details?: unknown;
}

class ApiResponse {
  /**
   * Success response formatter
   */
  success<T>(data: T = null as T, message = 'Success', statusCode = 200): ApiResponseFormat<T> {
    return {
      statusCode,
      message,
      data,
      error: null,
    };
  }

  /**
   * Error response formatter
   */
  error(
    message = 'Error occurred',
    statusCode = 500,
    errorDetails?: ErrorDetails
  ): ApiResponseFormat {
    return {
      statusCode,
      message,
      data: null,
      error: errorDetails || null,
    };
  }

  /**
   * Validation error response
   */
  validationError(details: unknown): ApiResponseFormat {
    return {
      statusCode: 400,
      message: 'Validation error',
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        details,
      },
    };
  }

  /**
   * Unauthorized error response
   */
  unauthorized(message = 'Unauthorized'): ApiResponseFormat {
    return {
      statusCode: 401,
      message,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
      },
    };
  }

  /**
   * Forbidden error response
   */
  forbidden(message = 'Forbidden'): ApiResponseFormat {
    return {
      statusCode: 403,
      message,
      data: null,
      error: {
        code: 'FORBIDDEN',
      },
    };
  }

  /**
   * Not found error response
   */
  notFound(message = 'Resource not found'): ApiResponseFormat {
    return {
      statusCode: 404,
      message,
      data: null,
      error: {
        code: 'NOT_FOUND',
      },
    };
  }

  /**
   * Conflict error response
   */
  conflict(message = 'Resource already exists'): ApiResponseFormat {
    return {
      statusCode: 409,
      message,
      data: null,
      error: {
        code: 'CONFLICT',
      },
    };
  }

  /**
   * Internal server error response
   */
  internalError(message = 'Internal server error'): ApiResponseFormat {
    return {
      statusCode: 500,
      message,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
      },
    };
  }
}

export const apiResponse = new ApiResponse();
