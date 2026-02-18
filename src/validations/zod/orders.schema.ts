// src/validations/zod/orders.schema.ts
import { z } from 'zod';
import { OrderStatus, OrderType } from '@prisma/client';

/**
 * Schema for creating a new order
 */
export const createOrderSchema = z.object({
    body: z.object({
        items: z
            .array(
                z.object({
                    productId: z.string().uuid('Invalid product ID format'),
                    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
                })
            )
            .min(2, 'Order must have at least 2 items (1 FRAME + 1 LENS)'),
    }),
});

/**
 * Schema for confirming order and setting appointment
 */
export const confirmOrderSchema = z.object({
    body: z.object({
        appointmentDate: z.string().datetime('Invalid appointment date format'),
        appointmentNote: z.string().optional(),
        assignedStaffId: z.string().uuid('Invalid staff ID').optional(),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for updating appointment
 */
export const updateAppointmentSchema = z.object({
    body: z.object({
        appointmentDate: z.string().datetime('Invalid appointment date format'),
        appointmentNote: z.string().optional(),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for getting orders with filters
 */
export const getOrdersQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('10'),
        status: z.nativeEnum(OrderStatus).optional(),
        orderType: z.nativeEnum(OrderType).optional(),
        customerId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
});

/**
 * Schema for order ID param
 */
export const orderIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for updating order status (admin only)
 */
export const updateOrderStatusSchema = z.object({
    body: z.object({
        status: z.nativeEnum(OrderStatus, {
            errorMap: () => ({ message: 'Invalid order status' }),
        }),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for cancel order
 */
export const cancelOrderSchema = z.object({
    body: z.object({
        reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').optional(),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for verifying order at pickup
 */
export const verifyOrderSchema = z.object({
    query: z.object({
        phone: z.string().min(10, 'Phone number must be at least 10 characters').max(20, 'Phone number too long'),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for completing order with notes
 */
export const completeOrderWithNotesSchema = z.object({
    body: z.object({
        completionNote: z.string().max(500, 'Completion note too long').optional(),
    }),
    params: z.object({
        id: z.string().uuid('Invalid order ID'),
    }),
});

// Type exports for TypeScript
export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>['body'];
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>['body'];
export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>['query'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>['body'];
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>['body'];
export type VerifyOrderQuery = z.infer<typeof verifyOrderSchema>['query'];
export type CompleteOrderWithNotesInput = z.infer<typeof completeOrderWithNotesSchema>['body'];
