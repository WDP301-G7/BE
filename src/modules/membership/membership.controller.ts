// src/modules/membership/membership.controller.ts
import { Request, Response, NextFunction } from 'express';
import { membershipService } from './membership.service';
import { apiResponse } from '../../utils/apiResponse';
import {
    CreateTierInput,
    UpdateTierInput,
    GetMembershipHistoryQuery,
} from '../../validations/zod/membership.schema';

class MembershipController {
    // ─── Admin: Tier management ─────────────────────────────────────────────────

    /**
     * @route   POST /api/membership/tiers
     * @desc    Create a new membership tier
     * @access  Private (Admin)
     */
    async createTier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data: CreateTierInput = req.body;
            const tier = await membershipService.createTier(data);
            res.status(201).json(apiResponse.success(tier, 'Membership tier created', 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/membership/tiers
     * @desc    Get all membership tiers
     * @access  Public
     */
    async getAllTiers(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tiers = await membershipService.getAllTiers();
            res.status(200).json(apiResponse.success(tiers, 'Tiers retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/membership/tiers/:id
     * @desc    Get a single membership tier
     * @access  Public
     */
    async getTierById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tier = await membershipService.getTierById(req.params.id as string);
            res.status(200).json(apiResponse.success(tier));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/membership/tiers/:id
     * @desc    Update a membership tier
     * @access  Private (Admin)
     */
    async updateTier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data: UpdateTierInput = req.body;
            const tier = await membershipService.updateTier(req.params.id as string, data);
            res.status(200).json(apiResponse.success(tier, 'Tier updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   DELETE /api/membership/tiers/:id
     * @desc    Delete a membership tier (only if no users assigned)
     * @access  Private (Admin)
     */
    async deleteTier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            await membershipService.deleteTier(req.params.id as string);
            res.status(200).json(apiResponse.success(null, 'Tier deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    // ─── Customer: Membership status ────────────────────────────────────────────

    /**
     * @route   GET /api/membership/me
     * @desc    Get current user's membership status with tier progress
     * @access  Private (Customer)
     */
    async getMyMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const status = await membershipService.getMembershipStatus(userId);
            res.status(200).json(apiResponse.success(status, 'Membership status retrieved'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/membership/me/history
     * @desc    Get current user's tier change history
     * @access  Private (Customer)
     */
    async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const result = await membershipService.getMyHistory(userId, page, limit);
            res.status(200).json(apiResponse.success(result, 'History retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    // ─── Admin: History audit log ───────────────────────────────────────────────

    /**
     * @route   GET /api/membership/history
     * @desc    Get all tier change history (admin audit log)
     * @access  Private (Admin, Operation)
     */
    async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query: GetMembershipHistoryQuery = req.query as any;
            const result = await membershipService.getHistory({
                page: query.page,
                limit: query.limit,
                userId: query.userId,
                reason: query.reason,
                startDate: query.startDate,
                endDate: query.endDate,
            });
            res.status(200).json(apiResponse.success(result, 'History retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/membership/users/:userId/membership
     * @desc    Get membership status for a specific user (Admin)
     * @access  Private (Admin, Manager)
     */
    async getUserMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.userId as string;
            const status = await membershipService.getMembershipStatus(userId);
            res.status(200).json(apiResponse.success(status, 'User membership retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/membership/users/:userId/membership/adjust-points
     * @desc    Adjust user membership points/spending manually (Admin)
     * @access  Private (Admin)
     */
    async adjustPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.userId as string;
            const { amount, reason, note } = req.body;
            const result = await membershipService.adjustPoints(userId, {
                amount,
                reason,
                note,
                administeredBy: req.user!.userId,
            });
            res.status(200).json(apiResponse.success(result, 'Points adjusted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export const membershipController = new MembershipController();
