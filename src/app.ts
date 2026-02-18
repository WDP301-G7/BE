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

// Root redirect to Swagger
app.get('/', (_req, res) => {
  res.redirect('/api-docs');
});

// Swagger documentation
if (ENV.SWAGGER_ENABLED) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// API Routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import productsRoutes from './modules/products/products.routes';
import productImagesRoutes from './modules/products/product-images.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import storesRoutes from './modules/stores/stores.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import ordersRoutes from './modules/orders/orders.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import prescriptionRequestsRoutes from './modules/prescription-requests/prescription-requests.routes';

app.use(`${ENV.API_PREFIX}/auth`, authRoutes);
app.use(`${ENV.API_PREFIX}/users`, usersRoutes);
app.use(`${ENV.API_PREFIX}/categories`, categoriesRoutes);
app.use(`${ENV.API_PREFIX}/stores`, storesRoutes);
app.use(`${ENV.API_PREFIX}/products`, productsRoutes);
app.use(`${ENV.API_PREFIX}/products`, productImagesRoutes);
app.use(`${ENV.API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${ENV.API_PREFIX}/orders`, ordersRoutes);
app.use(`${ENV.API_PREFIX}/payments`, paymentsRoutes);
app.use(`${ENV.API_PREFIX}/prescription-requests`, prescriptionRequestsRoutes);

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
