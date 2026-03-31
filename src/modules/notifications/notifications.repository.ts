// src/modules/notifications/notifications.repository.ts
import { Notification, NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';

export interface CreateNotificationData {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
}

export interface GetNotificationsFilter {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

export interface PaginatedNotifications {
    data: Notification[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

class NotificationsRepository {
    async create(payload: CreateNotificationData): Promise<Notification> {
        return prisma.notification.create({
            data: {
                userId: payload.userId,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                data: payload.data ?? undefined,
            },
        });
    }

    async createMany(payloads: CreateNotificationData[]): Promise<number> {
        const result = await prisma.notification.createMany({
            data: payloads.map((p) => ({
                userId: p.userId,
                type: p.type,
                title: p.title,
                message: p.message,
                data: p.data ?? undefined,
            })),
        });
        return result.count;
    }

    async findByUserId(
        userId: string,
        filter: GetNotificationsFilter = {}
    ): Promise<PaginatedNotifications> {
        const { page = 1, limit = 20, unreadOnly = false } = filter;

        const where: any = { userId };
        if (unreadOnly) where.isRead = false;

        const [data, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.notification.count({ where }),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const notification = await prisma.notification.findFirst({
            where: { id, userId },
        });
        if (!notification) return null;

        return prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string): Promise<number> {
        const result = await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        return result.count;
    }

    async countUnread(userId: string): Promise<number> {
        return prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    /**
     * Find all userIds with a specific role (for role-based broadcast)
     */
    async findUserIdsByRole(role: string): Promise<string[]> {
        const users = await prisma.user.findMany({
            where: { role: role as any, status: 'ACTIVE' },
            select: { id: true },
        });
        return users.map((u) => u.id);
    }
}

export const notificationsRepository = new NotificationsRepository();
