// src/modules/notifications/notifications.service.ts
import { Notification, NotificationType, UserRole } from '@prisma/client';
import {
    notificationsRepository,
    GetNotificationsFilter,
    PaginatedNotifications,
} from './notifications.repository';
import { getIO } from '../../config/socket';

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
}

class NotificationsService {
    /**
     * Send a notification to a specific user.
     * Saves to DB and emits Socket.IO event.
     */
    async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
        try {
            const notification = await notificationsRepository.create({
                userId,
                ...payload,
            });

            // Emit realtime event to user's personal room
            const io = getIO();
            io.to(`user:${userId}`).emit('notification', notification);

            // Update unread count
            const unreadCount = await notificationsRepository.countUnread(userId);
            io.to(`user:${userId}`).emit('unread_count', { count: unreadCount });
        } catch (error) {
            // Non-critical: log but don't throw
            console.error('[NotificationsService] sendToUser error:', error);
        }
    }

    /**
     * Broadcast a notification to ALL active users with a given role.
     * Uses Socket.IO room `role:{ROLE}` for efficiency, saves to DB for each user.
     */
    async broadcastToRole(role: UserRole, payload: NotificationPayload): Promise<void> {
        try {
            // Get all active user IDs with this role
            const userIds = await notificationsRepository.findUserIdsByRole(role);
            if (userIds.length === 0) return;

            // Bulk insert to DB
            await notificationsRepository.createMany(
                userIds.map((userId) => ({ userId, ...payload }))
            );

            // Emit via Socket.IO role room (clients join `role:{ROLE}` on connect)
            const io = getIO();
            // Build a minimal notification object for the event
            const eventPayload = {
                type: payload.type,
                title: payload.title,
                message: payload.message,
                data: payload.data,
                isRead: false,
                createdAt: new Date(),
            };
            io.to(`role:${role}`).emit('notification', eventPayload);
        } catch (error) {
            console.error('[NotificationsService] broadcastToRole error:', error);
        }
    }

    // ─── REST API methods ───────────────────────────────────────────────────────

    async getMyNotifications(
        userId: string,
        filter: GetNotificationsFilter
    ): Promise<PaginatedNotifications> {
        return notificationsRepository.findByUserId(userId, filter);
    }

    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const updated = await notificationsRepository.markAsRead(id, userId);

        if (updated) {
            // Update real-time unread count
            try {
                const io = getIO();
                const unreadCount = await notificationsRepository.countUnread(userId);
                io.to(`user:${userId}`).emit('unread_count', { count: unreadCount });
            } catch (_) {}
        }

        return updated;
    }

    async markAllAsRead(userId: string): Promise<{ count: number }> {
        const count = await notificationsRepository.markAllAsRead(userId);

        try {
            const io = getIO();
            io.to(`user:${userId}`).emit('unread_count', { count: 0 });
        } catch (_) {}

        return { count };
    }

    async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await notificationsRepository.countUnread(userId);
        return { count };
    }
}

export const notificationsService = new NotificationsService();
