// src/validations/zod/categories.schema.ts
import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    description: z.string().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().optional().nullable(),
  }),
});

export const getCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
});

export const getCategoriesQuerySchema = z.object({
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

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type GetCategoryParams = z.infer<typeof getCategorySchema>['params'];
export type GetCategoriesQuery = z.infer<typeof getCategoriesQuerySchema>['query'];
