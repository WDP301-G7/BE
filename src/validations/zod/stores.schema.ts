// src/validations/zod/stores.schema.ts
import { z } from 'zod';

export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    address: z.string().min(5, 'Address must be at least 5 characters').max(255, 'Address too long'),
  }),
});

export const updateStoreSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    address: z.string().min(5).max(255).optional(),
  }),
});

export const getStoreSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid store ID'),
  }),
});

export const getStoresQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    })
    .transform((data) => ({
      page: data.page ? parseInt(data.page, 10) : 1,
      limit: data.limit ? parseInt(data.limit, 10) : 10,
      search: data.search,
    })),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>['body'];
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>['body'];
export type GetStoreParams = z.infer<typeof getStoreSchema>['params'];
export type GetStoresQuery = z.infer<typeof getStoresQuerySchema>['query'];
