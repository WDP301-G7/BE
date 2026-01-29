// src/modules/stores/stores.service.ts
import { Store } from '@prisma/client';
import {
  storesRepository,
  GetStoresFilter,
  PaginatedStores,
  StoreWithCount,
} from './stores.repository';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errorHandler';
import { CreateStoreInput, UpdateStoreInput } from '../../validations/zod/stores.schema';

class StoresService {
  /**
   * Get all stores with pagination and filters
   */
  async getStores(filter: GetStoresFilter): Promise<PaginatedStores> {
    return await storesRepository.getStores(filter);
  }

  /**
   * Get store by ID
   */
  async getStoreById(id: string): Promise<StoreWithCount> {
    const store = await storesRepository.findById(id);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    return store;
  }

  /**
   * Create new store
   */
  async createStore(data: CreateStoreInput): Promise<Store> {
    // Check if store name already exists
    const existingStore = await storesRepository.findByName(data.name);

    if (existingStore) {
      throw new ConflictError('Store with this name already exists');
    }

    return await storesRepository.create(data);
  }

  /**
   * Update store
   */
  async updateStore(id: string, data: UpdateStoreInput): Promise<Store> {
    // Check if store exists
    const store = await storesRepository.findById(id);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    // Check if new name conflicts with existing store
    if (data.name) {
      const existingStore = await storesRepository.findByName(data.name, id);

      if (existingStore) {
        throw new ConflictError('Store with this name already exists');
      }
    }

    return await storesRepository.update(id, data);
  }

  /**
   * Delete store
   */
  async deleteStore(id: string): Promise<void> {
    // Check if store exists
    const store = await storesRepository.findById(id);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    // Check if store has inventory
    const inventoryCount = await storesRepository.countInventory(id);

    if (inventoryCount > 0) {
      throw new BadRequestError(
        `Cannot delete store. It has ${inventoryCount} inventory item(s). Please reassign or delete the inventory first.`
      );
    }

    // Check if store has users
    const userCount = await storesRepository.countUsers(id);

    if (userCount > 0) {
      throw new BadRequestError(
        `Cannot delete store. It has ${userCount} user(s) assigned. Please reassign the users first.`
      );
    }

    await storesRepository.delete(id);
  }
}

export const storesService = new StoresService();
