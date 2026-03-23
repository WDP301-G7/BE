// src/modules/reviews/reviews.service.ts
 import { Review } from '@prisma/client';
import {
    reviewsRepository,
    ReviewWithRelations,
    PaginatedReviews,
    RatingSummary,
    GetProductReviewsFilter,
} from './reviews.repository';
import { prisma } from '../../config/database';
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
    ConflictError,
} from '../../utils/errorHandler';
import { uploadToSupabase, deleteFromSupabase, extractPathFromUrl } from '../../utils/upload';
import {
    CreateReviewInput,
    UpdateReviewInput,
    ReplyReviewInput,
    GetProductReviewsQuery,
    GetReviewsQuery,
} from '../../validations/zod/reviews.schema';

import { settingsService } from '../settings/settings.service';

// ─── Business rules constants ─────────────────────────────────────────────────

const REVIEW_IMAGE_FOLDER = 'reviews';
const ALLOWED_PRODUCT_TYPES_FOR_REVIEW = ['FRAME', 'LENS'] as const;

class ReviewsService {
    // ─── Customer actions ─────────────────────────────────────────────────────

    /**
     * Create a new review
     * Business rules:
     * - OrderItem must belong to the customer
     * - Product type must be FRAME or LENS
     * - Order must be COMPLETED
     * - Must be within 30 days of completion
     * - OrderItem must not already have a review
     * - Max 3 images
     */
    async createReview(
        customerId: string,
        data: CreateReviewInput,
        files?: Express.Multer.File[]
    ): Promise<ReviewWithRelations> {
        // Fetch dynamic settings
        const maxImages = await settingsService.get<number>('review.max_images', 3);
        const deadlineDays = await settingsService.get<number>('review.deadline_days', 30);
        const editableDays = await settingsService.get<number>('review.editable_days', 7);

        // Validate image count
        if (files && files.length > maxImages) {
            throw new BadRequestError(
                `Chỉ được upload tối đa ${maxImages} ảnh cho một đánh giá`
            );
        }

        // Fetch OrderItem with relations
        const orderItem = await prisma.orderItem.findUnique({
            where: { id: data.orderItemId },
            include: {
                order: { select: { id: true, customerId: true, status: true, updatedAt: true } },
                product: { select: { id: true, type: true, name: true } },
            },
        });

        if (!orderItem) {
            throw new NotFoundError('OrderItem không tồn tại');
        }

        // Check ownership
        if (orderItem.order.customerId !== customerId) {
            throw new ForbiddenError('Bạn không có quyền đánh giá sản phẩm này');
        }

        // Check product type
        if (!ALLOWED_PRODUCT_TYPES_FOR_REVIEW.includes(orderItem.product.type as 'FRAME' | 'LENS')) {
            throw new BadRequestError('Loại sản phẩm này không hỗ trợ đánh giá');
        }

        // Check order status
        if (orderItem.order.status !== 'COMPLETED') {
            throw new BadRequestError(
                'Đơn hàng chưa hoàn thành, chưa thể đánh giá'
            );
        }

        // Check review deadline (30 days from order completion)
        const completedAt = orderItem.order.updatedAt;
        const deadline = new Date(completedAt);
        deadline.setDate(deadline.getDate() + deadlineDays);

        if (new Date() > deadline) {
            throw new BadRequestError(
                `Đã hết hạn đánh giá. Chỉ được đánh giá trong vòng ${deadlineDays} ngày sau khi nhận hàng`
            );
        }

        // Check duplicate review
        const existing = await reviewsRepository.findByOrderItemId(data.orderItemId);
        if (existing) {
            throw new ConflictError('Bạn đã đánh giá sản phẩm này rồi');
        }

        // Upload images to Supabase
        let imageUrls: string[] = [];
        if (files && files.length > 0) {
            const uploadResults = await Promise.all(
                files.map((file) => uploadToSupabase(file, REVIEW_IMAGE_FOLDER))
            );
            imageUrls = uploadResults.map((r) => r.url);
        }

        // Calculate editableUntil
        const editableUntil = new Date();
        editableUntil.setDate(editableUntil.getDate() + editableDays);

        return await reviewsRepository.create({
            orderItemId: data.orderItemId,
            orderId: orderItem.orderId,
            productId: orderItem.productId,
            customerId,
            rating: data.rating,
            comment: data.comment,
            editableUntil,
            imageUrls,
        });
    }

    /**
     * Update an existing review
     * Business rules:
     * - Customer must own the review
     * - Review must be PUBLISHED (not HIDDEN)
     * - Must be within 7 days of creation (editableUntil)
     */
    async updateReview(
        reviewId: string,
        customerId: string,
        data: UpdateReviewInput,
        files?: Express.Multer.File[]
    ): Promise<ReviewWithRelations> {
        // Fetch dynamic settings
        const maxImages = await settingsService.get<number>('review.max_images', 3);
        const editableDays = await settingsService.get<number>('review.editable_days', 7);

        // Validate image count
        if (files && files.length > maxImages) {
            throw new BadRequestError(
                `Chỉ được upload tối đa ${maxImages} ảnh cho một đánh giá`
            );
        }

        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        // Check ownership
        if (review.customerId !== customerId) {
            throw new ForbiddenError('Bạn không có quyền chỉnh sửa review này');
        }

        // Check moderation status
        if (review.status === 'HIDDEN') {
            throw new BadRequestError('Review đang bị ẩn, không thể chỉnh sửa');
        }

        // Check edit window
        if (new Date() > review.editableUntil) {
            throw new BadRequestError(
                `Đã hết hạn chỉnh sửa. Review chỉ có thể chỉnh sửa trong vòng ${editableDays} ngày sau khi tạo`
            );
        }

        // Upload new images if provided
        let newImageUrls: string[] | undefined;
        if (files !== undefined) {
            // Delete old images from Supabase
            if (review.images.length > 0) {
                await Promise.allSettled(
                    review.images.map((img) => {
                        const path = extractPathFromUrl(img.imageUrl);
                        return path ? deleteFromSupabase(path) : Promise.resolve();
                    })
                );
            }

            // Upload new images
            if (files.length > 0) {
                const uploadResults = await Promise.all(
                    files.map((file) => uploadToSupabase(file, REVIEW_IMAGE_FOLDER))
                );
                newImageUrls = uploadResults.map((r) => r.url);
            } else {
                newImageUrls = [];
            }
        }

        return await reviewsRepository.update(reviewId, data, newImageUrls);
    }

