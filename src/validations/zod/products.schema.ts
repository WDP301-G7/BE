// src/validations/zod/products.schema.ts
import { z } from 'zod';
import { ProductType } from '@prisma/client';

export const createProductSchema = z.object({
  body: z
    .object({
      categoryId: z.string().uuid('Invalid category ID'),
      name: z.string().min(2, 'Name must be at least 2 characters').max(150, 'Name too long'),
      description: z.string().optional(),
      type: z.nativeEnum(ProductType, { required_error: 'Product type is required' }),
      price: z
        .number({ required_error: 'Price is required' })
        .positive('Price must be greater than 0')
        .multipleOf(0.01, 'Price must have at most 2 decimal places'),
      isPreorder: z.boolean().default(false),
      leadTimeDays: z.number().int().positive().optional(),
      sku: z.string().max(50).optional(),
      brand: z.string().max(100).optional(),
    })
    .refine(
      (data) => {
        // If isPreorder is true, leadTimeDays is required
        if (data.isPreorder && !data.leadTimeDays) {
          return false;
        }
        // If isPreorder is false, leadTimeDays should not be provided
        if (!data.isPreorder && data.leadTimeDays) {
          return false;
        }
        return true;
      },
      {
        message: 'Lead time days is only required for preorder products',
        path: ['leadTimeDays'],
      }
    ),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      categoryId: z.string().uuid('Invalid category ID').optional(),
      name: z.string().min(2).max(150).optional(),
      description: z.string().optional().nullable(),
      type: z.nativeEnum(ProductType).optional(),
      price: z.number().positive('Price must be greater than 0').multipleOf(0.01).optional(),
      isPreorder: z.boolean().optional(),
      leadTimeDays: z.number().int().positive().optional().nullable(),
      sku: z.string().max(50).optional().nullable(),
      brand: z.string().max(100).optional().nullable(),
    })
    .refine(
      (data) => {
        // If isPreorder is explicitly set to true, leadTimeDays should be provided
        if (data.isPreorder === true && !data.leadTimeDays) {
          return false;
        }
        // If isPreorder is explicitly set to false, leadTimeDays should be null/undefined
        if (data.isPreorder === false && data.leadTimeDays) {
          return false;
        }
        return true;
      },
      {
        message: 'Lead time days is only required for preorder products',
        path: ['leadTimeDays'],
      }
    ),
});

export const getProductSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
});

export const getProductsQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      type: z.nativeEnum(ProductType).optional(),
      minPrice: z.string().optional(),
      maxPrice: z.string().optional(),
      isPreorder: z.string().optional(),
      search: z.string().optional(),
    })
    .transform((data) => ({
      page: data.page ? parseInt(data.page, 10) : 1,
      limit: data.limit ? parseInt(data.limit, 10) : 10,
      categoryId: data.categoryId,
      type: data.type,
      minPrice: data.minPrice ? parseFloat(data.minPrice) : undefined,
      maxPrice: data.maxPrice ? parseFloat(data.maxPrice) : undefined,
      isPreorder: data.isPreorder === 'true' ? true : data.isPreorder === 'false' ? false : undefined,
      search: data.search,
    })),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type GetProductParams = z.infer<typeof getProductSchema>['params'];
export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>['query'];
