// src/modules/stores/stores.repository.ts
import { Store, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface GetStoresFilter {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedStores {
  data: StoreWithCount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type StoreWithCount = Store & {
  _count: {
    users: number;
    inventory: number;
  };
};

class StoresRepository {
  /**
   * Get all stores with pagination and filters
   */
  async getStores(filter: GetStoresFilter): Promise<PaginatedStores> {
    const { page = 1, limit = 10, search } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.StoreWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
      ];
    }

    // Execute queries in parallel
    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              users: true,
              inventory: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.store.count({ where }),
    ]);

    return {
      data: stores as StoreWithCount[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get store by ID
   */
  async findById(id: string): Promise<StoreWithCount | null> {
    return (await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            inventory: true,
          },
        },
      },
    })) as StoreWithCount | null;
  }

  /**
   * Find store by name (for unique validation)
   */
  async findByName(name: string, excludeId?: string): Promise<Store | null> {
    return await prisma.store.findFirst({
      where: {
        name,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
  }

  /**
   * Create new store
   */
  async create(data: Prisma.StoreCreateInput): Promise<Store> {
    return await prisma.store.create({
      data,
    });
  }

  /**
   * Update store
   */
  async update(id: string, data: Prisma.StoreUpdateInput): Promise<Store> {
    return await prisma.store.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete store
   */
  async delete(id: string): Promise<Store> {
    return await prisma.store.delete({
      where: { id },
    });
  }

  /**
   * Count inventory items in store
   */
  async countInventory(storeId: string): Promise<number> {
    return await prisma.inventory.count({
      where: { storeId },
    });
  }

  /**
   * Count users assigned to store
   */
  async countUsers(storeId: string): Promise<number> {
    return await prisma.user.count({
      where: { storeId },
    });
  }
}

export const storesRepository = new StoresRepository();