    /**
     * Get all reviews written by the authenticated customer
     */
    async getMyReviews(
        customerId: string,
        page: number,
        limit: number
    ): Promise<PaginatedReviews> {
        return await reviewsRepository.findByCustomerId(customerId, page, limit);
    }

    /**
     * Get list of OrderItems the customer can still review
     */
    async getEligibleOrderItems(customerId: string) {
        return await reviewsRepository.findEligibleOrderItems(customerId);
    }

    // ─── Public actions ───────────────────────────────────────────────────────

    /**
     * Get published reviews for a product (public endpoint)
     */
    async getProductReviews(
        productId: string,
        query: GetProductReviewsQuery
    ): Promise<PaginatedReviews> {
        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });

        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }

        const filter: GetProductReviewsFilter = {
            rating: query.rating,
            hasImages: query.hasImages,
            page: parseInt(query.page, 10),
            limit: parseInt(query.limit, 10),
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        };

        return await reviewsRepository.findByProductId(productId, filter);
    }

    /**
     * Get rating summary for a product (public endpoint)
     */
    async getProductRatingSummary(productId: string): Promise<RatingSummary> {
        const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });

        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }

        const summary = await reviewsRepository.getRatingSummary(productId);

        if (!summary) {
            // Return empty summary if no reviews yet
            return {
                productId,
                productName: product.name,
                avgRating: 0,
                totalReviews: 0,
                distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            };
        }

        return summary;
    }

    // ─── Operation / Admin actions ────────────────────────────────────────────

    /**
     * Add a reply to a review
     * Business rules:
     * - Review must be PUBLISHED
     * - Only 1 reply per review (use updateReply to change)
     */
    async replyToReview(
        reviewId: string,
        repliedBy: string,
        data: ReplyReviewInput
    ): Promise<ReviewWithRelations> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        if (review.status === 'HIDDEN') {
            throw new BadRequestError('Không thể reply review đang bị ẩn');
        }

        if (review.replyContent !== null) {
            throw new ConflictError(
                'Review này đã có phản hồi. Dùng PUT /reply để cập nhật'
            );
        }

        return await reviewsRepository.saveReply(reviewId, data.replyContent, repliedBy);
    }

    /**
     * Update an existing reply
     */
    async updateReply(
        reviewId: string,
        repliedBy: string,
        data: ReplyReviewInput
    ): Promise<ReviewWithRelations> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        if (review.status === 'HIDDEN') {
            throw new BadRequestError('Không thể cập nhật reply của review đang bị ẩn');
        }

        if (review.replyContent === null) {
            throw new BadRequestError(
                'Review này chưa có phản hồi. Dùng POST /reply để tạo mới'
            );
        }

        return await reviewsRepository.saveReply(reviewId, data.replyContent, repliedBy);
    }

    // ─── Manager / Admin actions ──────────────────────────────────────────────

    /**
     * Get all reviews with filters (admin/manager dashboard)
     */
    async getAllReviews(query: GetReviewsQuery): Promise<PaginatedReviews> {
        return await reviewsRepository.findAll({
            page: parseInt(query.page, 10),
            limit: parseInt(query.limit, 10),
            status: query.status,
            productId: query.productId,
            customerId: query.customerId,
            rating: query.rating,
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
        });
    }

    /**
     * Hide a review (soft remove from public view)
     */
    async hideReview(reviewId: string): Promise<Review> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        if (review.status === 'HIDDEN') {
            throw new BadRequestError('Review đã bị ẩn rồi');
        }

        return await reviewsRepository.updateStatus(reviewId, 'HIDDEN');
    }

    /**
     * Restore a hidden review back to PUBLISHED
     */
    async showReview(reviewId: string): Promise<Review> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        if (review.status === 'PUBLISHED') {
            throw new BadRequestError('Review đang được hiển thị rồi');
        }

        return await reviewsRepository.updateStatus(reviewId, 'PUBLISHED');
    }

    /**
     * Hard delete a review (ADMIN only)
     * Also cleans up images from Supabase
     */
    async deleteReview(reviewId: string): Promise<void> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        // Delete images from Supabase (best-effort, don't block deletion)
        if (review.images.length > 0) {
            await Promise.allSettled(
                review.images.map((img) => {
                    const path = extractPathFromUrl(img.imageUrl);
                    return path ? deleteFromSupabase(path) : Promise.resolve();
                })
            );
        }

        await reviewsRepository.hardDelete(reviewId);
    }

    /**
     * Get rating stats for all products (manager dashboard)
     */
    async getRatingStats(productIds?: string[]): Promise<RatingSummary[]> {
        return await reviewsRepository.getProductsRatingStats(productIds);
    }

    /**
     * Get a single review by ID (admin/manager)
     */
    async getReviewById(reviewId: string): Promise<ReviewWithRelations> {
        const review = await reviewsRepository.findById(reviewId);

        if (!review) {
            throw new NotFoundError('Review không tồn tại');
        }

        return review;
    }
}

export const reviewsService = new ReviewsService();
