// src/modules/products/product-images.service.ts
import { ProductImage, ProductImageType } from '@prisma/client';
import { prisma } from '../../config/database';
import { productsRepository } from './products.repository';
import { NotFoundError, BadRequestError } from '../../utils/errorHandler';
import { uploadToSupabase, deleteFromSupabase, extractPathFromUrl, validateImageFile } from '../../utils/upload';

// Map string imageType to Prisma enum
function mapImageType(imageType: string): ProductImageType {
  const mapping: Record<string, ProductImageType> = {
    '2D': ProductImageType.TWO_D,
    '3D': ProductImageType.THREE_D,
    'DETAIL': ProductImageType.DETAIL,
  };
  return mapping[imageType] || ProductImageType.TWO_D;
}

class ProductImagesService {
  /**
   * Upload multiple images for a product
   * Max 5 images per product
   * First image is automatically set as primary if no primary exists
   */
  async uploadImages(productId: string, files: Express.Multer.File[], imageType: string): Promise<ProductImage[]> {
    // Check if product exists
    const product = await productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Get current images count
    const currentImagesCount = await prisma.productImage.count({
      where: { productId },
    });

    // Check max 5 images limit
    if (currentImagesCount + files.length > 5) {
      throw new BadRequestError(`Cannot upload more than 5 images per product. Current: ${currentImagesCount}`);
    }

    // Validate all files before uploading
    files.forEach((file) => {
      validateImageFile(file, 5); // 5MB max per image
    });

    // Check if product has primary image
    const hasPrimaryImage = product.images.some((img) => img.isPrimary);

    // Upload all images
    const uploadPromises = files.map(async (file, index) => {
      const uploadResult = await uploadToSupabase(file, 'products');

      return prisma.productImage.create({
        data: {
          productId,
          imageUrl: uploadResult.url,
          imageType: mapImageType(imageType),
          isPrimary: !hasPrimaryImage && index === 0, // First image is primary if no primary exists
        },
      });
    });

    const uploadedImages = await Promise.all(uploadPromises);

    return uploadedImages;
  }

  /**
   * Delete a product image
   */
  async deleteImage(productId: string, imageId: string): Promise<void> {
    // Check if product exists
    const product = await productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Find image
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Check if this is the last image
    const imagesCount = await prisma.productImage.count({
      where: { productId },
    });

    if (imagesCount === 1) {
      throw new BadRequestError('Cannot delete the last image. Product must have at least one image.');
    }

    // Delete from Supabase
    const imagePath = extractPathFromUrl(image.imageUrl);
    if (imagePath) {
      try {
        await deleteFromSupabase(imagePath);
      } catch (error) {
        console.error('Failed to delete image from storage:', error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // If deleting primary image, set another image as primary
    if (image.isPrimary) {
      const otherImage = await prisma.productImage.findFirst({
        where: {
          productId,
          id: { not: imageId },
        },
      });

      if (otherImage) {
        await prisma.productImage.update({
          where: { id: otherImage.id },
          data: { isPrimary: true },
        });
      }
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id: imageId },
    });
  }

  /**
   * Set an image as primary
   * Only one image can be primary at a time
   */
  async setPrimaryImage(productId: string, imageId: string): Promise<ProductImage> {
    // Check if product exists
    const product = await productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check if image exists and belongs to product
    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Use transaction to ensure atomicity
    const updatedImage = await prisma.$transaction(async (tx) => {
      // Set all images to non-primary
      await tx.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });

      // Set target image as primary
      return await tx.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });

    return updatedImage;
  }

  /**
   * Get all images for a product
   */
  async getProductImages(productId: string): Promise<ProductImage[]> {
    // Check if product exists
    const product = await productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return await prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }
}

export const productImagesService = new ProductImagesService();
