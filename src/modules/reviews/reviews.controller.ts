// src/modules/reviews/reviews.controller.ts
import { Request, Response, NextFunction } from 'express';
import { reviewsService } from './reviews.service';
import { apiResponse } from '../../utils/apiResponse';
import {
    CreateReviewInput,
    UpdateReviewInput,
    ReplyReviewInput,
    GetProductReviewsQuery,
    GetReviewsQuery,
} from '../../validations/zod/reviews.schema';

class ReviewsController {
    // ─── Customer actions ─────────────────────────────────────────────────────

    /**
     * @route   POST /api/reviews
     * @desc    Create a new review for a purchased product
     * @access  Private (Customer)
     */
    async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const data: CreateReviewInput = req.body;
            const files = req.files as Express.Multer.File[] | undefined;

            const review = await reviewsService.createReview(customerId, data, files);

            res.status(201).json(
                apiResponse.success(review, 'Đánh giá của bạn đã được ghi nhận', 201)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/reviews/:id
     * @desc    Update own review (within 7 days of creation)
     * @access  Private (Customer)
     */
    async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const reviewId = req.params.id as string;
            const data: UpdateReviewInput = req.body;
            const files = req.files as Express.Multer.File[] | undefined;

            const review = await reviewsService.updateReview(reviewId, customerId, data, files);

            res.status(200).json(apiResponse.success(review, 'Review đã được cập nhật'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/reviews/my-reviews
     * @desc    Get all reviews written by the authenticated customer
     * @access  Private (Customer)
     */
    async getMyReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await reviewsService.getMyReviews(customerId, page, limit);

            res.status(200).json(apiResponse.success(result, 'Reviews retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/reviews/eligible
     * @desc    Get OrderItems the customer can still review
     * @access  Private (Customer)
     */
    async getEligibleOrderItems(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;

            const items = await reviewsService.getEligibleOrderItems(customerId);

            res.status(200).json(
                apiResponse.success(items, 'Eligible order items retrieved successfully')
            );
        } catch (error) {
            next(error);
        }
    }

    // ─── Public actions ───────────────────────────────────────────────────────

    /**
     * @route   GET /api/products/:productId/reviews
     * @desc    Get published reviews for a product (with filters)
     * @access  Public
     */
    async getProductReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const productId = req.params.productId as string;
            const query = req.query as any as GetProductReviewsQuery;

            const result = await reviewsService.getProductReviews(productId, query);

            res.status(200).json(apiResponse.success(result, 'Reviews retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/products/:productId/reviews/summary
     * @desc    Get rating summary (average + distribution) for a product
     * @access  Public
     */
    async getProductRatingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const productId = req.params.productId as string;

            const summary = await reviewsService.getProductRatingSummary(productId);

            res.status(200).json(apiResponse.success(summary, 'Rating summary retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    // ─── Operation / Admin actions ────────────────────────────────────────────

    /**
     * @route   POST /api/reviews/:id/reply
     * @desc    Add a shop reply to a review
     * @access  Private (Operation, Admin)
     */
    async replyToReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;
            const repliedBy = req.user!.userId;
            const data: ReplyReviewInput = req.body;

            const review = await reviewsService.replyToReview(reviewId, repliedBy, data);

            res.status(200).json(apiResponse.success(review, 'Phản hồi đã được gửi thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/reviews/:id/reply
     * @desc    Update existing shop reply
     * @access  Private (Operation, Admin)
     */
    async updateReply(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;
            const repliedBy = req.user!.userId;
            const data: ReplyReviewInput = req.body;

            const review = await reviewsService.updateReply(reviewId, repliedBy, data);

            res.status(200).json(apiResponse.success(review, 'Phản hồi đã được cập nhật'));
        } catch (error) {
            next(error);
        }
    }

    // ─── Manager / Admin actions ──────────────────────────────────────────────

    /**
     * @route   GET /api/reviews
     * @desc    Get all reviews with filters (admin/manager dashboard)
     * @access  Private (Manager, Admin)
     */
    async getAllReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query = req.query as any as GetReviewsQuery;

            const result = await reviewsService.getAllReviews(query);

            res.status(200).json(apiResponse.success(result, 'Reviews retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/reviews/:id
     * @desc    Get single review by ID
     * @access  Private (Manager, Admin)
     */
    async getReviewById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;

            const review = await reviewsService.getReviewById(reviewId);

            res.status(200).json(apiResponse.success(review, 'Review retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/reviews/:id/hide
     * @desc    Hide a review that violates policy
     * @access  Private (Manager, Admin)
     */
    async hideReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;

            const review = await reviewsService.hideReview(reviewId);

            res.status(200).json(apiResponse.success(review, 'Review đã được ẩn'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PATCH /api/reviews/:id/show
     * @desc    Restore a hidden review back to published
     * @access  Private (Manager, Admin)
     */
    async showReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;

            const review = await reviewsService.showReview(reviewId);

            res.status(200).json(apiResponse.success(review, 'Review đã được hiển thị lại'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   DELETE /api/reviews/:id
     * @desc    Hard delete a review (also removes images from Supabase)
     * @access  Private (Admin only)
     */
    async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const reviewId = req.params.id as string;

            await reviewsService.deleteReview(reviewId);

            res.status(200).json(apiResponse.success(null, 'Review đã được xóa vĩnh viễn'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/reviews/stats
     * @desc    Get rating statistics for products
     * @access  Private (Manager, Admin)
     */
    async getRatingStats(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const productIds = req.query.productIds
                ? (req.query.productIds as string).split(',').filter(Boolean)
                : undefined;

            const stats = await reviewsService.getRatingStats(productIds);

            res.status(200).json(apiResponse.success(stats, 'Rating statistics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export const reviewsController = new ReviewsController();
