// src/modules/categories/categories.controller.ts
import { Request, Response, NextFunction } from 'express';
import { categoriesService } from './categories.service';
import { apiResponse } from '../../utils/apiResponse';
import { GetCategoriesQuery } from '../../validations/zod/categories.schema';

class CategoriesController {
  /**
   * @route   GET /api/categories
   * @desc    Get all categories with pagination
   * @access  Public
   */
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetCategoriesQuery;

      const result = await categoriesService.getCategories(query);

      res.status(200).json(apiResponse.success(result, 'Categories retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/categories/:id
   * @desc    Get category by ID
   * @access  Public
   */
  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const category = await categoriesService.getCategoryById(id);

      res.status(200).json(apiResponse.success(category, 'Category retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/categories
   * @desc    Create new category
   * @access  Private (Admin only)
   */
  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.createCategory(req.body);

      res.status(201).json(apiResponse.success(category, 'Category created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/categories/:id
   * @desc    Update category
   * @access  Private (Admin only)
   */
  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const category = await categoriesService.updateCategory(id, req.body);

      res.status(200).json(apiResponse.success(category, 'Category updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/categories/:id
   * @desc    Delete category
   * @access  Private (Admin only)
   */
  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      await categoriesService.deleteCategory(id);

      res.status(200).json(apiResponse.success(null, 'Category deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const categoriesController = new CategoriesController();
