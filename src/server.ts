// src/server.ts
import { createServer } from 'http';
import app from './app';
import { ENV } from './config/env';
import { initializeSocket } from './config/socket';
import { setupNotificationGateway } from './modules/notifications/notifications.gateway';

const PORT = ENV.PORT;

// Wrap Express in an HTTP server so Socket.IO can share the same port
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);
setupNotificationGateway(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${ENV.NODE_ENV}`);
  console.log(`🌐 API URL: http://localhost:${PORT}${ENV.API_PREFIX}`);
  console.log(`🔔 Socket.IO enabled at ws://localhost:${PORT}/socket.io`);
  if (ENV.SWAGGER_ENABLED) {
    console.log(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

export default httpServer;
