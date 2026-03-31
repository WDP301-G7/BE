// src/modules/notifications/notifications.gateway.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { tokenService } from '../../utils/token';
import { notificationsRepository } from './notifications.repository';

/**
 * Set up Socket.IO connection handling and authentication.
 *
 * Room strategy:
 *  - `user:{userId}` → personal events for a specific user
 *  - `role:{ROLE}`   → broadcast to all users of a role (CUSTOMER, STAFF, OPERATION, ADMIN)
 */
export function setupNotificationGateway(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // ── Authenticate ─────────────────────────────────────────────────────────
        socket.on('authenticate', async (payload: { token: string }) => {
            try {
                if (!payload?.token) {
                    socket.emit('auth_error', { message: 'Token is required' });
                    return;
                }

                const decoded = tokenService.verifyAccessToken(payload.token);
                const { userId, role } = decoded;

                // Join personal room and role room
                await socket.join(`user:${userId}`);
                await socket.join(`role:${role}`);

                // Store userId on socket for cleanup
                (socket as any).userId = userId;

                // Send current unread count on connect
                const unreadCount = await notificationsRepository.countUnread(userId);
                socket.emit('authenticated', { userId, role });
                socket.emit('unread_count', { count: unreadCount });

                console.log(`[Socket.IO] User ${userId} (${role}) authenticated → joined user:${userId} + role:${role}`);
            } catch (error) {
                socket.emit('auth_error', { message: 'Invalid or expired token' });
                console.warn(`[Socket.IO] Auth failed for socket ${socket.id}:`, error);
            }
        });

        // ── Disconnect ───────────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            const userId = (socket as any).userId;
            console.log(`[Socket.IO] Client disconnected: ${socket.id}${userId ? ` (user:${userId})` : ''} — ${reason}`);
        });
    });
}
