// src/modules/products/product-images.controller.ts
import { Request, Response, NextFunction } from 'express';
import { productImagesService } from './product-images.service';
import { apiResponse } from '../../utils/apiResponse';

class ProductImagesController {
  /**
   * @route   POST /api/products/:id/images
   * @desc    Upload images for a product (multipart/form-data)
   * @access  Private (Admin only)
   */
  async uploadImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const files = req.files as Express.Multer.File[];
      
      // Handle imageType: support array, empty string, undefined
      let imageType = Array.isArray(req.body.imageType) ? req.body.imageType[0] : req.body.imageType;
      // Default to '2D' if empty, null, or undefined
      imageType = imageType && imageType.trim() !== '' ? imageType : '2D';

      if (!files || files.length === 0) {
        res.status(400).json(apiResponse.error('No images provided', 400));
        return;
      }

      const images = await productImagesService.uploadImages(productId, files, imageType);

      res.status(201).json(apiResponse.success(images, 'Images uploaded successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/products/:id/images/:imageId
   * @desc    Delete a product image
   * @access  Private (Admin only)
   */
  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const imageId = req.params.imageId as string;

      await productImagesService.deleteImage(productId, imageId);

      res.status(200).json(apiResponse.success(null, 'Image deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/products/:id/images/:imageId/primary
   * @desc    Set an image as primary
   * @access  Private (Admin only)
   */
  async setPrimaryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const imageId = req.params.imageId as string;

      const image = await productImagesService.setPrimaryImage(productId, imageId);

      res.status(200).json(apiResponse.success(image, 'Primary image updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/products/:id/images
   * @desc    Get all images for a product
   * @access  Public
   */
  async getProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;

      const images = await productImagesService.getProductImages(productId);

      res.status(200).json(apiResponse.success(images, 'Images retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const productImagesController = new ProductImagesController();
