// src/constants/products.ts
import { ProductImageType } from '@prisma/client';

/**
 * Number of images required when creating a product
 */
export const REQUIRED_PRODUCT_IMAGES_COUNT = 5;

/**
 * Maximum size per image in MB
 */
export const MAX_IMAGE_SIZE_MB = 5;

/**
 * Allowed product image types
 */
export const ALLOWED_IMAGE_TYPES: ProductImageType[] = [
  ProductImageType.TWO_D,
  ProductImageType.THREE_D,
  ProductImageType.DETAIL,
];

/**
 * Map string imageType to Prisma enum
 */
export const IMAGE_TYPE_MAP: Record<string, ProductImageType> = {
  '2D': ProductImageType.TWO_D,
  '3D': ProductImageType.THREE_D,
  'DETAIL': ProductImageType.DETAIL,
};
