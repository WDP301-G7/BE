// src/modules/products/products.controller.ts
import { Request, Response, NextFunction } from 'express';
import { productsService } from './products.service';
import { apiResponse } from '../../utils/apiResponse';
import { CreateProductInput, UpdateProductInput, GetProductsQuery } from '../../validations/zod/products.schema';

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
   * @desc    Create new product
   * @access  Private (Admin only)
   */
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateProductInput = req.body;

      const product = await productsService.createProduct(data);

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
}

export const productsController = new ProductsController();
