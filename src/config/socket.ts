// src/config/socket.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ENV } from './env';

let io: SocketIOServer | null = null;

/**
 * Parse CORS_ORIGIN env into string | string[]
 * Railway: set CORS_ORIGIN="https://yourapp.com,https://admin.yourapp.com"
 */
function parseCorsOrigin(raw: string): string | string[] | boolean {
    if (raw === '*') return '*';
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    return parts.length === 1 ? parts[0] : parts;
}

/**
 * Initialize Socket.IO server and attach to HTTP server
 */
export function initializeSocket(httpServer: HttpServer): SocketIOServer {
    const corsOrigin = parseCorsOrigin(ENV.CORS_ORIGIN);

    io = new SocketIOServer(httpServer, {
        cors: {
            origin: corsOrigin,
            credentials: corsOrigin !== '*', // credentials=true only when origin is explicit
            methods: ['GET', 'POST'],
        },
        path: '/socket.io',
        // Railway / cloud proxy tuning:
        // Railway kills idle TCP connections after ~60s, so keepalive must be < that
        pingTimeout: 20000,   // 20s — wait for pong before declaring disconnect
        pingInterval: 25000,  // 25s — send ping every 25s
        transports: ['polling', 'websocket'], // polling first so Railway proxy doesn't block WS upgrade
        allowEIO3: true,      // allow Engine.IO v3 clients (older mobile SDKs)
    });

    console.log(`[Socket.IO] Initialized | cors: ${JSON.stringify(corsOrigin)}`);
    return io;
}

/**
 * Get the initialized Socket.IO instance (throws if not initialized)
 */
export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error('Socket.IO has not been initialized. Call initializeSocket() first.');
    }
    return io;
}
