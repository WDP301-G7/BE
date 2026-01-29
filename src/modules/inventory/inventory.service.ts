// src/modules/inventory/inventory.service.ts
import { Inventory } from '@prisma/client';
import {
  inventoryRepository,
  GetInventoryFilter,
  PaginatedInventory,
  InventoryWithRelations,
} from './inventory.repository';
import { productsRepository } from '../products/products.repository';
import { storesRepository } from '../stores/stores.repository';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errorHandler';
import {
  CreateInventoryInput,
  UpdateInventoryInput,
  ReserveInventoryInput,
  ReleaseInventoryInput,
} from '../../validations/zod/inventory.schema';

class InventoryService {
  /**
   * Get all inventory with pagination and filters
   */
  async getInventory(filter: GetInventoryFilter): Promise<PaginatedInventory> {
    return await inventoryRepository.getInventory(filter);
  }

  /**
   * Get inventory by ID
   */
  async getInventoryById(id: string): Promise<InventoryWithRelations> {
    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    return inventory;
  }

  /**
   * Get inventory for a specific product across all stores
   */
  async getInventoryByProduct(productId: string): Promise<InventoryWithRelations[]> {
    // Check if product exists
    const product = await productsRepository.findById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return await inventoryRepository.getByProduct(productId);
  }

  /**
   * Get inventory for a specific store
   */
  async getInventoryByStore(storeId: string): Promise<InventoryWithRelations[]> {
    // Check if store exists
    const store = await storesRepository.findById(storeId);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    return await inventoryRepository.getByStore(storeId);
  }

  /**
   * Create new inventory
   */
  async createInventory(data: CreateInventoryInput): Promise<Inventory> {
    // Check if product exists
    const product = await productsRepository.findById(data.productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check if store exists
    const store = await storesRepository.findById(data.storeId);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    // Check if inventory already exists for this product-store combination
    const existingInventory = await inventoryRepository.findByProductAndStore(data.productId, data.storeId);

    if (existingInventory) {
      throw new ConflictError('Inventory already exists for this product and store combination');
    }

    // Validate reservedQuantity is not greater than quantity
    if (data.reservedQuantity && data.reservedQuantity > data.quantity) {
      throw new BadRequestError('Reserved quantity cannot be greater than total quantity');
    }

    return await inventoryRepository.create({
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity || 0,
      product: {
        connect: { id: data.productId },
      },
      store: {
        connect: { id: data.storeId },
      },
    });
  }

  /**
   * Update inventory
   */
  async updateInventory(id: string, data: UpdateInventoryInput): Promise<Inventory> {
    // Check if inventory exists
    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    // Calculate new values
    const newQuantity = data.quantity !== undefined ? data.quantity : inventory.quantity;
    const newReservedQuantity = data.reservedQuantity !== undefined ? data.reservedQuantity : inventory.reservedQuantity;

    // Validate reservedQuantity is not greater than quantity
    if (newReservedQuantity > newQuantity) {
      throw new BadRequestError('Reserved quantity cannot be greater than total quantity');
    }

    return await inventoryRepository.update(id, data);
  }

  /**
   * Delete inventory
   */
  async deleteInventory(id: string): Promise<void> {
    // Check if inventory exists
    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    // Check if there are reserved items
    if (inventory.reservedQuantity > 0) {
      throw new BadRequestError(
        `Cannot delete inventory with reserved items. Reserved quantity: ${inventory.reservedQuantity}`
      );
    }

    await inventoryRepository.delete(id);
  }

  /**
   * Reserve inventory (for orders)
   */
  async reserveInventory(id: string, data: ReserveInventoryInput): Promise<Inventory> {
    // Check if inventory exists
    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    // Check if there's enough available quantity
    const availableQuantity = inventory.quantity - inventory.reservedQuantity;

    if (availableQuantity < data.quantity) {
      throw new BadRequestError(
        `Not enough available quantity. Available: ${availableQuantity}, Requested: ${data.quantity}`
      );
    }

    return await inventoryRepository.reserve(id, data.quantity);
  }

  /**
   * Release reserved inventory (cancel order or after fulfillment)
   */
  async releaseInventory(id: string, data: ReleaseInventoryInput): Promise<Inventory> {
    // Check if inventory exists
    const inventory = await inventoryRepository.findById(id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    // Check if there's enough reserved quantity to release
    if (inventory.reservedQuantity < data.quantity) {
      throw new BadRequestError(
        `Cannot release more than reserved quantity. Reserved: ${inventory.reservedQuantity}, Requested: ${data.quantity}`
      );
    }

    return await inventoryRepository.release(id, data.quantity);
  }

  /**
   * Get total available quantity for a product
   */
  async getTotalAvailableQuantity(productId: string): Promise<number> {
    // Check if product exists
    const product = await productsRepository.findById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return await inventoryRepository.getTotalAvailableQuantity(productId);
  }
}

export const inventoryService = new InventoryService();
