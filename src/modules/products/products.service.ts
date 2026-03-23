// src/modules/products/products.service.ts
import { Product, ProductImageType } from '@prisma/client';
import {
  productsRepository,
  GetProductsFilter,
  PaginatedProducts,
  ProductWithRelations,
} from './products.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errorHandler';
import { CreateProductInput, UpdateProductInput } from '../../validations/zod/products.schema';
import { prisma } from '../../config/database';
import { uploadToSupabase, validateImageFile } from '../../utils/upload';
import { IMAGE_TYPE_MAP } from '../../constants/products';
import { settingsService } from '../settings/settings.service';

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
   * Create new product with images (Admin only)
   * Business logic:
   * - Validate price > 0
   * - Check unique name within category
   * - If isPreorder = true, leadTimeDays is required
   * - Requires exactly 5 images
   * - Images are uploaded to Supabase and saved in transaction
   */
  async createProduct(
    data: CreateProductInput,
    files: Express.Multer.File[],
    primaryIndex: number,
    imageTypes: string[]
  ): Promise<ProductWithRelations> {
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

    // Fetch dynamic settings
    const requiredImageCount = await settingsService.get<number>('product.image_count', 5);
    const maxImageSizeMb = await settingsService.get<number>('product.max_image_size_mb', 5);

    // Validate image count
    if (files.length !== requiredImageCount) {
      throw new BadRequestError(`Exactly ${requiredImageCount} images are required`);
    }

    // Validate primary index
    if (primaryIndex < 0 || primaryIndex >= requiredImageCount) {
      throw new BadRequestError(`Primary index must be between 0 and ${requiredImageCount - 1}`);
    }

    // Validate image types array
    if (imageTypes.length !== requiredImageCount) {
      throw new BadRequestError(`Exactly ${requiredImageCount} image types are required`);
    }

    // Validate each image type
    const validImageTypes = Object.keys(IMAGE_TYPE_MAP);
    imageTypes.forEach((type, index) => {
      if (!validImageTypes.includes(type)) {
        throw new BadRequestError(
          `Invalid image type at index ${index}: "${type}". Allowed types: ${validImageTypes.join(', ')}`
        );
      }
    });

    // Validate all image files
    files.forEach((file, index) => {
      try {
        validateImageFile(file, maxImageSizeMb);
      } catch (error: any) {
        throw new BadRequestError(`Image ${index + 1}: ${error.message}`);
      }
    });

    // Upload images to Supabase first (before transaction)
    const uploadedImages = await Promise.all(
      files.map(async (file) => {
        return await uploadToSupabase(file, 'products');
      })
    );

    // Create product and images in transaction
    try {
      const product = await prisma.$transaction(async (tx) => {
        // Create product
        const newProduct = await tx.product.create({
          data: {
            name: data.name,
            description: data.description,
            type: data.type,
            price: data.price,
            isPreorder: data.isPreorder,
            leadTimeDays: data.leadTimeDays,
            sku: data.sku,
            brand: data.brand,
            categoryId: data.categoryId,
          },
        });

        // Create product images
        await Promise.all(
          uploadedImages.map(async (uploadResult, index) => {
            const imageType: ProductImageType = IMAGE_TYPE_MAP[imageTypes[index]];
            return tx.productImage.create({
              data: {
                productId: newProduct.id,
                imageUrl: uploadResult.url,
                imageType: imageType,
                isPrimary: index === primaryIndex,
              },
            });
          })
        );

        // Fetch product with relations
        return await tx.product.findUnique({
          where: { id: newProduct.id },
          include: {
            category: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        });
      }, {
        maxWait: 15000, // Maximum time to wait for transaction to start (15s)
        timeout: 15000, // Maximum time for transaction to complete (15s)
      });

      return product!;
    } catch (error) {
      // If transaction fails, we should ideally delete uploaded images from Supabase
      // But for simplicity, we'll leave them (orphaned files)
      // In production, consider implementing cleanup logic
      throw error;
    }
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
   * Get virtual try-on info for a product
   */
  async getTryOnInfo(id: string): Promise<{
    productId: string;
    hasTryOn: boolean;
    model3dUrl: string | null;
    model3dFormat: string | null;
    model3dSizeBytes: number | null;
  }> {
    const product = await productsRepository.findById(id);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return {
      productId: product.id,
      hasTryOn: !!product.model3dUrl,
      model3dUrl: product.model3dUrl,
      model3dFormat: product.model3dFormat,
      model3dSizeBytes: product.model3dSizeBytes,
    };
  }

  /**
   * Upload/Update 3D model for a product (Admin/Staff only)
   */
  async uploadModel3D(id: string, file: Express.Multer.File): Promise<Product> {
    // Check if product exists
    const product = await productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Only FRAME type products support virtual try-on
    if (product.type !== 'FRAME') {
      throw new BadRequestError('Only products of type FRAME can have a 3D model');
    }

    // Upload to Supabase
    const uploadResult = await uploadToSupabase(file, 'models');

    // Update product with 3D model info
    const updatedProduct = await productsRepository.update(id, {
      model3dUrl: uploadResult.url,
      model3dFormat: file.originalname.toLowerCase().endsWith('.glb') ? 'GLB' : 'GLTF',
      model3dSizeBytes: file.size,
      model3dUpdatedAt: new Date(),
    });

    return updatedProduct;
  }

  /**
   * Delete 3D model from a product (Admin/Staff only)
   */
  async deleteModel3D(id: string): Promise<void> {
    // Check if product exists
    const product = await productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Update product to remove 3D model info
    await productsRepository.update(id, {
      model3dUrl: null,
      model3dFormat: null,
      model3dSizeBytes: null,
      model3dUpdatedAt: null,
    });
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
