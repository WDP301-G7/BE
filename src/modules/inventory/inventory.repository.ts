// src/modules/inventory/inventory.repository.ts
import { Inventory, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface GetInventoryFilter {
  page?: number;
  limit?: number;
  productId?: string;
  storeId?: string;
  lowStock?: boolean;
}

export interface PaginatedInventory {
  data: InventoryWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type InventoryWithRelations = Inventory & {
  product: {
    id: string;
    name: string;
    sku: string | null;
    type: string;
    price: any;
  };
  store: {
    id: string;
    name: string;
    address: string;
  };
};

class InventoryRepository {
  /**
   * Get all inventory with pagination and filters
   */
  async getInventory(filter: GetInventoryFilter): Promise<PaginatedInventory> {
    const { page = 1, limit = 10, productId, storeId, lowStock } = filter;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.InventoryWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (storeId) {
      where.storeId = storeId;
    }

    if (lowStock === true) {
      // Low stock: available quantity (quantity - reservedQuantity) < 10
      where.quantity = { lt: 10 };
    }

    // Execute queries in parallel
    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              type: true,
              price: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    return {
      data: inventory as InventoryWithRelations[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get inventory by ID
   */
  async findById(id: string): Promise<InventoryWithRelations | null> {
    return (await prisma.inventory.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            price: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    })) as InventoryWithRelations | null;
  }

  /**
   * Find inventory by product and store (for unique validation)
   */
  async findByProductAndStore(productId: string, storeId: string): Promise<Inventory | null> {
    return await prisma.inventory.findFirst({
      where: {
        productId,
        storeId,
      },
    });
  }

  /**
   * Get inventory for a specific product across all stores
   */
  async getByProduct(productId: string): Promise<InventoryWithRelations[]> {
    return (await prisma.inventory.findMany({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            price: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        quantity: 'desc',
      },
    })) as InventoryWithRelations[];
  }

  /**
   * Get inventory for a specific store
   */
  async getByStore(storeId: string): Promise<InventoryWithRelations[]> {
    return (await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            price: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })) as InventoryWithRelations[];
  }

  /**
   * Create new inventory
   */
  async create(data: Prisma.InventoryCreateInput): Promise<Inventory> {
    return await prisma.inventory.create({
      data,
    });
  }

  /**
   * Update inventory
   */
  async update(id: string, data: Prisma.InventoryUpdateInput): Promise<Inventory> {
    return await prisma.inventory.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete inventory
   */
  async delete(id: string): Promise<Inventory> {
    return await prisma.inventory.delete({
      where: { id },
    });
  }

  /**
   * Reserve inventory (increase reservedQuantity)
   */
  async reserve(id: string, quantity: number): Promise<Inventory> {
    return await prisma.inventory.update({
      where: { id },
      data: {
        reservedQuantity: {
          increment: quantity,
        },
      },
    });
  }

  /**
   * Release reserved inventory (decrease reservedQuantity)
   */
  async release(id: string, quantity: number): Promise<Inventory> {
    return await prisma.inventory.update({
      where: { id },
      data: {
        reservedQuantity: {
          decrement: quantity,
        },
      },
    });
  }

  /**
   * Get total available quantity for a product (across all stores)
   */
  async getTotalAvailableQuantity(productId: string): Promise<number> {
    const inventories = await prisma.inventory.findMany({
      where: { productId },
      select: {
        quantity: true,
        reservedQuantity: true,
      },
    });

    return inventories.reduce(
      (total, inv) => total + (inv.quantity - inv.reservedQuantity),
      0
    );
  }
}

export const inventoryRepository = new InventoryRepository();
