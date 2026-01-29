// src/modules/categories/categories.repository.ts
import { Category, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface GetCategoriesFilter {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedCategories {
  data: CategoryWithCount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type CategoryWithCount = Category & {
  _count: {
    products: number;
  };
};

class CategoriesRepository {
  /**
   * Get all categories with pagination and filters
   */
  async getCategories(filter: GetCategoriesFilter): Promise<PaginatedCategories> {
    const { page = 1, limit = 10, search } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.CategoryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Execute queries in parallel
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.category.count({ where }),
    ]);

    return {
      data: categories as CategoryWithCount[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get category by ID
   */
  async findById(id: string): Promise<CategoryWithCount | null> {
    return (await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    })) as CategoryWithCount | null;
  }

  /**
   * Find category by name (for unique validation)
   */
  async findByName(name: string, excludeId?: string): Promise<Category | null> {
    return await prisma.category.findFirst({
      where: {
        name,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
  }

  /**
   * Create new category
   */
  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return await prisma.category.create({
      data,
    });
  }

  /**
   * Update category
   */
  async update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return await prisma.category.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete category
   */
  async delete(id: string): Promise<Category> {
    return await prisma.category.delete({
      where: { id },
    });
  }

  /**
   * Count products in category
   */
  async countProducts(categoryId: string): Promise<number> {
    return await prisma.product.count({
      where: {
        categoryId,
        deletedAt: null,
      },
    });
  }
}

export const categoriesRepository = new CategoriesRepository();
