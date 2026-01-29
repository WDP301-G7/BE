// src/modules/products/products.repository.ts
import { Product, ProductType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface GetProductsFilter {
  page?: number;
  limit?: number;
  categoryId?: string;
  type?: ProductType;
  minPrice?: number;
  maxPrice?: number;
  isPreorder?: boolean;
  search?: string;
}

export interface PaginatedProducts {
  data: ProductWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ProductWithRelations = Product & {
  category: {
    id: string;
    name: string;
  };
  images: {
    id: string;
    imageUrl: string;
    imageType: string;
    isPrimary: boolean;
  }[];
};

class ProductsRepository {
  /**
   * Get all products with pagination and filters (soft delete aware)
   * Uses Prisma ORM for simple queries
   */
  async getProducts(filter: GetProductsFilter): Promise<PaginatedProducts> {
    const { page = 1, limit = 10, categoryId, type, minPrice, maxPrice, isPreorder, search } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      deletedAt: null, // Soft delete filter
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (type) {
      where.type = type;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    if (isPreorder !== undefined) {
      where.isPreorder = isPreorder;
    }

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { description: { contains: search,  } },
        { sku: { contains: search,  } },
        { brand: { contains: search,  } },
      ];
    }

    // Execute queries in parallel
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          images: {
            select: {
              id: true,
              imageUrl: true,
              imageType: true,
              isPrimary: true,
            },
            orderBy: {
              isPrimary: 'desc', // Primary image first
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products as ProductWithRelations[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get product by ID (soft delete aware)
   */
  async findById(id: string): Promise<ProductWithRelations | null> {
    return (await prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            imageType: true,
            isPrimary: true,
          },
          orderBy: {
            isPrimary: 'desc',
          },
        },
      },
    })) as ProductWithRelations | null;
  }

  /**
   * Find product by name and category (for unique validation)
   */
  async findByNameAndCategory(name: string, categoryId: string, excludeId?: string): Promise<Product | null> {
    return await prisma.product.findFirst({
      where: {
        name,
        categoryId,
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
  }

  /**
   * Create new product
   */
  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return await prisma.product.create({
      data,
    });
  }

  /**
   * Update product
   */
  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return await prisma.product.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete product
   */
  async softDelete(id: string): Promise<Product> {
    return await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Hard delete product (for cleanup/testing only)
   */
  async hardDelete(id: string): Promise<Product> {
    return await prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Count products by category
   */
  async countByCategory(categoryId: string): Promise<number> {
    return await prisma.product.count({
      where: {
        categoryId,
        deletedAt: null,
      },
    });
  }

  /**
   * Count products by type
   */
  async countByType(type: ProductType): Promise<number> {
    return await prisma.product.count({
      where: {
        type,
        deletedAt: null,
      },
    });
  }
}

export const productsRepository = new ProductsRepository();
