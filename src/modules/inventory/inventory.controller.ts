// src/modules/inventory/inventory.controller.ts
import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { apiResponse } from '../../utils/apiResponse';
import { GetInventoryQuery } from '../../validations/zod/inventory.schema';

class InventoryController {
  /**
   * @route   GET /api/inventory
   * @desc    Get all inventory with pagination and filters
   * @access  Private (Staff+)
   */
  async getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetInventoryQuery;

      const result = await inventoryService.getInventory(query);

      res.status(200).json(apiResponse.success(result, 'Inventory retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/inventory/:id
   * @desc    Get inventory by ID
   * @access  Private (Staff+)
   */
  async getInventoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const inventory = await inventoryService.getInventoryById(id);

      res.status(200).json(apiResponse.success(inventory, 'Inventory retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/inventory/product/:productId
   * @desc    Get inventory for a specific product across all stores
   * @access  Public
   */
  async getInventoryByProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params as { productId: string };

      const inventory = await inventoryService.getInventoryByProduct(productId);

      res.status(200).json(apiResponse.success(inventory, 'Inventory retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/inventory/store/:storeId
   * @desc    Get inventory for a specific store
   * @access  Private (Staff+)
   */
  async getInventoryByStore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId } = req.params as { storeId: string };

      const inventory = await inventoryService.getInventoryByStore(storeId);

      res.status(200).json(apiResponse.success(inventory, 'Inventory retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/inventory
   * @desc    Create new inventory
   * @access  Private (Admin only)
   */
  async createInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inventory = await inventoryService.createInventory(req.body);

      res.status(201).json(apiResponse.success(inventory, 'Inventory created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/inventory/:id
   * @desc    Update inventory
   * @access  Private (Admin only)
   */
  async updateInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const inventory = await inventoryService.updateInventory(id, req.body);

      res.status(200).json(apiResponse.success(inventory, 'Inventory updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/inventory/:id
   * @desc    Delete inventory
   * @access  Private (Admin only)
   */
  async deleteInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      await inventoryService.deleteInventory(id);

      res.status(200).json(apiResponse.success(null, 'Inventory deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/inventory/:id/reserve
   * @desc    Reserve inventory (for orders)
   * @access  Private (System/Staff+)
   */
  async reserveInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const inventory = await inventoryService.reserveInventory(id, req.body);

      res.status(200).json(apiResponse.success(inventory, 'Inventory reserved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/inventory/:id/release
   * @desc    Release reserved inventory
   * @access  Private (System/Staff+)
   */
  async releaseInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const inventory = await inventoryService.releaseInventory(id, req.body);

      res.status(200).json(apiResponse.success(inventory, 'Inventory released successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/inventory/product/:productId/available
   * @desc    Get total available quantity for a product
   * @access  Public
   */
  async getTotalAvailableQuantity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params as { productId: string };

      const availableQuantity = await inventoryService.getTotalAvailableQuantity(productId);

      res.status(200).json(
        apiResponse.success(
          { productId, availableQuantity },
          'Available quantity retrieved successfully'
        )
      );
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
