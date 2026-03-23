// src/modules/products/products.controller.ts
import { Request, Response, NextFunction } from 'express';
import { productsService } from './products.service';
import { apiResponse } from '../../utils/apiResponse';
import { CreateProductInput, UpdateProductInput, GetProductsQuery, createProductSchema } from '../../validations/zod/products.schema';

class ProductsController {
  /**
   * @route   GET /api/products
   * @desc    Get all products with pagination and filters
   * @access  Public
   */
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as any as GetProductsQuery;

      const result = await productsService.getProducts(query);

      res.status(200).json(apiResponse.success(result, 'Products retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/products/:id
   * @desc    Get product by ID
   * @access  Public
   */
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;

      const product = await productsService.getProductById(productId);

      res.status(200).json(apiResponse.success(product, 'Product retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/products
   * @desc    Create new product with images
   * @access  Private (Admin only)
   */
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse product data from multipart form fields
      const {
        categoryId,
        name,
        description,
        type,
        price,
        isPreorder,
        leadTimeDays,
        sku,
        brand,
        primaryIndex: primaryIndexString,
        imageTypes: imageTypesString,
      } = req.body;

      // Validate required fields
      if (!categoryId || !name || !type || !price) {
        res.status(400).json(apiResponse.error('Missing required fields: categoryId, name, type, price', 400));
        return;
      }

      // Parse and validate price
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice)) {
        res.status(400).json(apiResponse.error('Price must be a valid number', 400));
        return;
      }

      // Parse isPreorder (handle string "true"/"false")
      const parsedIsPreorder = isPreorder === 'true' || isPreorder === true;

      // Parse leadTimeDays if provided
      let parsedLeadTimeDays: number | undefined;
      if (leadTimeDays) {
        parsedLeadTimeDays = parseInt(leadTimeDays, 10);
        if (isNaN(parsedLeadTimeDays)) {
          res.status(400).json(apiResponse.error('Lead time days must be a valid number', 400));
          return;
        }
      }

      // Build product data object
      const data: CreateProductInput = {
        categoryId,
        name,
        description: description || undefined,
        type,
        price: parsedPrice,
        isPreorder: parsedIsPreorder,
        leadTimeDays: parsedLeadTimeDays,
        sku: sku || undefined,
        brand: brand || undefined,
      };

      // Validate data against schema
      const validationResult = createProductSchema.safeParse({ body: data });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json(apiResponse.validationError(errors));
        return;
      }

      // Get uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json(apiResponse.error('Images are required', 400));
        return;
      }

      // Get and validate primary index
      if (primaryIndexString === undefined || primaryIndexString === null || primaryIndexString === '') {
        res.status(400).json(apiResponse.error('Primary index is required', 400));
        return;
      }

      const primaryIndex = parseInt(primaryIndexString, 10);
      if (isNaN(primaryIndex)) {
        res.status(400).json(apiResponse.error('Primary index must be a number', 400));
        return;
      }

      // Get and parse image types
      let imageTypes: string[];
      if (typeof imageTypesString === 'string') {
        // Try parsing as JSON array first
        if (imageTypesString.trim().startsWith('[')) {
          try {
            imageTypes = JSON.parse(imageTypesString);
          } catch (error) {
            res.status(400).json(apiResponse.error('Invalid JSON in imageTypes field', 400));
            return;
          }
        } else {
          // Parse as comma-separated string
          imageTypes = imageTypesString.split(',').map(t => t.trim());
        }
      } else if (Array.isArray(imageTypesString)) {
        imageTypes = imageTypesString;
      } else {
        res.status(400).json(apiResponse.error('Image types are required', 400));
        return;
      }

      const product = await productsService.createProduct(data, files, primaryIndex, imageTypes);

      res.status(201).json(apiResponse.success(product, 'Product created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/products/:id
   * @desc    Update product
   * @access  Private (Admin only)
   */
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const data: UpdateProductInput = req.body;

      const product = await productsService.updateProduct(productId, data);

      res.status(200).json(apiResponse.success(product, 'Product updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/products/:id
   * @desc    Delete product (soft delete)
   * @access  Private (Admin only)
   */
  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;

      await productsService.deleteProduct(productId);

      res.status(200).json(apiResponse.success(null, 'Product deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/products/stats
   * @desc    Get product statistics
   * @access  Private (Admin, Manager)
   */
  async getProductStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await productsService.getProductStats();

      res.status(200).json(apiResponse.success(stats, 'Product statistics retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/products/:id/try-on
   * @desc    Get virtual try-on info for a product
   * @access  Public
   */
  async getTryOnInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const result = await productsService.getTryOnInfo(productId);

      res.status(200).json(apiResponse.success(result, 'Try-on info retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/products/:id/try-on
   * @desc    Upload/Update 3D model for a product
   * @access  Private (Admin, Staff)
   */
  async uploadModel3D(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;
      const file = req.file;

      if (!file) {
        res.status(400).json(apiResponse.error('3D model file (.glb or .gltf) is required', 400));
        return;
      }

      const product = await productsService.uploadModel3D(productId, file);

      res.status(200).json(apiResponse.success({
        productId: product.id,
        model3dUrl: product.model3dUrl,
        model3dFormat: product.model3dFormat,
        model3dSizeBytes: product.model3dSizeBytes,
        model3dUpdatedAt: product.model3dUpdatedAt,
      }, '3D model uploaded successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/products/:id/try-on
   * @desc    Delete 3D model from a product
   * @access  Private (Admin, Staff)
   */
  async deleteModel3D(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.id as string;

      await productsService.deleteModel3D(productId);

      res.status(200).json(apiResponse.success({ productId }, '3D model removed successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const productsController = new ProductsController();
