// src/modules/products/products.service.ts
import { Product } from '@prisma/client';
import {
  productsRepository,
  GetProductsFilter,
  PaginatedProducts,
  ProductWithRelations,
} from './products.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errorHandler';
import { CreateProductInput, UpdateProductInput } from '../../validations/zod/products.schema';

class ProductsService {
  /**
   * Get all products with pagination and filters
   * Public API - returns product with category and images
   */
  async getProducts(filter: GetProductsFilter): Promise<PaginatedProducts> {
    return await productsRepository.getProducts(filter);
  }

  /**
   * Get product by ID
   * Public API
   */
  async getProductById(id: string): Promise<ProductWithRelations> {
    const product = await productsRepository.findById(id);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  /**
   * Create new product (Admin only)
   * Business logic:
   * - Validate price > 0
   * - Check unique name within category
   * - If isPreorder = true, leadTimeDays is required
   */
  async createProduct(data: CreateProductInput): Promise<Product> {
    // Validate price
    if (data.price <= 0) {
      throw new BadRequestError('Price must be greater than 0');
    }

    // Check if product name already exists in the same category
    const existingProduct = await productsRepository.findByNameAndCategory(data.name, data.categoryId);
    if (existingProduct) {
      throw new ConflictError('Product name already exists in this category');
    }

    // Validate preorder logic
    if (data.isPreorder && !data.leadTimeDays) {
      throw new BadRequestError('Lead time days is required for preorder products');
    }

    // Create product
    const product = await productsRepository.create({
      name: data.name,
      description: data.description,
      type: data.type,
      price: data.price,
      isPreorder: data.isPreorder,
      leadTimeDays: data.leadTimeDays,
      sku: data.sku,
      brand: data.brand,
      category: {
        connect: { id: data.categoryId },
      },
    });

    return product;
  }

  /**
   * Update product (Admin only)
   * Business logic:
   * - If name or categoryId changes, check unique constraint
   * - Validate price > 0
   * - If isPreorder = true, leadTimeDays is required
   */
  async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    // Check if product exists
    const product = await productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Validate price if provided
    if (data.price !== undefined && data.price <= 0) {
      throw new BadRequestError('Price must be greater than 0');
    }

    // Check unique name in category if name or categoryId changed
    const nameChanged = data.name && data.name !== product.name;
    const categoryChanged = data.categoryId && data.categoryId !== product.categoryId;

    if (nameChanged || categoryChanged) {
      const checkName = data.name || product.name;
      const checkCategoryId = data.categoryId || product.categoryId;

      const existingProduct = await productsRepository.findByNameAndCategory(checkName, checkCategoryId, id);
      if (existingProduct) {
        throw new ConflictError('Product name already exists in this category');
      }
    }

    // Validate preorder logic
    const isPreorderValue = data.isPreorder !== undefined ? data.isPreorder : product.isPreorder;
    const leadTimeDaysValue = data.leadTimeDays !== undefined ? data.leadTimeDays : product.leadTimeDays;

    if (isPreorderValue && !leadTimeDaysValue) {
      throw new BadRequestError('Lead time days is required for preorder products');
    }

    // Update product
    const updateData: any = {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type && { type: data.type }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.isPreorder !== undefined && { isPreorder: data.isPreorder }),
      ...(data.leadTimeDays !== undefined && { leadTimeDays: data.leadTimeDays }),
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.brand !== undefined && { brand: data.brand }),
    };

    if (data.categoryId) {
      updateData.category = {
        connect: { id: data.categoryId },
      };
    }

    const updatedProduct = await productsRepository.update(id, updateData);

    return updatedProduct;
  }

  /**
   * Delete product (Admin only)
   * Soft delete - set deletedAt timestamp
   */
  async deleteProduct(id: string): Promise<void> {
    // Check if product exists
    const product = await productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Soft delete
    await productsRepository.softDelete(id);
  }

  /**
   * Get product statistics
   */
  async getProductStats(): Promise<{
    totalProducts: number;
    byType: Record<string, number>;
  }> {
    const [totalFrame, totalLens, totalService] = await Promise.all([
      productsRepository.countByType('FRAME'),
      productsRepository.countByType('LENS'),
      productsRepository.countByType('SERVICE'),
    ]);

    return {
      totalProducts: totalFrame + totalLens + totalService,
      byType: {
        FRAME: totalFrame,
        LENS: totalLens,
        SERVICE: totalService,
      },
    };
  }
}

export const productsService = new ProductsService();
