// src/validations/zod/reviews.schema.ts
import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';

/**
 * Schema for creating a review
 * Business rule: 1 rating (required) + comment (optional) + images (optional, max 3)
 */
export const createReviewSchema = z.object({
    body: z.object({
        orderItemId: z.string().uuid('Invalid orderItem ID format'),
        rating: z
            .number({ required_error: 'Rating là bắt buộc' })
            .int('Rating phải là số nguyên')
            .min(1, 'Rating tối thiểu là 1')
            .max(5, 'Rating tối đa là 5'),
        comment: z
            .string()
            .max(1000, 'Comment không được vượt quá 1000 ký tự')
            .optional(),
    }),
});

/**
 * Schema for updating a review (at least one field required)
 */
export const updateReviewSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid review ID'),
    }),
    body: z
        .object({
            rating: z
                .number()
                .int('Rating phải là số nguyên')
                .min(1, 'Rating tối thiểu là 1')
                .max(5, 'Rating tối đa là 5')
                .optional(),
            comment: z
                .string()
                .max(1000, 'Comment không được vượt quá 1000 ký tự')
                .nullable()
                .optional(),
        })
        .refine(
            (data) => data.rating !== undefined || data.comment !== undefined,
            { message: 'Cần ít nhất 1 trường để cập nhật (rating hoặc comment)' }
        ),
});

/**
 * Schema for replying to a review
 */
export const replyReviewSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid review ID'),
    }),
    body: z.object({
        replyContent: z
            .string({ required_error: 'Nội dung phản hồi là bắt buộc' })
            .min(1, 'Nội dung phản hồi không được để trống')
            .max(500, 'Nội dung phản hồi không được vượt quá 500 ký tự'),
    }),
});

/**
 * Schema for review ID param
 */
export const reviewIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid review ID'),
    }),
});

/**
 * Schema for product ID param (used in /products/:productId/reviews)
 */
export const productIdParamSchema = z.object({
    params: z.object({
        productId: z.string().uuid('Invalid product ID'),
    }),
});

/**
 * Schema for getting reviews by product with filters
 */
export const getProductReviewsQuerySchema = z.object({
    params: z.object({
        productId: z.string().uuid('Invalid product ID'),
    }),
    query: z.object({
        rating: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : undefined))
            .refine((val) => val === undefined || (val >= 1 && val <= 5), {
                message: 'Rating filter phải từ 1 đến 5',
            }),
        hasImages: z
            .string()
            .optional()
            .transform((val) => {
                if (val === 'true') return true;
                if (val === 'false') return false;
                return undefined;
            }),
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('10'),
        sortBy: z.enum(['createdAt', 'rating']).optional().default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});

/**
 * Schema for admin/manager getting all reviews with filters
 */
export const getReviewsQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('10'),
        status: z.nativeEnum(ReviewStatus).optional(),
        productId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        rating: z
            .string()
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : undefined))
            .refine((val) => val === undefined || (val >= 1 && val <= 5), {
                message: 'Rating filter phải từ 1 đến 5',
            }),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>['body'];
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>['body'];
export type GetProductReviewsQuery = z.infer<typeof getProductReviewsQuerySchema>['query'];
export type GetReviewsQuery = z.infer<typeof getReviewsQuerySchema>['query'];
