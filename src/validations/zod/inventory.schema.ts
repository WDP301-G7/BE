// src/validations/zod/inventory.schema.ts
import { z } from 'zod';

export const createInventorySchema = z.object({
  body: z.object({
    productId: z.string().uuid('Invalid product ID'),
    storeId: z.string().uuid('Invalid store ID'),
    quantity: z.number().int().min(0, 'Quantity must be at least 0'),
    reservedQuantity: z.number().int().min(0).default(0),
  }),
});

export const updateInventorySchema = z.object({
  body: z.object({
    quantity: z.number().int().min(0, 'Quantity must be at least 0').optional(),
    reservedQuantity: z.number().int().min(0).optional(),
  }).refine(
    (data) => {
      // At least one field must be provided
      return data.quantity !== undefined || data.reservedQuantity !== undefined;
    },
    {
      message: 'At least one field (quantity or reservedQuantity) must be provided',
    }
  ),
});

export const reserveInventorySchema = z.object({
  body: z.object({
    quantity: z.number().int().positive('Quantity must be greater than 0'),
  }),
});

export const releaseInventorySchema = z.object({
  body: z.object({
    quantity: z.number().int().positive('Quantity must be greater than 0'),
  }),
});

export const getInventorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid inventory ID'),
  }),
});

export const getInventoryByProductSchema = z.object({
  params: z.object({
    productId: z.string().uuid('Invalid product ID'),
  }),
});

export const getInventoryByStoreSchema = z.object({
  params: z.object({
    storeId: z.string().uuid('Invalid store ID'),
  }),
});

export const getInventoryQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      productId: z.string().uuid().optional(),
      storeId: z.string().uuid().optional(),
      lowStock: z.string().optional(), // true/false
    })
    .transform((data) => ({
      page: data.page ? parseInt(data.page, 10) : 1,
      limit: data.limit ? parseInt(data.limit, 10) : 10,
      productId: data.productId,
      storeId: data.storeId,
      lowStock: data.lowStock === 'true' ? true : data.lowStock === 'false' ? false : undefined,
    })),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>['body'];
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>['body'];
export type ReserveInventoryInput = z.infer<typeof reserveInventorySchema>['body'];
export type ReleaseInventoryInput = z.infer<typeof releaseInventorySchema>['body'];
export type GetInventoryParams = z.infer<typeof getInventorySchema>['params'];
export type GetInventoryByProductParams = z.infer<typeof getInventoryByProductSchema>['params'];
export type GetInventoryByStoreParams = z.infer<typeof getInventoryByStoreSchema>['params'];
export type GetInventoryQuery = z.infer<typeof getInventoryQuerySchema>['query'];
