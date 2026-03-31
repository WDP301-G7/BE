// src/modules/notifications/notifications.controller.ts
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { notificationsService } from './notifications.service';
import { apiResponse } from '../../utils/apiResponse';

class NotificationsController {
    /**
     * GET /notifications
     * Get paginated notifications for the authenticated user
     */
    getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';

        const result = await notificationsService.getMyNotifications(userId, {
            page,
            limit,
            unreadOnly,
        });

        res.json(apiResponse.success(result));
    });

    /**
     * GET /notifications/unread-count
     * Get count of unread notifications
     */
    getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const result = await notificationsService.getUnreadCount(userId);
        res.json(apiResponse.success(result));
    });

    /**
     * PATCH /notifications/:id/read
     * Mark a single notification as read
     */
    markAsRead = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const id = req.params['id'] as string;

        const notification = await notificationsService.markAsRead(id, userId);

        if (!notification) {
            res.status(404).json(apiResponse.error('Notification not found', 404));
            return;
        }

        res.json(apiResponse.success(notification));
    });

    /**
     * PATCH /notifications/read-all
     * Mark all notifications as read
     */
    markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const result = await notificationsService.markAllAsRead(userId);
        res.json(apiResponse.success(result));
    });
}

export const notificationsController = new NotificationsController();
