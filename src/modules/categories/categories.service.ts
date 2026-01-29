// src/modules/categories/categories.service.ts
import { Category } from '@prisma/client';
import {
  categoriesRepository,
  GetCategoriesFilter,
  PaginatedCategories,
  CategoryWithCount,
} from './categories.repository';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput } from '../../validations/zod/categories.schema';

class CategoriesService {
  /**
   * Get all categories with pagination and filters
   */
  async getCategories(filter: GetCategoriesFilter): Promise<PaginatedCategories> {
    return await categoriesRepository.getCategories(filter);
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<CategoryWithCount> {
    const category = await categoriesRepository.findById(id);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    // Check if category name already exists
    const existingCategory = await categoriesRepository.findByName(data.name);

    if (existingCategory) {
      throw new ConflictError('Category with this name already exists');
    }

    return await categoriesRepository.create(data);
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
    // Check if category exists
    const category = await categoriesRepository.findById(id);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if new name conflicts with existing category
    if (data.name) {
      const existingCategory = await categoriesRepository.findByName(data.name, id);

      if (existingCategory) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    return await categoriesRepository.update(id, data);
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    // Check if category exists
    const category = await categoriesRepository.findById(id);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category has products
    const productCount = await categoriesRepository.countProducts(id);

    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete category. It has ${productCount} product(s). Please reassign or delete the products first.`
      );
    }

    await categoriesRepository.delete(id);
  }
}

export const categoriesService = new CategoriesService();
