// src/server.ts
import app from './app';
import { ENV } from './config/env';

const PORT = ENV.PORT;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${ENV.NODE_ENV}`);
  console.log(`🌐 API URL: http://localhost:${PORT}${ENV.API_PREFIX}`);
  if (ENV.SWAGGER_ENABLED) {
    console.log(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

export default server;
