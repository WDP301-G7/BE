// src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorMiddleware } from './middlewares/error.middleware';
import { apiResponse } from './utils/apiResponse';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: ENV.CORS_ORIGIN,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json(
    apiResponse.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  );
});

// Swagger documentation
if (ENV.SWAGGER_ENABLED) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// API Routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';

// API root endpoint
app.get(ENV.API_PREFIX, (_req, res) => {
  res.json(
    apiResponse.success({
      name: 'E-commerce API',
      version: '1.0.0',
      endpoints: {
        auth: `${ENV.API_PREFIX}/auth`,
        users: `${ENV.API_PREFIX}/users`,
        docs: '/api-docs',
        health: '/health',
      },
    })
  );
});

app.use(`${ENV.API_PREFIX}/auth`, authRoutes);
app.use(`${ENV.API_PREFIX}/users`, usersRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    statusCode: 404,
    message: `Route not found: ${req.path}`,
    data: null,
    error: {
      code: 'ROUTE_NOT_FOUND',
    },
  });
});

// Global error handling middleware (must be last)
app.use(errorMiddleware);

export default app;
