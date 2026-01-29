// src/modules/stores/stores.controller.ts
import { Request, Response, NextFunction } from 'express';
import { storesService } from './stores.service';
import { apiResponse } from '../../utils/apiResponse';
import { GetStoresQuery } from '../../validations/zod/stores.schema';

class StoresController {
  /**
   * @route   GET /api/stores
   * @desc    Get all stores with pagination
   * @access  Public
   */
  async getStores(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetStoresQuery;

      const result = await storesService.getStores(query);

      res.status(200).json(apiResponse.success(result, 'Stores retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/stores/:id
   * @desc    Get store by ID
   * @access  Public
   */
  async getStoreById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const store = await storesService.getStoreById(id);

      res.status(200).json(apiResponse.success(store, 'Store retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/stores
   * @desc    Create new store
   * @access  Private (Admin only)
   */
  async createStore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const store = await storesService.createStore(req.body);

      res.status(201).json(apiResponse.success(store, 'Store created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/stores/:id
   * @desc    Update store
   * @access  Private (Admin only)
   */
  async updateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const store = await storesService.updateStore(id, req.body);

      res.status(200).json(apiResponse.success(store, 'Store updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/stores/:id
   * @desc    Delete store
   * @access  Private (Admin only)
   */
  async deleteStore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string } ;

      await storesService.deleteStore(id);

      res.status(200).json(apiResponse.success(null, 'Store deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const storesController = new StoresController();
