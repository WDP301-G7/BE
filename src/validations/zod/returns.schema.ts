// src/validations/zod/returns.schema.ts
import { z } from 'zod';
import { ReturnStatus, ReturnType, ProductCondition, ReturnImageType } from '@prisma/client';

/**
 * Schema for creating return request
 */
export const createReturnSchema = z.object({
    body: z.object({
        orderId: z.string().uuid('Invalid order ID format'),
        type: z.nativeEnum(ReturnType, {
            errorMap: () => ({ message: 'Invalid return type. Must be RETURN, EXCHANGE, or WARRANTY' }),
        }),
        reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự').max(500, 'Lý do không được vượt quá 500 ký tự'),
        description: z.string().max(1000, 'Mô tả không được vượt quá 1000 ký tự').optional(),
        items: z
            .array(
                z.object({
                    orderItemId: z.string().uuid('Invalid order item ID'),
                    productId: z.string().uuid('Invalid product ID'),
                    quantity: z.number().int().min(1, 'Số lượng phải ít nhất 1'),
                    condition: z.nativeEnum(ProductCondition, {
                        errorMap: () => ({ message: 'Invalid product condition' }),
                    }),
                    exchangeProductId: z.string().uuid('Invalid exchange product ID').optional(),
                })
            )
            .min(1, 'Phải có ít nhất 1 sản phẩm'),
    }),
});

/**
 * Schema for getting returns with filters
 */
export const getReturnsQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('10'),
        status: z.nativeEnum(ReturnStatus).optional(),
        type: z.nativeEnum(ReturnType).optional(),
        customerId: z.string().uuid().optional(),
        orderId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
});

/**
 * Schema for return ID param
 */
export const returnIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
});

/**
 * Schema for approving return request
 */
export const approveReturnSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
    body: z.object({
        note: z.string().max(500).optional(),
    }).optional(),
});

/**
 * Schema for rejecting return request
 */
export const rejectReturnSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
    body: z.object({
        rejectionReason: z.string().min(10, 'Lý do từ chối phải có ít nhất 10 ký tự').max(500),
    }),
});

/**
 * Schema for completing return request
 */
export const completeReturnSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
    body: z.object({
        refundAmount: z.number().min(0, 'Số tiền hoàn phải >= 0').optional(),
        refundMethod: z.enum(['CASH', 'BANK_TRANSFER'], {
            errorMap: () => ({ message: 'Invalid refund method' }),
        }).optional(),
        completionNote: z.string().max(500).optional(),
    }).optional(),
});

/**
 * Schema for uploading images
 */
export const uploadImagesSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
    body: z.object({
        imageType: z.nativeEnum(ReturnImageType, {
            errorMap: () => ({ message: 'Invalid image type' }),
        }),
    }),
});

/**
 * Schema for deleting image
 */
export const deleteImageSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
        imageId: z.string().uuid('Invalid image ID'),
    }),
});

/**
 * Schema for force updating status (admin only)
 */
export const updateReturnStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid return request ID'),
    }),
    body: z.object({
        status: z.nativeEnum(ReturnStatus, {
            errorMap: () => ({ message: 'Invalid return status' }),
        }),
    }),
});

/**
 * TypeScript types inferred from schemas
 */
export type CreateReturnInput = z.infer<typeof createReturnSchema>['body'];
export type GetReturnsQuery = z.infer<typeof getReturnsQuerySchema>['query'];
export type ApproveReturnInput = z.infer<typeof approveReturnSchema>['body'];
export type RejectReturnInput = z.infer<typeof rejectReturnSchema>['body'];
export type CompleteReturnInput = z.infer<typeof completeReturnSchema>['body'];
export type UploadImagesInput = z.infer<typeof uploadImagesSchema>['body'];
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>['body'];
